import crypto from 'node:crypto';

import chromiumBinary from '@sparticuz/chromium';

import {
  readConfiguration,
  runCaptureCycle
} from '../renderer/capture.mjs';

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

function json(response, status, payload) {
  response.status(status);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(payload));
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return json(response, 405, { ok: false, error: 'Use POST.' });
  }

  if (!isAuthorized(request.headers.authorization, process.env.CAPTURE_API_SECRET)) {
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
    chromiumBinary.setGraphicsMode = false;
    const executablePath = await chromiumBinary.executablePath();
    const dashboardIds = Array.isArray(request.body?.dashboardIds)
      ? request.body.dashboardIds.map(String).join(',')
      : '';

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
        CAPTURE_ONLY_IDS: dashboardIds || process.env.CAPTURE_ONLY_IDS || ''
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

    const summary = await runCaptureCycle(config);
    return json(response, summary.failures > 0 ? 207 : 200, sanitizedSummary(
      summary,
      Date.now() - startedAt
    ));
  } catch (error) {
    console.error('[captura-cloud] Falha geral:', error);
    return json(response, 500, {
      ok: false,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
