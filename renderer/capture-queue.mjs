const ACTIVE_STATUSES = new Set(['pending', 'running']);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asDate(value) {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function createCaptureRequest(payload, options = {}) {
  const source = asObject(payload);
  const requestedAt = options.requestedAt || new Date().toISOString();
  const requestId = String(options.requestId || `capture-${Date.now()}`);
  const dashboards = Array.isArray(options.dashboards) ? options.dashboards : [];
  const seen = new Set();
  const queue = dashboards
    .filter(item => item && item.id != null)
    .filter(item => {
      const id = String(item.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((item, index) => ({
      id: String(item.id),
      name: String(item.name || `Dashboard ${index + 1}`),
      status: 'pending',
      attempts: 0,
      startedAt: null,
      completedAt: null,
      error: null
    }));

  return {
    ...source,
    capture: {
      ...asObject(source.capture),
      requestId,
      requestedAt,
      requestedBy: String(options.requestedBy || 'Central Web'),
      status: queue.length ? 'pending' : 'complete',
      queue,
      total: queue.length,
      completed: 0,
      failed: 0,
      activeDashboardId: null,
      leaseUntil: null,
      completedAt: queue.length ? null : requestedAt
    }
  };
}

export function captureRequestIsActive(capture) {
  return ACTIVE_STATUSES.has(String(capture?.status || ''));
}

export function claimNextCapture(payload, options = {}) {
  const source = asObject(payload);
  const capture = asObject(source.capture);
  const now = options.now || new Date().toISOString();
  const nowMs = asDate(now) || Date.now();
  const leaseMs = Math.max(60000, Number(options.leaseMs) || 4 * 60 * 1000);
  const maxAttempts = Math.max(1, Number(options.maxAttempts) || 2);

  if (!captureRequestIsActive(capture) || !Array.isArray(capture.queue)) {
    return { claimed: false, reason: 'idle', payload: source };
  }

  const queue = capture.queue.map(item => ({ ...asObject(item) }));
  const activeId = capture.activeDashboardId == null
    ? ''
    : String(capture.activeDashboardId);
  const leaseActive = activeId && asDate(capture.leaseUntil) > nowMs;
  if (leaseActive) {
    return { claimed: false, reason: 'busy', payload: source, dashboardId: activeId };
  }

  if (activeId) {
    const stale = queue.find(item => String(item.id) === activeId && item.status === 'running');
    if (stale) {
      const dashboard = (Array.isArray(source.urls) ? source.urls : [])
        .find(item => String(item?.id) === activeId);
      const capturedAt = asDate(dashboard?.rokuCapturedAt);
      const startedAt = asDate(stale.startedAt);
      const imageWasPublished = dashboard?.rokuCaptureStatus === 'ok'
        && Boolean(dashboard?.rokuImageUrl)
        && capturedAt > 0
        && capturedAt >= startedAt;

      if (imageWasPublished) {
        stale.status = 'complete';
        stale.completedAt = dashboard.rokuCapturedAt;
        stale.error = null;
      } else if ((Number(stale.attempts) || 0) >= maxAttempts) {
        stale.status = 'error';
        stale.completedAt = now;
        stale.error = `Captura interrompida após ${maxAttempts} tentativas.`;
      } else {
        stale.status = 'pending';
      }
    }
  }

  const next = queue.find(item => item.status === 'pending');
  if (!next) {
    const failed = queue.filter(item => item.status === 'error').length;
    const completed = queue.filter(item => item.status === 'complete').length;
    return {
      claimed: false,
      reason: 'complete',
      payload: {
        ...source,
        capture: {
          ...capture,
          queue,
          status: failed ? 'partial' : 'complete',
          completed,
          failed,
          activeDashboardId: null,
          leaseUntil: null,
          completedAt: capture.completedAt || now
        }
      }
    };
  }

  next.status = 'running';
  next.attempts = (Number(next.attempts) || 0) + 1;
  next.startedAt = now;
  next.completedAt = null;
  next.error = null;

  return {
    claimed: true,
    dashboardId: String(next.id),
    payload: {
      ...source,
      capture: {
        ...capture,
        queue,
        status: 'running',
        activeDashboardId: String(next.id),
        leaseUntil: new Date(nowMs + leaseMs).toISOString(),
        workerUpdatedAt: now
      }
    }
  };
}

export function completeCapture(payload, dashboardId, result, completedAt = new Date().toISOString()) {
  const source = asObject(payload);
  const capture = asObject(source.capture);
  const id = String(dashboardId);
  const queue = (Array.isArray(capture.queue) ? capture.queue : []).map(item => {
    if (String(item?.id) !== id) return { ...asObject(item) };
    return {
      ...asObject(item),
      status: result?.ok ? 'complete' : 'error',
      completedAt,
      error: result?.ok ? null : String(result?.error || 'Falha na captura')
    };
  });
  const completed = queue.filter(item => item.status === 'complete').length;
  const failed = queue.filter(item => item.status === 'error').length;
  const pending = queue.some(item => item.status === 'pending' || item.status === 'running');

  return {
    ...source,
    capture: {
      ...capture,
      queue,
      status: pending ? 'pending' : failed ? 'partial' : 'complete',
      completed,
      failed,
      activeDashboardId: null,
      leaseUntil: null,
      workerUpdatedAt: completedAt,
      completedAt: pending ? null : completedAt
    }
  };
}

export function captureProgress(capture) {
  const queue = Array.isArray(capture?.queue) ? capture.queue : [];
  return {
    requestId: capture?.requestId || null,
    status: capture?.status || 'idle',
    total: queue.length || Number(capture?.total) || 0,
    completed: queue.filter(item => item?.status === 'complete').length,
    failed: queue.filter(item => item?.status === 'error').length,
    activeDashboardId: capture?.activeDashboardId || null
  };
}
