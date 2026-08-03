import assert from 'node:assert/strict';
import test from 'node:test';

import { summarizeStateRow, traceIdFromRequest } from '../renderer/telemetry.mjs';

test('trace id preserves correlation header', () => {
  assert.equal(traceIdFromRequest({ headers: { 'x-central-trace-id': 'trace-123' } }), 'trace-123');
});

test('state summary exposes counts without leaking dashboard URLs', () => {
  const summary = summarizeStateRow({
    revision: 3,
    payload: { urls: [{ enabled: true, rokuImageUrl: 'https://private.test/x.png' }] }
  });
  assert.equal(summary.dashboards, 1);
  assert.equal(summary.dashboardsWithImage, 1);
  assert.equal(JSON.stringify(summary).includes('private.test'), false);
});
