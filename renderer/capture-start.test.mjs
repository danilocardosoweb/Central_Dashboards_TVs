import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeCaptureStarts } from './capture.mjs';

test('registra a tentativa antes de abrir o Chromium', () => {
  const payload = {
    alerts: [{ id: 'alerta-1' }],
    urls: [{ id: 'dashboard-1' }, { id: 'dashboard-2' }]
  };
  const merged = mergeCaptureStarts(
    payload,
    [{ id: 'dashboard-2' }],
    '2026-08-03T15:00:00.000Z'
  );
  assert.deepEqual(merged.alerts, payload.alerts);
  assert.equal(merged.urls[0].rokuCaptureStatus, undefined);
  assert.equal(merged.urls[1].rokuCaptureStatus, 'processing');
  assert.equal(
    merged.urls[1].rokuCaptureAttemptedAt,
    '2026-08-03T15:00:00.000Z'
  );
  assert.deepEqual(merged.capture.dashboardIds, ['dashboard-2']);
});
