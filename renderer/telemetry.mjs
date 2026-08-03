import crypto from 'node:crypto';

export function traceIdFromRequest(request) {
  const incoming = String(
    request?.headers?.['x-central-trace-id'] ||
    request?.headers?.['x-vercel-id'] ||
    ''
  ).trim();
  return incoming.slice(0, 160) || crypto.randomUUID();
}

export function errorDetails(error) {
  return {
    name: error?.name || 'Error',
    message: error instanceof Error ? error.message : String(error)
  };
}

export function logEvent(scope, event, fields = {}, level = 'info') {
  const entry = {
    timestamp: new Date().toISOString(),
    scope,
    event,
    ...fields
  };
  const output = JSON.stringify(entry);
  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
  return entry;
}

export function summarizeStateRow(row) {
  const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {};
  const urls = Array.isArray(payload.urls) ? payload.urls : [];
  const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];
  const stations = Array.isArray(payload.stations) ? payload.stations : [];
  const indicators = Array.isArray(payload.ppr?.indicators)
    ? payload.ppr.indicators
    : [];
  const queue = Array.isArray(payload.capture?.queue) ? payload.capture.queue : [];
  return {
    revision: Number(row?.revision) || 0,
    updatedAt: row?.updated_at || null,
    dashboards: urls.length,
    dashboardsEnabled: urls.filter(item => item?.enabled !== false).length,
    dashboardsWithImage: urls.filter(item => Boolean(item?.rokuImageUrl)).length,
    dashboardsWithCaptureError: urls.filter(item => item?.rokuCaptureStatus === 'error').length,
    alerts: alerts.length,
    alertsEnabled: alerts.filter(item => item?.enabled !== false).length,
    stations: stations.length,
    pprEnabled: payload.ppr?.enabled === true,
    pprIndicators: indicators.length,
    pprIndicatorsEnabled: indicators.filter(item => item?.enabled !== false).length,
    capture: {
      requestId: payload.capture?.requestId || null,
      status: payload.capture?.status || 'idle',
      total: queue.length || Number(payload.capture?.total) || 0,
      completed: queue.filter(item => item?.status === 'complete').length,
      failed: queue.filter(item => item?.status === 'error').length,
      activeDashboardId: payload.capture?.activeDashboardId || null
    }
  };
}
