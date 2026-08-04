import { createClient } from '@supabase/supabase-js';

import { readConfiguration } from '../renderer/capture.mjs';
import { readResilientState, updateResilientState } from '../renderer/state-store.mjs';
import {
  errorDetails,
  logEvent,
  summarizeStateRow,
  traceIdFromRequest
} from '../renderer/telemetry.mjs';

const MAX_STATE_BYTES = 8 * 1024 * 1024;

function setCommonHeaders(response, traceId = '') {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Central-Trace-Id');
  response.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  response.setHeader('Access-Control-Expose-Headers', 'X-Central-Trace-Id, X-Central-State-Revision');
  if (traceId) response.setHeader('X-Central-Trace-Id', traceId);
}

function json(response, status, payload, traceId = '') {
  response.status(status);
  setCommonHeaders(response, traceId);
  if (payload?.revision != null) {
    response.setHeader('X-Central-State-Revision', String(payload.revision));
  }
  response.end(JSON.stringify(traceId ? { ...payload, traceId } : payload));
}

function requestBody(request) {
  if (!request.body) return {};
  if (typeof request.body === 'string') {
    try {
      return JSON.parse(request.body);
    } catch {
      return {};
    }
  }
  return request.body;
}

function createStateClient() {
  const config = readConfiguration(process.env, []);
  const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  return { config, supabase };
}

function captureEndpoint(request) {
  const forwardedHost = String(request.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || request.headers.host;
  const forwardedProtocol = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProtocol || 'https';
  return `${protocol}://${host}/api/capture`;
}

async function readState(response, supabase, config, traceId) {
  const startedAt = Date.now();
  const result = await readResilientState(supabase, config, { databaseFallback: false });
  if (!result.row) {
    logEvent('state-api', 'read.missing', {
      traceId,
      source: result.source,
      elapsedMs: Date.now() - startedAt
    }, 'warn');
    return json(response, 404, {
      ok: false,
      missing: true,
      source: result.source,
      message: 'O estado central ainda não foi criado no Storage.'
    }, traceId);
  }

  const summary = summarizeStateRow(result.row);
  logEvent('state-api', 'read.complete', {
    traceId,
    source: result.source,
    elapsedMs: Date.now() - startedAt,
    ...summary
  });
  return json(response, 200, {
    ...result.row,
    source: result.source,
    service: 'central-dashboards-state',
    version: 'storage-v4-observable'
  }, traceId);
}

async function saveState(request, response, supabase, config, traceId) {
  const startedAt = Date.now();
  const body = requestBody(request);
  const payload = body.payload && typeof body.payload === 'object' ? body.payload : null;
  if (!payload) {
    logEvent('state-api', 'save.rejected', { traceId, reason: 'invalid-payload' }, 'warn');
    return json(response, 400, { ok: false, error: 'Payload inválido.' }, traceId);
  }

  const serialized = JSON.stringify(payload);
  const payloadBytes = Buffer.byteLength(serialized, 'utf8');
  if (payloadBytes > MAX_STATE_BYTES) {
    logEvent('state-api', 'save.rejected', { traceId, reason: 'payload-too-large', payloadBytes }, 'warn');
    return json(response, 413, {
      ok: false,
      error: 'A configuração ultrapassou o limite de 8 MB.'
    }, traceId);
  }

  const result = await updateResilientState(supabase, config, () => payload, {
    expectedRevision: body.expectedRevision,
    updatedAt: body.updatedAt,
    databaseFallback: false
  });
  if (result.conflict) {
    logEvent('state-api', 'save.conflict', {
      traceId,
      expectedRevision: body.expectedRevision,
      currentRevision: result.row?.revision,
      elapsedMs: Date.now() - startedAt
    }, 'warn');
    return json(response, 409, {
      ok: false,
      conflict: true,
      row: result.row,
      error: 'A configuração mudou em outro dispositivo.'
    }, traceId);
  }

  const summary = summarizeStateRow(result.row);
  logEvent('state-api', 'save.complete', {
    traceId,
    expectedRevision: body.expectedRevision,
    payloadBytes,
    elapsedMs: Date.now() - startedAt,
    ...summary
  });
  return json(response, 200, {
    ...result.row,
    ok: true,
    source: 'storage',
    service: 'central-dashboards-state',
    version: 'storage-v4-observable'
  }, traceId);
}

async function processCapture(request, response, traceId, type = 'dashboard') {
  if (!process.env.CAPTURE_API_SECRET) {
    return json(response, 503, {
      ok: false,
      error: 'CAPTURE_API_SECRET não configurada na Vercel.'
    }, traceId);
  }

  const captureResponse = await fetch(captureEndpoint(request), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CAPTURE_API_SECRET}`,
      'Content-Type': 'application/json',
      'X-Central-Trace-Id': traceId
    },
    body: JSON.stringify(type === 'ppr' ? { type: 'ppr' } : {})
  });
  const payload = await captureResponse.json().catch(() => ({
    ok: false,
    error: `Capturador retornou ${captureResponse.status}.`
  }));
  logEvent('state-api', 'capture-next.complete', {
    traceId,
    status: captureResponse.status,
    ok: payload?.ok === true,
    skipped: payload?.skipped === true,
    dashboardCount: Array.isArray(payload?.dashboards) ? payload.dashboards.length : 0,
    pprSlides: Number(payload?.slides) || 0,
    type
  }, captureResponse.ok ? 'info' : 'error');
  return json(response, captureResponse.status, payload, traceId);
}

function cleanText(value, maxLength = 120) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

export function normalizeAlertEvent(input = {}, now = new Date()) {
  if (!input || typeof input !== 'object') return null;
  const allowedTypes = new Set(['displayed', 'completed', 'error']);
  const event = {
    eventId: cleanText(input.eventId, 180),
    alertId: cleanText(input.alertId, 180),
    title: cleanText(input.title, 120),
    priority: cleanText(input.priority, 20) || 'normal',
    type: allowedTypes.has(input.type) ? input.type : 'displayed',
    stationId: cleanText(input.stationId, 120),
    stationName: cleanText(input.stationName, 120),
    areaId: cleanText(input.areaId, 120),
    occurredAt: now.toISOString()
  };
  if (!event.eventId || !event.alertId || !event.stationId) return null;
  return event;
}

async function appendAlertEvent(request, response, supabase, config, traceId) {
  const event = normalizeAlertEvent(requestBody(request).event);
  if (!event) {
    return json(response, 400, { ok: false, error: 'Evento de alerta inválido.' }, traceId);
  }
  const result = await updateResilientState(supabase, config, payload => {
    const state = payload && typeof payload === 'object' ? payload : {};
    const history = Array.isArray(state.alertHistory) ? [...state.alertHistory] : [];
    if (!history.some(item => item?.eventId === event.eventId)) history.unshift(event);
    return { ...state, alertHistory: history.slice(0, 300) };
  }, { databaseFallback: false });
  logEvent('state-api', 'alert-event.saved', {
    traceId,
    eventId: event.eventId,
    alertId: event.alertId,
    stationId: event.stationId,
    revision: result.row?.revision
  });
  return json(response, 200, {
    ok: true,
    revision: result.row?.revision,
    eventId: event.eventId
  }, traceId);
}

export default async function handler(request, response) {
  const traceId = traceIdFromRequest(request);
  if (request.method === 'OPTIONS') {
    response.status(204);
    setCommonHeaders(response, traceId);
    return response.end();
  }

  if (!process.env.SUPABASE_RENDERER_KEY) {
    return json(response, 503, {
      ok: false,
      error: 'SUPABASE_RENDERER_KEY não configurada na Vercel.'
    }, traceId);
  }

  try {
    const { config, supabase } = createStateClient();
    if (request.method === 'GET') return await readState(response, supabase, config, traceId);
    if (request.method === 'PUT') return await saveState(request, response, supabase, config, traceId);
    if (request.method === 'POST') {
      const body = requestBody(request);
      if (body.action === 'capture-next') {
        return await processCapture(request, response, traceId, 'dashboard');
      }
      if (body.action === 'capture-ppr') {
        return await processCapture(request, response, traceId, 'ppr');
      }
      if (body.action === 'alert-event') {
        return await appendAlertEvent(request, response, supabase, config, traceId);
      }
      return json(response, 400, { ok: false, error: 'Ação desconhecida.' }, traceId);
    }

    response.setHeader('Allow', 'GET, PUT, POST, OPTIONS');
    return json(response, 405, { ok: false, error: 'Método não permitido.' }, traceId);
  } catch (error) {
    logEvent('state-api', 'request.failed', {
      traceId,
      method: request.method,
      error: errorDetails(error)
    }, 'error');
    return json(response, 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }, traceId);
  }
}
