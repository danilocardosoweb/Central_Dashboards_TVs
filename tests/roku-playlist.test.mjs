import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const scene = fs.readFileSync(
  new URL('../roku/components/MainScene.brs', import.meta.url),
  'utf8'
);
const xml = fs.readFileSync(
  new URL('../roku/components/MainScene.xml', import.meta.url),
  'utf8'
);

test('playlist adiciona todos os dashboards compatíveis com a área', () => {
  assert.match(scene, /for each dashboard in urls/);
  assert.match(scene, /dashboardSlides\.Push\(/);
  assert.match(scene, /appendSlides\(m\.slides, dashboardSlides\)/);
});

test('carregamento de imagem possui watchdog e não força quadro incompleto', () => {
  assert.match(xml, /id="imageLoadTimer"/);
  assert.match(scene, /sub onImageLoadTimer\(/);
  assert.match(scene, /sub cancelPendingImage\(/);
  assert.match(scene, /m\.imageLoadTimer\.control = "start"/);
  assert.doesNotMatch(scene, /if target\.loadStatus = "ready" then beginImageTransition\(\)/);
});
