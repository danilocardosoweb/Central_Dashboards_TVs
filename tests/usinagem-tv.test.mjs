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
  assert.match(html, /function setUsinagemTvScreenStations\(index, stationIds\)/);
  assert.match(html, /function setUsinagemTvScreenDuration\(index, value\)/);
  assert.match(html, /Tempo na TV/);
  assert.match(html, /iframe\.dataset\.duration/);
  assert.match(html, /globalLabel: 'Todas as TVs'/);
});

test('telas desativadas não entram na rotação web', () => {
  assert.match(html, /urls\s*\n?\s*\.filter\(item => item\?\.enabled !== false\)/);
});

test('prévia administrativa preserva a leitura em formato compacto', () => {
  const screen = fs.readFileSync(new URL('../dashboards/usinagem-tv.mjs', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../dashboards/usinagem-tv.css', import.meta.url), 'utf8');
  assert.match(screen, /previewMode/);
  assert.match(screen, /document\.body\.classList\.add\('preview-mode'\)/);
  assert.match(html, /usinagem-tv-screen-preview[^}]*aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(css, /\.preview-mode \.panel-grid/);
});
