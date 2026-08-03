import assert from 'node:assert/strict';
import test from 'node:test';

import { validateState } from '../scripts/audit-e2e.mjs';

test('state audit does not impose a fixed dashboard limit', () => {
  const dashboards = Array.from({ length: 12 }, (_, index) => ({
    id: `d${index}`,
    enabled: true,
    rokuImageUrl: `https://cdn.test/d${index}.png`
  }));
  const result = validateState({ revision: 12, payload: { urls: dashboards } });
  assert.equal(result.ok, true);
  assert.equal(result.counts.dashboards, 12);
});

test('state audit rejects missing image URL', () => {
  const result = validateState({ revision: 1, payload: { urls: [{ id: 'd1', enabled: true }] } });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /sem imagem HTTPS/);
});
