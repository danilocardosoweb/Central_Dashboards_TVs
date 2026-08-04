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

test('abandona painel após duas interrupções e continua no próximo', () => {
  const initial = createCaptureRequest({}, {
    requestId: 'req-stale',
    dashboards: [{ id: 'a' }, { id: 'b' }]
  });
  const first = claimNextCapture(initial, {
    now: '2026-08-03T12:00:00.000Z',
    leaseMs: 60000
  });
  const retry = claimNextCapture(first.payload, {
    now: '2026-08-03T12:02:00.000Z',
    leaseMs: 60000
  });
  const continued = claimNextCapture(retry.payload, {
    now: '2026-08-03T12:04:00.000Z',
    leaseMs: 60000
  });

  assert.equal(continued.claimed, true);
  assert.equal(continued.dashboardId, 'b');
  assert.equal(continued.payload.capture.queue[0].status, 'error');
  assert.match(continued.payload.capture.queue[0].error, /2 tentativas/);
  assert.equal(continued.payload.capture.queue[1].status, 'running');
});

test('reconcilia imagem publicada antes de repetir uma captura interrompida', () => {
  const initial = createCaptureRequest({
    urls: [{ id: 'a' }, { id: 'b' }]
  }, {
    requestId: 'req-uploaded',
    dashboards: [{ id: 'a' }, { id: 'b' }]
  });
  const first = claimNextCapture(initial, {
    now: '2026-08-03T12:00:00.000Z',
    leaseMs: 60000
  });
  const afterUpload = {
    ...first.payload,
    urls: [
      {
        id: 'a',
        rokuCaptureStatus: 'ok',
        rokuImageUrl: 'https://cdn.example/a.png',
        rokuCapturedAt: '2026-08-03T12:00:30.000Z'
      },
      { id: 'b' }
    ]
  };
  const reconciled = claimNextCapture(afterUpload, {
    now: '2026-08-03T12:02:00.000Z',
    leaseMs: 60000
  });

  assert.equal(reconciled.claimed, true);
  assert.equal(reconciled.dashboardId, 'b');
  assert.equal(reconciled.payload.capture.queue[0].status, 'complete');
  assert.equal(reconciled.payload.capture.queue[0].attempts, 1);
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
