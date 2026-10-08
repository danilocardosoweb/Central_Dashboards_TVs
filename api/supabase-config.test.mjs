import assert from 'node:assert/strict';
import test from 'node:test';

import handler from './supabase-config.mjs';

function invoke(method = 'GET') {
  const result = { status: 0, body: null, headers: {} };
  const response = {
    setHeader(name, value) { result.headers[name] = value; return this; },
    status(value) { result.status = value; return this; },
    json(value) { result.body = value; return this; }
  };
  handler({ method }, response);
  return result;
}

function withConfig(url, key, action) {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const previousAnon = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = url;
  process.env.SUPABASE_PUBLISHABLE_KEY = key;
  delete process.env.SUPABASE_ANON_KEY;
  try {
    return action();
  } finally {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = previousKey;
    if (previousAnon === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = previousAnon;
  }
}

test('expõe somente a configuração pública do projeto selecionado', () => {
  withConfig('https://original.supabase.co/', 'sb_publishable_example', () => {
    const result = invoke();
    assert.equal(result.status, 200);
    assert.equal(result.body.configured, true);
    assert.equal(result.body.url, 'https://original.supabase.co');
    assert.equal(result.body.publishableKey, 'sb_publishable_example');
    assert.equal(result.headers['Cache-Control'], 'no-store');
  });
});

test('nunca entrega uma chave secreta ao navegador', () => {
  withConfig('https://original.supabase.co', 'sb_secret_example', () => {
    const result = invoke();
    assert.equal(result.body.configured, false);
    assert.equal(result.body.publishableKey, '');
  });
});

test('recusa métodos que alteram a configuração', () => {
  withConfig('https://original.supabase.co', 'sb_publishable_example', () => {
    assert.equal(invoke('POST').status, 405);
  });
});
