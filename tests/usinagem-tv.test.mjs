import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('Central lista as telas da Usinagem com prévia e controle de rotação', () => {
  assert.match(html, /id="usinagemTvScreenList"/);
  assert.match(html, /function renderUsinagemTvScreenList\(\)/);
  assert.match(html, /function toggleUsinagemTvScreen\(index, enabled\)/);
  assert.match(html, /Participa da rotação/);
  assert.match(html, /item\.enabled = Boolean\(enabled\)/);
});

test('telas desativadas não entram na rotação web', () => {
  assert.match(html, /urls\s*\n?\s*\.filter\(item => item\?\.enabled !== false\)/);
});
