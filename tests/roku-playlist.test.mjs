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
const fetchTask = fs.readFileSync(
  new URL('../roku/components/FetchStateTask.brs', import.meta.url),
  'utf8'
);

test('Roku consulta a API de estado sem chave embutida', () => {
  assert.match(scene, /central-dashboards-t-vs\.vercel\.app\/api\/state/);
  assert.doesNotMatch(scene, /supabase\.co\/rest\/v1\/tv_app_state/);
  assert.doesNotMatch(scene, /sb_publishable_/);
  assert.match(fetchTask, /GetResponseCode\(\)/);
});

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

test('sincronizacao preserva o slide atual quando outro item foi atualizado', () => {
  assert.match(scene, /m\.preservePlaybackOnBuild = m\.state <> invalid/);
  assert.match(scene, /previousSlideSignature = FormatJson\(previousSlide\)/);
  assert.match(scene, /preservedIndex = findSlideIndex\(m\.slides, previousSlide\)/);
  assert.match(scene, /if currentSlideSignature = previousSlideSignature/);
  assert.match(scene, /updateSlideStatus\(\)\s+return/);
});

test('abertura sempre libera a camada de video antes do carrossel', () => {
  assert.match(xml, /id="introFallbackTimer"/);
  assert.match(xml, /id="introVideo"[\s\S]*?loop="false"/);
  assert.match(scene, /state = "finished" or state = "error" or state = "stopped"/);
  assert.match(scene, /m\.introVideo\.visible = false/);
  assert.match(scene, /m\.introVideo\.content = invalid/);
  assert.match(scene, /if key = "OK" or key = "back"[\s\S]*?finishIntroVideo\(\)/);
});

test('Roku consulta atualizacoes sem intervalo agressivo', () => {
  assert.match(xml, /id="syncTimer" duration="60"/);
});
