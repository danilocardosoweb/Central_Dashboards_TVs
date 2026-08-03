import assert from 'node:assert/strict';
import test from 'node:test';

import handler, { isAuthorized, sanitizedSummary } from './capture.mjs';

test('aceita somente o segredo Bearer completo', () => {
  assert.equal(isAuthorized('Bearer segredo-forte', 'segredo-forte'), true);
  assert.equal(isAuthorized('Bearer segredo', 'segredo-forte'), false);
  assert.equal(isAuthorized('segredo-forte', 'segredo-forte'), false);
  assert.equal(isAuthorized(undefined, 'segredo-forte'), false);
});

test('remove buffers e detalhes internos da resposta HTTP', () => {
  const summary = sanitizedSummary({
    successes: 1,
    failures: 0,
    results: [{
      id: 'dashboard-1',
      name: 'Produção',
      ok: true,
      capturedAt: '2026-07-31T12:00:00.000Z',
      appliedZoom: '89%',
      image: Buffer.from('não deve sair')
    }]
  }, 1234);

  assert.equal(summary.ok, true);
  assert.equal(summary.elapsedMs, 1234);
  assert.equal('image' in summary.dashboards[0], false);
});

test('GET informa a versao segura do capturador', async () => {
  const output = { statusCode: 0, headers: {}, body: '' };
  const response = {
    status(value) { output.statusCode = value; return this; },
    setHeader(key, value) { output.headers[key] = value; },
    end(value) { output.body = value; }
  };
  await handler({ method: 'GET', headers: {} }, response);
  const body = JSON.parse(output.body);
  assert.equal(output.statusCode, 200);
  assert.equal(body.service, 'central-dashboards-capture');
  assert.equal(body.version, 'flow-v4');
  assert.equal('SUPABASE_RENDERER_KEY' in body, false);
});
