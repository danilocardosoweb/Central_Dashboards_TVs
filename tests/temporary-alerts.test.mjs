import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const scene = fs.readFileSync(new URL('../roku/components/MainScene.brs', import.meta.url), 'utf8');
const xml = fs.readFileSync(new URL('../roku/components/MainScene.xml', import.meta.url), 'utf8');
const central = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../api/state.mjs', import.meta.url), 'utf8');
const task = fs.readFileSync(new URL('../roku/components/AlertEventTask.brs', import.meta.url), 'utf8');

test('faixa temporaria usa apenas componentes SceneGraph nativos', () => {
  assert.match(xml, /<Rectangle id="bannerBackground"/);
  assert.match(xml, /<Label id="bannerTitle"/);
  assert.match(xml, /<ScrollingLabel id="bannerScrollingBody"/);
  assert.match(xml, /<Timer id="temporaryAlertTimer"/);
  assert.match(xml, /<Animation id="temporaryAlertEnter"/);
  assert.match(xml, /<Animation id="temporaryAlertExit"/);
});

test('fila prioriza critico, atencao e informativo e respeita repeticoes', () => {
  assert.match(scene, /return 300/);
  assert.match(scene, /return 200/);
  assert.match(scene, /return 100/);
  assert.match(scene, /for repeatIndex = 1 to repetitions/);
  assert.match(scene, /m\.temporaryAlertQueue\.Push\(alert\)/);
  assert.match(scene, /m\.temporaryAlertQueue\.Shift\(\)/);
  assert.match(scene, /if not stillActive then hideTemporaryAlert\("deactivated"\)/);
  assert.match(scene, /if not isCurrentAlert/);
});

test('alerta redimensiona conteudo sem parar o temporizador do carrossel', () => {
  assert.match(xml, /fieldToInterp="contentGroup\.scale"/);
  assert.match(xml, /keyValue="\[\[1\.0,1\.0\],\[0\.8,0\.8\]\]"/);
  const subsystem = scene.slice(scene.indexOf('sub configureTemporaryAlerts'), scene.indexOf('sub renderBanner'));
  assert.doesNotMatch(subsystem, /slideTimer\.control/);
  assert.match(scene, /if m\.introPlaying then return/);
});

test('destino aceita todas as TVs, setor ou TV especifica', () => {
  assert.match(central, /id="alertTargetType"/);
  assert.match(central, /value="all"/);
  assert.match(central, /value="area"/);
  assert.match(central, /value="station"/);
  assert.match(scene, /function alertTargetsStation/);
  assert.match(scene, /targetListMatches\(stationIds, stationId\)/);
  assert.match(scene, /targetListMatches\(areaIds, areaId\)/);
});

test('Central oferece ciclo completo e historico de alertas', () => {
  assert.match(central, /id="alertTextMode"/);
  assert.match(central, /id="alertRepetitions"/);
  assert.match(central, /function editAlert\(/);
  assert.match(central, /function toggleAlert\(/);
  assert.match(central, /function endAlert\(/);
  assert.match(central, /id="alertHistoryList"/);
  assert.match(central, /function renderAlertHistory\(/);
});

test('historico e assíncrono e não reinicia a programação', () => {
  assert.match(task, /AsyncPostFromString/);
  assert.match(api, /action === 'alert-event'/);
  assert.match(api, /appendAlertEvent/);
  assert.match(scene, /function statePlaybackSignature/);
  const signature = scene.slice(scene.indexOf('function statePlaybackSignature'), scene.indexOf('end function', scene.indexOf('function statePlaybackSignature')));
  assert.doesNotMatch(signature, /alertHistory/);
});
