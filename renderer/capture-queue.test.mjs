import assert from 'node:assert/strict';
import test from 'node:test';

import {
  captureProgress,
  claimNextCapture,
  completeCapture,
  createCaptureRequest
} from './capture-queue.mjs';

test('cria fila sem duplicar dashboards', () => {
  const payload = createCaptureRequest({ ppr: { enabled: true } }, {
    requestId: 'req-1',
    requestedAt: '2026-08-03T12:00:00.000Z',
    dashboards: [
      { id: 'a', name: 'A' },
      { id: 'a', name: 'A repetido' },
      { id: 'b', name: 'B' }
    ]
  });
  assert.equal(payload.ppr.enabled, true);
  assert.deepEqual(payload.capture.queue.map(item => item.id), ['a', 'b']);
  assert.equal(payload.capture.status, 'pending');
});

test('bloqueia concorrencia e recupera uma concessao vencida', () => {
  const initial = createCaptureRequest({}, {
    requestId: 'req-2',
    dashboards: [{ id: 'a' }, { id: 'b' }]
  });
  const first = claimNextCapture(initial, {
    now: '2026-08-03T12:00:00.000Z',
    leaseMs: 60000
  });
  assert.equal(first.claimed, true);
  assert.equal(first.dashboardId, 'a');

  const busy = claimNextCapture(first.payload, {
    now: '2026-08-03T12:00:30.000Z'
  });
  assert.equal(busy.reason, 'busy');

  const recovered = claimNextCapture(first.payload, {
    now: '2026-08-03T12:02:00.000Z'
  });
  assert.equal(recovered.claimed, true);
  assert.equal(recovered.dashboardId, 'a');
  assert.equal(recovered.payload.capture.queue[0].attempts, 2);
});

test('continua a fila e conclui mesmo quando um painel falha', () => {
  const initial = createCaptureRequest({}, {
    dashboards: [{ id: 'a' }, { id: 'b' }]
  });
  const first = claimNextCapture(initial, { now: '2026-08-03T12:00:00.000Z' });
  const afterFirst = completeCapture(first.payload, 'a', { ok: true });
  assert.equal(afterFirst.capture.status, 'pending');

  const second = claimNextCapture(afterFirst, { now: '2026-08-03T12:01:00.000Z' });
  const final = completeCapture(second.payload, 'b', { ok: false, error: 'timeout' });
  assert.equal(final.capture.status, 'partial');
  assert.deepEqual(captureProgress(final.capture), {
    requestId: final.capture.requestId,
    status: 'partial',
    total: 2,
    completed: 1,
    failed: 1,
    activeDashboardId: null
  });
});
