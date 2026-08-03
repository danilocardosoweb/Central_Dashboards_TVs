import crypto from 'node:crypto';

import chromiumBinary from '@sparticuz/chromium';
import { createClient } from '@supabase/supabase-js';

import {
  readCentralState,
  readConfiguration,
  runCaptureCycle
} from '../renderer/capture.mjs';
import {
  captureProgress,
  claimNextCapture,
  completeCapture
} from '../renderer/capture-queue.mjs';
import { updateResilientState } from '../renderer/state-store.mjs';
import {
  errorDetails,
  logEvent,
  traceIdFromRequest
} from '../renderer/telemetry.mjs';

export function isAuthorized(authorizationHeader, expectedSecret) {
  if (!expectedSecret || typeof authorizationHeader !== 'string') return false;

  const prefix = 'Bearer ';
  if (!authorizationHeader.startsWith(prefix)) return false;

  const received = Buffer.from(authorizationHeader.slice(prefix.length));
  const expected = Buffer.from(expectedSecret);
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export function sanitizedSummary(summary, elapsedMs) {
  return {
    ok: summary.failures === 0,
    successes: summary.successes,
    failures: summary.failures,
    elapsedMs,
    dashboards: summary.results.map((result) => ({
      id: result.id,
      name: result.name,
      ok: result.ok,
      capturedAt: result.capturedAt,
      appliedZoom: result.appliedZoom,
      error: result.error
    }))
  };
}

function json(response, status, payload, traceId = '') {
  response.status(status);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Expose-Headers', 'X-Central-Trace-Id');
  if (traceId) response.setHeader('X-Central-Trace-Id', traceId);
  response.end(JSON.stringify(traceId ? { ...payload, traceId } : payload));
}

async function captureHealth() {
  const config = readConfiguration(process.env, []);
  const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const row = await readCentralState(supabase, config);
  const dashboards = Array.isArray(row.payload?.urls) ? row.payload.urls : [];
  const captureDates = dashboards
    .map(item => Date.parse(String(item?.rokuCapturedAt || '')))
    .filter(Number.isFinite);
  const pprIndicators = Array.isArray(row.payload?.ppr?.indicators)
    ? row.payload.ppr.indicators
    : [];
  return {
    stateReachable: true,
    stateBackend: 'storage',
    revision: Number(row.revision) || 0,
    stateUpdatedAt: row.updated_at || null,
    dashboards: dashboards.length,
    dashboardsWithImage: dashboards.filter(item => Boolean(item?.rokuImageUrl)).length,
    latestCaptureAt: captureDates.length
      ? new Date(Math.max(...captureDates)).toISOString()
      : null,
    lastCycleStartedAt: row.payload?.capture?.lastCycleStartedAt || null,
    pprEnabled: row.payload?.ppr?.enabled === true,
    pprIndicators: pprIndicators.filter(item => item?.enabled !== false).length,
    pprUpdatedAt: row.payload?.ppr?.updatedAt || null,
    captureRequest: captureProgress(row.payload?.capture)
  };
}

async function updateCentralPayload(supabase, config, buildPayload, maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const row = await readCentralState(supabase, config);
    const nextPayload = buildPayload(row.payload, row);
    if (!nextPayload) return { row, updated: false };
    const saved = await updateResilientState(
      supabase,
      config,
      () => nextPayload,
      { expectedRevision: row.revision }
    );
    if (saved.updated) return saved;
  }
  throw new Error('A fila mudou durante a atualizaÃ§Ã£o. Tente novamente.');
}

async function claimQueuedDashboard(supabase, config) {
  let decision = null;
  const saved = await updateCentralPayload(supabase, config, payload => {
    decision = claimNextCapture(payload);
    if (decision.reason === 'idle' || decision.reason === 'busy') return null;
    return decision.payload;
  });
  return { ...decision, row: saved.row };
}

async function finishQueuedDashboard(supabase, config, dashboardId, result) {
  const saved = await updateCentralPayload(supabase, config, payload =>
    completeCapture(payload, dashboardId, result)
  );
  return captureProgress(saved.row.payload?.capture);
}

export default async function handler(request, response) {
  const traceId = traceIdFromRequest(request);
  if (request.method === 'GET') {
    const payload = {
      ok: true,
      service: 'central-dashboards-capture',
      version: 'flow-v5-storage',
      rendererConfigured: Boolean(process.env.SUPABASE_RENDERER_KEY),
      authorizationConfigured: Boolean(process.env.CAPTURE_API_SECRET)
    };
    if (process.env.SUPABASE_RENDERER_KEY) {
      try {
        payload.state = await captureHealth();
      } catch (error) {
        payload.state = {
          stateReachable: false,
          stateBackend: 'storage',
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    logEvent('capture-api', 'health', { traceId, ...payload });
    return json(response, 200, payload, traceId);
  }
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    return json(response, 405, { ok: false, error: 'Use GET ou POST.' }, traceId);
  }

  if (!isAuthorized(request.headers.authorization, process.env.CAPTURE_API_SECRET)) {
    logEvent('capture-api', 'unauthorized', { traceId }, 'warn');
    return json(response, 401, { ok: false, error: 'Não autorizado.' });
  }

  if (!process.env.SUPABASE_RENDERER_KEY) {
    return json(response, 503, {
      ok: false,
      error: 'SUPABASE_RENDERER_KEY não configurada na Vercel.'
    });
  }

  const startedAt = Date.now();
  try {
    const baseConfig = readConfiguration(process.env, []);
    const supabase = createClient(baseConfig.supabaseUrl, baseConfig.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    const explicitDashboardIds = Array.isArray(request.body?.dashboardIds)
      ? request.body.dashboardIds.map(String).filter(Boolean)
      : [];
    let queuedDashboardId = '';
    logEvent('capture-api', 'request-start', {
      traceId,
      mode: explicitDashboardIds.length ? 'explicit' : 'queue',
      requestedCount: explicitDashboardIds.length
    });

    if (!explicitDashboardIds.length) {
      const claim = await claimQueuedDashboard(supabase, baseConfig);
      if (!claim.claimed) {
        return json(response, 200, {
          ok: true,
          skipped: true,
          reason: claim.reason,
          elapsedMs: Date.now() - startedAt,
          captureRequest: captureProgress(claim.row?.payload?.capture)
        });
      }
      queuedDashboardId = claim.dashboardId;
      logEvent('capture-api', 'queue-claimed', { traceId, dashboardId: queuedDashboardId });
    }

    chromiumBinary.setGraphicsMode = false;
    const executablePath = await chromiumBinary.executablePath();
    const dashboardIds = explicitDashboardIds.length
      ? explicitDashboardIds
      : [queuedDashboardId];

    const config = readConfiguration(
      {
        ...process.env,
        CAPTURE_HEADLESS: 'true',
        CAPTURE_LOCAL_ONLY: 'false',
        CAPTURE_OUTPUT_DIR: '/tmp/central-dashboards-captures',
        CAPTURE_NAVIGATION_TIMEOUT_MS:
          process.env.CAPTURE_NAVIGATION_TIMEOUT_MS || '60000',
        CAPTURE_DETECTION_TIMEOUT_MS:
          process.env.CAPTURE_DETECTION_TIMEOUT_MS || '30000',
        CAPTURE_MAX_DASHBOARDS: String(Math.max(1, dashboardIds.length)),
        CAPTURE_ONLY_IDS: dashboardIds.join(',') || process.env.CAPTURE_ONLY_IDS || ''
      },
      []
    );

    config.browserLaunchOptions = {
      executablePath,
      args: [
        ...chromiumBinary.args,
        '--disable-dev-shm-usage',
        '--hide-scrollbars'
      ]
    };

    let summary;
    try {
      summary = await runCaptureCycle(config);
    } catch (error) {
      if (queuedDashboardId) {
        await finishQueuedDashboard(supabase, baseConfig, queuedDashboardId, {
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        }).catch(queueError => console.error('[captura-cloud] Falha ao concluir fila:', queueError));
      }
      throw error;
    }

    const result = summary.results.find(item => String(item.id) === queuedDashboardId)
      || summary.results[0]
      || { ok: false, error: 'O dashboard solicitado nÃ£o foi localizado.' };
    const captureRequest = queuedDashboardId
      ? await finishQueuedDashboard(
          supabase,
          baseConfig,
          queuedDashboardId,
          result
        )
      : null;
    const payload = sanitizedSummary(summary, Date.now() - startedAt);
    if (captureRequest) payload.captureRequest = captureRequest;
    logEvent('capture-api', 'request-complete', {
      traceId,
      elapsedMs: payload.elapsedMs,
      successes: payload.successes,
      failures: payload.failures,
      dashboardIds: payload.dashboards.map(item => item.id)
    }, summary.failures > 0 ? 'warn' : 'info');
    return json(response, summary.failures > 0 ? 207 : 200, payload, traceId);
  } catch (error) {
    logEvent('capture-api', 'request-error', {
      traceId,
      elapsedMs: Date.now() - startedAt,
      ...errorDetails(error)
    }, 'error');
    return json(response, 500, {
      ok: false,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error)
    }, traceId);
  }
}
