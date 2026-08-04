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
  assert.match(xml, /<Rectangle id="bannerAccent"/);
  assert.match(xml, /<Rectangle id="bannerIconBackground"/);
  assert.match(xml, /<Label id="bannerCategory"/);
  assert.match(xml, /<Label id="bannerTitle"/);
  assert.match(xml, /<ScrollingLabel id="bannerScrollingBody"/);
  assert.match(xml, /<Timer id="temporaryAlertTimer"/);
  assert.match(xml, /<Animation id="temporaryAlertEnter"/);
  assert.match(xml, /<Animation id="temporaryAlertExit"/);
  assert.match(xml, /<Animation id="temporaryAlertPulse"/);
  assert.match(xml, /<Animation id="temporaryAlertBlink"/);
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

test('alerta trata o dashboard sem parar o temporizador do carrossel', () => {
  assert.match(xml, /fieldToInterp="contentGroup\.scale"/);
  assert.match(xml, /fieldToInterp="contentGroup\.opacity"/);
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
  assert.match(central, /id="alertBannerSize"/);
  assert.match(central, /value="compact"/);
  assert.match(central, /value="standard"/);
  assert.match(central, /value="large"/);
  assert.match(central, /id="alertBannerPosition"/);
  assert.match(central, /id="alertScrollSpeed"/);
  assert.match(central, /id="alertEntranceEffect"/);
  assert.match(central, /id="alertEmphasisEffect"/);
  assert.match(central, /id="alertDashboardTreatment"/);
});

test('datas de alertas usam UTC explicito e o Roku aceita registros legados', () => {
  assert.match(central, /function toUtcDateTimeValue\(/);
  assert.match(central, /date\.toISOString\(\)/);
  assert.match(scene, /date\.GetTimeZoneOffset\(\) \* 60/);
  assert.match(scene, /Len\(normalizedValue\) = 16/);
  assert.match(scene, /normalizedValue = normalizedValue \+ ":00"/);
  assert.match(scene, /date\.FromISO8601String\(normalizedValue\)/);
});

test('faixa possui tamanhos configuraveis e nao repete a mesma versao a cada sincronizacao', () => {
  assert.match(scene, /sub applyTemporaryAlertLayout\(/);
  assert.match(scene, /if size = "compact"/);
  assert.match(scene, /else if size = "large"/);
  assert.match(scene, /completedTemporaryAlertVersions/);
  assert.match(scene, /temporaryAlertVersion\(alert\)/);
  assert.match(central, /resetBrowserAlertCycle\(\)/);
});

test('faixa profissional respeita posicao, entrada, rolagem e destaque', () => {
  assert.match(scene, /scrollSpeed = LCase\(valueOr\(alert, "scrollSpeed", "normal"\)\)/);
  assert.match(scene, /m\.bannerScrollingBody\.scrollSpeed = 45/);
  assert.match(scene, /m\.bannerScrollingBody\.scrollSpeed = 120/);
  assert.match(scene, /bannerPosition = LCase\(valueOr\(alert, "bannerPosition", "bottom"\)\)/);
  assert.match(scene, /entranceEffect = LCase\(valueOr\(alert, "entranceEffect", "slide-up"\)\)/);
  assert.match(scene, /dashboardTreatment = LCase\(valueOr\(alert, "dashboardTreatment", "shrink"\)\)/);
  assert.match(scene, /sub startTemporaryAlertEmphasis\(/);
  assert.match(scene, /m\.temporaryAlertPulse\.control = "start"/);
  assert.match(scene, /m\.temporaryAlertBlink\.control = "start"/);
});

test('historico e assíncrono e não reinicia a programação', () => {
  assert.match(task, /AsyncPostFromString/);
  assert.match(api, /action === 'alert-event'/);
  assert.match(api, /appendAlertEvent/);
  assert.match(scene, /function statePlaybackSignature/);
  const signature = scene.slice(scene.indexOf('function statePlaybackSignature'), scene.indexOf('end function', scene.indexOf('function statePlaybackSignature')));
  assert.doesNotMatch(signature, /alertHistory/);
});
