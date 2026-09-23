import assert from 'node:assert/strict';
import test from 'node:test';

import handler from './usinagem-config.mjs';

function token(role) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role })}.signature`;
}

function call(env) {
  const previous = {
    url: process.env.VITE_USINAGEM_SUPABASE_URL,
    key: process.env.VITE_USINAGEM_SUPABASE_ANON_KEY
  };
  Object.assign(process.env, {
    VITE_USINAGEM_SUPABASE_URL: env.url,
    VITE_USINAGEM_SUPABASE_ANON_KEY: env.key
  });
  const result = { statusCode: 0, body: null };
  handler({ method: 'GET' }, {
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; }
  });
  if (previous.url === undefined) delete process.env.VITE_USINAGEM_SUPABASE_URL;
  else process.env.VITE_USINAGEM_SUPABASE_URL = previous.url;
  if (previous.key === undefined) delete process.env.VITE_USINAGEM_SUPABASE_ANON_KEY;
  else process.env.VITE_USINAGEM_SUPABASE_ANON_KEY = previous.key;
  return result;
}

test('rejects service_role keys and never returns them', () => {
  const result = call({ url: 'https://usi.example', key: token('service_role') });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.configured, false);
  assert.equal(result.body.anonKey, '');
  assert.match(result.body.error, /chave pública/);
});

test('accepts a public anon key for the browser client', () => {
  const key = token('anon');
  const result = call({ url: 'https://usi.example', key });
  assert.equal(result.body.configured, true);
  assert.equal(result.body.anonKey, key);
  assert.equal(result.body.error, undefined);
});
