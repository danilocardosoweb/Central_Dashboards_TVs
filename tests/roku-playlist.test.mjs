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

test('combina dashboards, alertas e PPR sem substituicao', () => {
  assert.match(scene, /appendSlides\(m\.slides, dashboardSlides\)/);
  assert.match(scene, /appendSlides\(m\.slides, alertSlides\)/);
  assert.match(scene, /appendSlides\(m\.slides, pprSlides\)/);
  assert.match(scene, /if pprTargetsStation\(ppr, m\.currentStation, areaId\)/);
  assert.match(scene, /if result\.Count\(\) = 0/);
});

test('todos os avisos em faixa participam da rotacao', () => {
  assert.match(scene, /bannerAlerts\.Push\(alert\)/);
  assert.match(scene, /sub renderActiveBanner\(\)/);
  assert.match(scene, /index mod m\.bannerAlerts\.Count\(\)/);
});

test('sincroniza quando updated_at muda mesmo sem nova revisao', () => {
  assert.match(scene, /m\.lastUpdatedAt = ""/);
  assert.match(scene, /revision = m\.lastRevision and updatedAt = m\.lastUpdatedAt/);
});
