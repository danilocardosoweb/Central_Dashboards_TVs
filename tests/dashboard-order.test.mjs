import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const central = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const rokuScene = fs.readFileSync(
  new URL('../roku/components/MainScene.brs', import.meta.url),
  'utf8'
);

test('Central permite ordenar dashboards por arraste e por botoes', () => {
  assert.match(central, /function moveDashboard\(index, direction\)/);
  assert.match(central, /function reorderDashboard\(fromIndex, toIndex\)/);
  assert.match(central, /dashboard-drag-handle/);
  assert.match(central, /Mover dashboard para cima/);
  assert.match(central, /Mover dashboard para baixo/);
});

test('nova ordem e persistida e atualiza a apresentacao', () => {
  assert.match(central, /function persistDashboardOrder\(message = ''\)/);
  assert.match(central, /item\.order = index \+ 1/);
  assert.match(central, /localStorage\.setItem\('dashboardUrls', JSON\.stringify\(urls\)\)/);
  assert.match(central, /persistDashboardOrder[\s\S]*?createSlides\(\)/);
});

test('Roku preserva a sequencia recebida da Central', () => {
  assert.match(rokuScene, /urls = arrayOrEmpty\(valueOr\(m\.state, "urls", \[\]\)\)/);
  assert.match(rokuScene, /for each dashboard in urls/);
  assert.match(rokuScene, /dashboardSlides\.Push\(/);
});

test('controles permanecem visiveis durante o PPR', () => {
  const pprRule = central.match(
    /body\.ppr-presenting \.station-status-chip,[\s\S]*?body\.ppr-presenting \.control-buttons \{[\s\S]*?\}/
  );
  assert.ok(pprRule, 'regra visual do PPR deve existir');
  assert.match(pprRule[0], /opacity:\s*1/);
  assert.match(pprRule[0], /pointer-events:\s*auto/);
  assert.doesNotMatch(pprRule[0], /pointer-events:\s*none/);
});
