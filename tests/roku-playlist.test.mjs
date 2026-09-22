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
  assert.match(scene, /allowed = dashboardTargetsStation\(dashboard, m\.currentStation, areaId\)/);
  assert.match(scene, /if isDashboardActive\(dashboard\) and allowed/);
  assert.match(scene, /function dashboardTargetsStation/);
  assert.match(scene, /dashboardSlides\.Push\(/);
  assert.match(scene, /appendSlides\(m\.slides, dashboardSlides\)/);
});

test('carregamento de imagem possui watchdog e não força quadro incompleto', () => {
  assert.match(xml, /id="imageLoadTimer"/);
  assert.match(scene, /sub onImageLoadTimer\(/);
  assert.match(scene, /sub cancelPendingImage\(/);
  assert.match(scene, /m\.imageLoadTimer\.control = "start"/);
  assert.match(scene, /function retryPendingImage\(\) as boolean/);
  assert.match(scene, /roku_retry=/);
  assert.match(scene, /sub showImageLoadFailure\(slide as dynamic\)/);
  assert.match(scene, /renderDashboardLoadFailure\(slide\)/);
  assert.match(xml, /id="imageLoadTimer" duration="8"/);
  assert.doesNotMatch(scene, /if target\.loadStatus = "ready" then beginImageTransition\(\)/);
});

test('combina dashboards, alertas e PPR sem substituicao', () => {
  assert.match(scene, /appendSlides\(m\.slides, dashboardSlides\)/);
  assert.match(scene, /appendSlides\(m\.slides, alertSlides\)/);
  assert.match(scene, /appendSlides\(m\.slides, pprSlides\)/);
  assert.match(scene, /pprAllowed = pprTargetsStation\(ppr, m\.currentStation, areaId\)/);
  assert.match(scene, /if result\.Count\(\) = 0/);
  assert.match(scene, /function targetAreaMatches/);
});

test('alertas temporarios usam fila independente do carrossel', () => {
  assert.match(scene, /temporaryAlerts\.Push\(alert\)/);
  assert.match(scene, /configureTemporaryAlerts\(temporaryAlerts\)/);
  assert.match(scene, /sub showNextTemporaryAlert\(\)/);
  assert.match(scene, /sub onTemporaryAlertTimer\(\)/);
  assert.equal((scene.match(/renderActiveBanner\(\)/g) || []).length, 1);
});

test('sincroniza quando updated_at muda mesmo sem nova revisao', () => {
  assert.match(scene, /m\.lastUpdatedAt = ""/);
  assert.match(scene, /revision = m\.lastRevision and updatedAt = m\.lastUpdatedAt/);
});

test('PPR usa imagens publicadas e mantém o desenho nativo como contingência', () => {
  assert.match(scene, /renderedSlides = arrayOrEmpty\(valueOr\(ppr, "renderedSlides", \[\]\)\)/);
  assert.match(scene, /kind: "ppr-image"/);
  assert.match(scene, /if result\.Count\(\) > 0 then return result/);
  assert.match(scene, /O painel nativo permanece apenas como contingência/);
});

test('primeira instalação inicia sem abrir automaticamente a seleção de setor', () => {
  assert.match(scene, /if m\.stationChoices\.Count\(\) = 1/);
  assert.match(scene, /areaId: "__unbound__"/);
  assert.match(scene, /kind: "unbound"/);
  assert.match(scene, /station-binding-required[\s\S]*?buildPlaylist\(\)/);
  assert.match(scene, /station-binding-required/);
  assert.doesNotMatch(scene, /else\s+showStationSelector\(\)\s+end if\s+end sub/);
  assert.match(scene, /key = "options" or key = "OK" or key = "down"/);
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
  assert.match(scene, /sub onIntroVideoPosition\(\)/);
  assert.match(scene, /m\.introVideo\.position >= 9\.5/);
  assert.match(scene, /m\.introGroup\.RemoveChild\(m\.introVideo\)/);
  assert.match(xml, /id="introFallbackTimer" duration="12"/);
  assert.match(scene, /if key = "OK" or key = "back"[\s\S]*?finishIntroVideo\(\)/);
});

test('Roku consulta atualizacoes sem intervalo agressivo', () => {
  assert.match(xml, /id="syncTimer" duration="60"/);
});

test('consulta de estado possui timeout, cache local e retomada do ciclo', () => {
  assert.match(fetchTask, /AsyncGetToString\(\)/);
  assert.match(fetchTask, /Wait\(15000, port\)/);
  assert.match(fetchTask, /cachefs:\/central-dashboard-state\.json/);
  assert.match(fetchTask, /useCachedState/);
  assert.doesNotMatch(fetchTask, /transfer\.GetToString\(\)/);
  assert.match(xml, /id="fetchWatchdogTimer" duration="20"/);
  assert.match(scene, /sub onFetchWatchdogTimer\(\)/);
});

test('player registra a playlist e oferece diagnostico pelo controle', () => {
  assert.match(scene, /logEvent\("playlist-built"/);
  assert.match(scene, /logEvent\("slide-start"/);
  assert.match(scene, /logEvent\("image-failed"/);
  assert.match(xml, /id="diagnosticsOverlay"/);
  assert.match(scene, /key = "up"/);
  assert.match(scene, /Build: V37/);
});

test('player recupera o carrossel se o temporizador da tela parar', () => {
  assert.match(xml, /id="playbackWatchdogTimer" duration="15" repeat="true"/);
  assert.match(scene, /sub onPlaybackWatchdogTimer\(\)/);
  assert.match(scene, /playback-recovery-stalled/);
  assert.match(scene, /station-selector-closed/);
});

test('Roku reproduz vídeos MP4 de alertas em tela cheia', () => {
  assert.match(xml, /id="alertVideo"/);
  assert.match(scene, /mediaType = "video"/);
  assert.match(scene, /mediaUrl: alertImageUrl/);
  assert.match(scene, /sub startAlertVideo\(slide as object, mediaUrl as string\)/);
  assert.match(scene, /content\.streamFormat = "mp4"/);
  assert.match(scene, /sub onAlertVideoState\(\)/);
  assert.match(scene, /state = "finished"/);
  assert.doesNotMatch(scene, /logEvent\("alert-skipped-video"/);
});

test('contador minimalista mostra o tempo restante sem controlar a rotação', () => {
  assert.match(xml, /id="countdownOverlay"/);
  assert.match(xml, /id="countdownLabel"/);
  assert.match(xml, /id="countdownTimer" duration="1" repeat="true"/);
  assert.match(scene, /sub updateCountdownOverlay\(\)/);
  assert.match(scene, /remaining = Int\(duration - currentPlaybackAge\(\)/);
  assert.match(scene, /m\.countdownTimer\.control = "start"/);
  assert.match(scene, /m\.countdownTimer\.control = "stop"/);
  assert.match(scene, /m\.countdownEnabled = valueOr\(settings, "countdownEnabled", true\)/);
  assert.match(scene, /if not m\.countdownEnabled or m\.paused/);
  assert.match(scene, /m\.countdownLabel\.text = pad2\(Int\(remaining \/ 60\)\)/);
  assert.doesNotMatch(scene, /PRÓXIMA TELA/);
  assert.match(xml, /text="00:00" horizAlign="center"/);
});

test('contador usa a mesma duração configurada no slide', () => {
  assert.match(scene, /duration = valueOr\(slide, "duration", m\.defaultDuration\)/);
  assert.match(scene, /m\.slideTimer\.duration = duration/);
  assert.match(scene, /remaining = Int\(duration - currentPlaybackAge\(\)/);
  assert.match(scene, /startSlideTimer\(completedSlide\)/);
});
