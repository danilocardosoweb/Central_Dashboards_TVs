import { createClient } from '@supabase/supabase-js';

import { readConfiguration } from '../renderer/capture.mjs';
import { readResilientState } from '../renderer/state-store.mjs';
import { errorDetails, logEvent, traceIdFromRequest } from '../renderer/telemetry.mjs';

const ONLINE_AFTER_SECONDS = 150;
const UNSTABLE_AFTER_SECONDS = 300;
const PRESENCE_PREFIX = 'presence';

function setHeaders(response, traceId = '') {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Central-Trace-Id');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (traceId) response.setHeader('X-Central-Trace-Id', traceId);
}

function sendJson(response, status, payload, traceId = '') {
  response.status(status);
  setHeaders(response, traceId);
  response.end(JSON.stringify(traceId ? { ...payload, traceId } : payload));
}

function bodyFromRequest(request) {
  if (!request.body) return {};
  if (typeof request.body === 'string') {
    try { return JSON.parse(request.body); } catch { return {}; }
  }
  return request.body;
}

function safeText(value, maxLength = 160) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

function safeStationKey(stationId) {
  return safeText(stationId, 120).replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function normalizeHeartbeat(input = {}, now = new Date()) {
  if (!input || typeof input !== 'object') return null;
  const stationId = safeText(input.stationId, 120);
  if (!stationId) return null;
  return {
    stationId,
    stationName: safeText(input.stationName, 120),
    areaId: safeText(input.areaId, 120),
    selectionKind: safeText(input.selectionKind, 24) || 'station',
    installationId: safeText(input.installationId, 120),
    sessionId: safeText(input.sessionId, 120),
    appVersion: safeText(input.appVersion, 32),
    currentIndex: Math.max(0, Number(input.currentIndex) || 0),
    playlistCount: Math.max(0, Number(input.playlistCount) || 0),
    currentType: safeText(input.currentType, 40),
    currentTitle: safeText(input.currentTitle, 160),
    stateRevision: Math.max(0, Number(input.stateRevision) || 0),
    stateSource: safeText(input.stateSource, 32),
    lastError: safeText(input.lastError, 300),
    uptimeSeconds: Math.max(0, Number(input.uptimeSeconds) || 0),
    playbackAgeSeconds: Math.max(0, Number(input.playbackAgeSeconds) || 0),
    recoveryCount: Math.max(0, Number(input.recoveryCount) || 0),
    playerState: safeText(input.playerState, 40),
    receivedAt: now.toISOString()
  };
}

export function classifyPresence(heartbeat, now = new Date()) {
  if (!heartbeat?.receivedAt) return { status: 'offline', ageSeconds: null };
  const ageSeconds = Math.max(0, Math.floor((now.getTime() - Date.parse(heartbeat.receivedAt)) / 1000));
  if (!Number.isFinite(ageSeconds)) return { status: 'offline', ageSeconds: null };
  if (ageSeconds <= ONLINE_AFTER_SECONDS) return { status: 'online', ageSeconds };
  if (ageSeconds <= UNSTABLE_AFTER_SECONDS) return { status: 'unstable', ageSeconds };
  return { status: 'offline', ageSeconds };
}

function presenceObject(stationId) {
  return `${PRESENCE_PREFIX}/${safeStationKey(stationId)}.json`;
}

async function downloadPresence(supabase, bucket, stationId) {
  const { data, error } = await supabase.storage.from(bucket).download(presenceObject(stationId));
  if (error) {
    const status = Number(error.statusCode || error.status || 0);
    const message = String(error.message || '').toLowerCase();
    if (status === 404 || message.includes('not found')) return null;
    throw error;
  }
  try { return JSON.parse(await data.text()); } catch { return null; }
}

async function readStations(supabase, config) {
  const result = await readResilientState(supabase, config, { databaseFallback: false });
  const stations = Array.isArray(result.row?.payload?.stations) ? result.row.payload.stations : [];
  if (stations.length) return stations;
  return [{ id: 'station-default', name: 'Esta TV', areaId: 'geral' }];
}

function normalizeStationName(value) {
  return safeText(value, 120).toLocaleLowerCase('pt-BR');
}

export function resolveHeartbeatStation(stations, heartbeat) {
  const direct = stations.find(station => String(station.id) === heartbeat.stationId);
  if (direct) return { station: direct, matchedBy: 'id' };

  const wantedName = normalizeStationName(heartbeat.stationName);
  if (!wantedName) return { station: null, matchedBy: 'none' };
  const byName = stations.filter(station => normalizeStationName(station.name) === wantedName);
  if (byName.length === 1) return { station: byName[0], matchedBy: 'name' };
  return { station: null, matchedBy: 'none' };
}

export default async function handler(request, response) {
  const traceId = traceIdFromRequest(request);
  if (request.method === 'OPTIONS') {
    response.status(204); setHeaders(response, traceId); return response.end();
  }
  if (!process.env.SUPABASE_RENDERER_KEY) {
    return sendJson(response, 503, { ok: false, error: 'SUPABASE_RENDERER_KEY não configurada.' }, traceId);
  }

  try {
    const config = readConfiguration(process.env, []);
    const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    const stations = await readStations(supabase, config);

    if (request.method === 'POST') {
      const heartbeat = normalizeHeartbeat(bodyFromRequest(request));
      if (!heartbeat) return sendJson(response, 400, { ok: false, error: 'Heartbeat inválido.' }, traceId);
      const match = resolveHeartbeatStation(stations, heartbeat);
      if (!match.station && !heartbeat.stationId.startsWith('area-')) {
        return sendJson(response, 409, {
          ok: false,
          error: 'Estação não reconhecida. No Roku, abra Opções e escolha esta TV novamente.'
        }, traceId);
      }
      const resolvedHeartbeat = match.station
        ? {
            ...heartbeat,
            reportedStationId: heartbeat.stationId,
            stationId: String(match.station.id),
            stationName: String(match.station.name || heartbeat.stationName),
            areaId: String(match.station.areaId || heartbeat.areaId),
            matchedBy: match.matchedBy
          }
        : heartbeat;
      const { error } = await supabase.storage.from(config.stateBucket).upload(
        presenceObject(resolvedHeartbeat.stationId),
        Buffer.from(JSON.stringify(resolvedHeartbeat), 'utf8'),
        { contentType: 'application/json', cacheControl: '0', upsert: true }
      );
      if (error) throw new Error(`Falha ao registrar presença: ${error.message}`);
      logEvent('tv-status-api', 'heartbeat.saved', {
        traceId, stationId: resolvedHeartbeat.stationId, currentIndex: resolvedHeartbeat.currentIndex,
        playlistCount: resolvedHeartbeat.playlistCount, stateRevision: resolvedHeartbeat.stateRevision,
        matchedBy: match.matchedBy
      });
      return sendJson(response, 200, {
        ok: true,
        receivedAt: resolvedHeartbeat.receivedAt,
        stationId: resolvedHeartbeat.stationId,
        matchedBy: match.matchedBy
      }, traceId);
    }

    if (request.method === 'GET') {
      const now = new Date();
      const rows = await Promise.all(stations.map(async station => {
        const heartbeat = await downloadPresence(supabase, config.stateBucket, station.id);
        const health = classifyPresence(heartbeat, now);
        return {
          id: String(station.id), name: String(station.name || 'TV'),
          areaId: String(station.areaId || 'geral'), localIp: String(station.localIp || ''),
          ...health, heartbeat
        };
      }));
      const counts = rows.reduce((result, row) => {
        result[row.status] += 1; return result;
      }, { online: 0, unstable: 0, offline: 0 });
      return sendJson(response, 200, { ok: true, serverTime: now.toISOString(), counts, stations: rows }, traceId);
    }

    response.setHeader('Allow', 'GET, POST, OPTIONS');
    return sendJson(response, 405, { ok: false, error: 'Método não permitido.' }, traceId);
  } catch (error) {
    logEvent('tv-status-api', 'request.failed', { traceId, error: errorDetails(error) }, 'error');
    return sendJson(response, 500, { ok: false, error: error instanceof Error ? error.message : String(error) }, traceId);
  }
}
