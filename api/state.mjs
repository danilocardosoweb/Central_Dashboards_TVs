import { createClient } from '@supabase/supabase-js';

import { readConfiguration } from '../renderer/capture.mjs';
import {
  readResilientState,
  updateResilientState
} from '../renderer/state-store.mjs';

const MAX_STATE_BYTES = 8 * 1024 * 1024;

function setCommonHeaders(response) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
}

function json(response, status, payload) {
  response.status(status);
  setCommonHeaders(response);
  response.end(JSON.stringify(payload));
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

async function readState(response, supabase, config) {
  const result = await readResilientState(supabase, config, {
    databaseFallback: false
  });
  if (!result.row) {
    return json(response, 404, {
      ok: false,
      missing: true,
      source: result.source,
      message: 'O estado central ainda não foi criado no Storage.'
    });
  }
  return json(response, 200, {
    ...result.row,
    source: result.source,
    service: 'central-dashboards-state',
    version: 'storage-v3'
  });
}

async function saveState(request, response, supabase, config) {
  const body = requestBody(request);
  const payload = body.payload && typeof body.payload === 'object'
    ? body.payload
    : null;
  if (!payload) {
    return json(response, 400, { ok: false, error: 'Payload inválido.' });
  }

  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_STATE_BYTES) {
    return json(response, 413, {
      ok: false,
      error: 'A configuração ultrapassou o limite de 8 MB.'
    });
  }

  const result = await updateResilientState(
    supabase,
    config,
    () => payload,
    {
      expectedRevision: body.expectedRevision,
      updatedAt: body.updatedAt,
      databaseFallback: false
    }
  );
  if (result.conflict) {
    return json(response, 409, {
      ok: false,
      conflict: true,
      row: result.row,
      error: 'A configuração mudou em outro dispositivo.'
    });
  }

  return json(response, 200, {
    ...result.row,
    ok: true,
    source: 'storage',
    service: 'central-dashboards-state',
    version: 'storage-v3'
  });
}

async function processNextCapture(request, response) {
  if (!process.env.CAPTURE_API_SECRET) {
    return json(response, 503, {
      ok: false,
      error: 'CAPTURE_API_SECRET não configurada na Vercel.'
    });
  }

  const captureResponse = await fetch(captureEndpoint(request), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CAPTURE_API_SECRET}`,
      'Content-Type': 'application/json'
    },
    body: '{}'
  });
  const payload = await captureResponse.json().catch(() => ({
    ok: false,
    error: `Capturador retornou ${captureResponse.status}.`
  }));
  return json(response, captureResponse.status, payload);
}

export default async function handler(request, response) {
  if (request.method === 'OPTIONS') {
    response.status(204);
    setCommonHeaders(response);
    return response.end();
  }

  if (!process.env.SUPABASE_RENDERER_KEY) {
    return json(response, 503, {
      ok: false,
      error: 'SUPABASE_RENDERER_KEY não configurada na Vercel.'
    });
  }

  try {
    const { config, supabase } = createStateClient();
    if (request.method === 'GET') {
      return await readState(response, supabase, config);
    }
    if (request.method === 'PUT') {
      return await saveState(request, response, supabase, config);
    }
    if (request.method === 'POST') {
      const body = requestBody(request);
      if (body.action === 'capture-next') {
        return await processNextCapture(request, response);
      }
      return json(response, 400, { ok: false, error: 'Ação desconhecida.' });
    }

    response.setHeader('Allow', 'GET, PUT, POST, OPTIONS');
    return json(response, 405, { ok: false, error: 'Método não permitido.' });
  } catch (error) {
    console.error('[estado] Falha geral:', error);
    return json(response, 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
