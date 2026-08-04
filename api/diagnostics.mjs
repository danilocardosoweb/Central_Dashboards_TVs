import { createClient } from '@supabase/supabase-js';

import { readConfiguration } from '../renderer/capture.mjs';
import { readResilientState } from '../renderer/state-store.mjs';
import {
  errorDetails,
  logEvent,
  summarizeStateRow,
  traceIdFromRequest
} from '../renderer/telemetry.mjs';

function belongsToArea(item, areaId) {
  if (areaId === '__all__') return true;
  const areaIds = Array.isArray(item?.areaIds) ? item.areaIds : [];
  if (!areaIds.length) return areaId === 'geral';
  return areaIds.includes('*') || areaIds.includes(areaId);
}

function pprSlideCount(ppr, station, areaId) {
  if (!ppr?.enabled) return 0;
  const stationIds = Array.isArray(ppr.stationIds) ? ppr.stationIds : ['*'];
  const areaIds = Array.isArray(ppr.areaIds) ? ppr.areaIds : ['*'];
  const stationMatch = !stationIds.length || stationIds.includes('*') || stationIds.includes(station?.id);
  const areaMatch = areaId === '__all__' || !areaIds.length || areaIds.includes('*') || areaIds.includes(areaId);
  if (!stationMatch || !areaMatch) return 0;
  const rendered = (Array.isArray(ppr.renderedSlides) ? ppr.renderedSlides : [])
    .filter(item => String(item?.imageUrl || '').startsWith('https://'));
  if (rendered.length) return rendered.length;
  const active = (Array.isArray(ppr.indicators) ? ppr.indicators : [])
    .filter(item => item?.enabled !== false)
    .filter(item => Number(item?.result) >= 0 && Number(item?.result) <= 150);
  let count = ppr.showSummary === false ? 0 : 1;
  if (ppr.showIndicators !== false && active.length) {
    count += ppr.displayMode === 'general' ? 1 : active.length;
  }
  return count || 1;
}

export function buildDiagnostics(row, source = 'storage') {
  const payload = row?.payload || {};
  const dashboards = Array.isArray(payload.urls) ? payload.urls : [];
  const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];
  const stations = Array.isArray(payload.stations) && payload.stations.length
    ? payload.stations
    : [{ id: 'station-default', name: 'Esta TV', areaId: 'geral' }];
  const warnings = [];

  dashboards.forEach((dashboard, index) => {
    if (dashboard?.enabled === false) return;
    if (!dashboard?.id) warnings.push(`Dashboard ${index + 1} sem id.`);
    if (!dashboard?.rokuImageUrl) warnings.push(`Dashboard ${dashboard?.name || index + 1} sem imagem Roku.`);
    else if (!String(dashboard.rokuImageUrl).startsWith('https://')) {
      warnings.push(`Dashboard ${dashboard?.name || index + 1} com imagem fora de HTTPS.`);
    }
    if (dashboard?.rokuCaptureStatus === 'error') {
      warnings.push(`Dashboard ${dashboard?.name || index + 1} com erro na última captura.`);
    }
  });

  if (payload.ppr?.enabled) {
    const sourceUpdatedAt = String(payload.ppr.updatedAt || '');
    const renderedSourceUpdatedAt = String(payload.ppr.renderSourceUpdatedAt || '');
    const rendered = Array.isArray(payload.ppr.renderedSlides)
      ? payload.ppr.renderedSlides
      : [];
    if (!rendered.length) warnings.push('PPR ativo sem imagens publicadas; o Roku usará a contingência nativa.');
    if (rendered.length && payload.ppr.renderStatus !== 'ready') {
      warnings.push('As imagens do PPR ainda não estão marcadas como prontas.');
    }
    if (payload.ppr.renderStatus === 'stale'
      || (rendered.length && sourceUpdatedAt && renderedSourceUpdatedAt !== sourceUpdatedAt)) {
      warnings.push('As imagens do PPR estão desatualizadas em relação aos dados da Central.');
    }
    rendered.forEach((slide, index) => {
      if (!String(slide?.imageUrl || '').startsWith('https://')) {
        warnings.push(`Imagem ${index + 1} do PPR fora de HTTPS.`);
      }
    });
  }

  const playlists = stations.map(station => {
    const areaId = station?.areaId || 'geral';
    const dashboardCount = dashboards.filter(item => item?.enabled !== false && belongsToArea(item, areaId)).length;
    const alertCount = alerts.filter(item => item?.enabled !== false && belongsToArea(item, areaId))
      .filter(item => String(item?.displayMode || 'fullscreen').toLowerCase() !== 'banner').length;
    const temporaryAlertCount = alerts.filter(item => item?.enabled !== false && belongsToArea(item, areaId))
      .filter(item => String(item?.displayMode || 'fullscreen').toLowerCase() === 'banner').length;
    const pprCount = pprSlideCount(payload.ppr, station, areaId);
    return {
      stationId: station?.id || 'station-default',
      stationName: station?.name || 'TV',
      areaId,
      dashboards: dashboardCount,
      ppr: pprCount,
      alerts: alertCount,
      temporaryAlerts: temporaryAlertCount,
      totalSlides: dashboardCount + pprCount + alertCount
    };
  });

  return {
    ok: warnings.length === 0 && playlists.every(item => item.totalSlides > 0),
    service: 'central-dashboards-diagnostics',
    version: 'diagnostics-v3-temporary-alerts',
    source,
    state: summarizeStateRow(row),
    playlists,
    warnings,
    generatedAt: new Date().toISOString()
  };
}

function send(response, status, body, traceId) {
  response.status(status);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('X-Central-Trace-Id', traceId);
  response.end(JSON.stringify({ ...body, traceId }));
}

export default async function handler(request, response) {
  const traceId = traceIdFromRequest(request);
  if (request.method !== 'GET') return send(response, 405, { ok: false, error: 'Use GET.' }, traceId);
  const startedAt = Date.now();
  try {
    const config = readConfiguration(process.env, []);
    const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    const result = await readResilientState(supabase, config, { databaseFallback: false });
    if (!result.row) return send(response, 404, { ok: false, error: 'Estado central ausente.' }, traceId);
    const diagnostics = buildDiagnostics(result.row, result.source);
    logEvent('diagnostics', 'generated', {
      traceId,
      elapsedMs: Date.now() - startedAt,
      ...diagnostics.state,
      playlistTotals: diagnostics.playlists.map(item => item.totalSlides),
      warningCount: diagnostics.warnings.length
    });
    return send(response, diagnostics.ok ? 200 : 207, diagnostics, traceId);
  } catch (error) {
    logEvent('diagnostics', 'failed', { traceId, elapsedMs: Date.now() - startedAt, error: errorDetails(error) }, 'error');
    return send(response, 500, { ok: false, error: error instanceof Error ? error.message : String(error) }, traceId);
  }
}
