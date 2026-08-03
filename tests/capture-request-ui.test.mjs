import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('visao geral oferece captura manual com progresso', () => {
  assert.match(html, /id="captureRequestButton"/);
  assert.match(html, /onclick="requestDashboardCapture\(\)"/);
  assert.match(html, /id="captureRequestProgress"/);
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
