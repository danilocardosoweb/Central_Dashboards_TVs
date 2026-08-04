import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manualCaptureSql = fs.readFileSync(
  new URL('../supabase/manual_capture_only.sql', import.meta.url),
  'utf8'
);

test('visao geral oferece captura manual com progresso', () => {
  assert.match(html, /id="captureRequestButton"/);
  assert.match(html, /onclick="requestDashboardCapture\(\)"/);
  assert.match(html, /id="captureRequestProgress"/);
  assert.match(html, /id="pprImageGenerationButton"/);
  assert.match(html, /requestPprImageGeneration\(\)/);
  assert.match(html, /action: 'capture-ppr'/);
  assert.match(html, /function renderCaptureRequestStatus\(capture\)/);
});

test('solicitacao preserva o payload central e cria fila para todos os dashboards', () => {
  assert.match(html, /const payload = \{ \.\.\.\(row\.payload \|\| \{\}\), capture \}/);
  assert.match(html, /queue: dashboards\.map/);
  assert.match(html, /status: 'pending'/);
});

test('sincronizacao exibe a mensagem detalhada devolvida pela API', () => {
  assert.match(html, /error\.error \|\| error\.message \|\| `Falha ao salvar/);
});

test('captura começa pelo clique e recupera automaticamente somente a fila iniciada', () => {
  assert.match(html, /Retomando a atualiza/);
  assert.match(html, /window\.requestDashboardCapture = async function/);
  assert.match(html, /function captureNeedsRecovery\(capture, now = Date\.now\(\)\)/);
  assert.match(html, /Retomar captura/);
  assert.match(html, /button\.disabled = progress\.active && !needsRecovery/);
  assert.match(html, /if \(captureNeedsRecovery\(row\.payload\?\.capture\)\)/);
  assert.match(html, /Fila interrompida detectada; retomando automaticamente/);
  assert.match(manualCaptureSql, /cron\.unschedule/);
  assert.match(manualCaptureSql, /drop trigger if exists tv_app_state_capture_request/);
  assert.doesNotMatch(manualCaptureSql, /cron\.schedule\(/);
});
