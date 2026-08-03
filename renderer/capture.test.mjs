import assert from 'node:assert/strict';
import test from 'node:test';

import {
  captureObjectName,
  mergeCaptureResults,
  normalizeDashboardUrl,
  readConfiguration,
  safeObjectName,
  selectDashboardsForCapture
} from './capture.mjs';

test('seleciona o link combinado e aceita somente Power BI em HTTPS', () => {
  const url = normalizeDashboardUrl({
    combined: 'https://app.powerbi.com/view?r=abc&pageName=pagina-1'
  });
  assert.equal(
    url,
    'https://app.powerbi.com/view?r=abc&pageName=pagina-1'
  );
  assert.equal(normalizeDashboardUrl({ combined: 'http://powerbi.com/view' }), '');
  assert.equal(normalizeDashboardUrl({ combined: 'https://example.com/view' }), '');
});

test('normaliza o nome do objeto sem caracteres inseguros', () => {
  assert.equal(safeObjectName('Produção / Página 01'), 'producao-pagina-01');
});

test('alterna a imagem entre tres enderecos estaveis por dashboard', () => {
  const first = captureObjectName({
    id: 'Produção / Página 01',
    capturedAt: '2026-08-03T12:00:00.000Z'
  });
  const next = captureObjectName({
    id: 'Produção / Página 01',
    capturedAt: '2026-08-03T12:02:00.000Z'
  });
  assert.match(first, /^dashboards\/producao-pagina-01\/slot-[0-2]\.png$/);
  assert.notEqual(first, next);
});

test('mescla a captura sem apagar outras configurações', () => {
  const payload = {
    version: 1,
    settings: { transitionTime: 30000 },
    alerts: [{ id: 'alerta-1' }],
    urls: [
      { id: 'dashboard-1', name: 'Produção', combined: 'https://app.powerbi.com/view?r=1' },
      { id: 'dashboard-2', name: 'PCP', combined: 'https://app.powerbi.com/view?r=2' }
    ]
  };

  const merged = mergeCaptureResults(payload, [
    {
      id: 'dashboard-1',
      ok: true,
      publicUrl: 'https://cdn.example/dashboard-1.png?v=10',
      capturedAt: '2026-07-30T20:00:00.000Z'
    },
    {
      id: 'dashboard-2',
      ok: false,
      error: 'Tempo esgotado',
      capturedAt: '2026-07-30T20:00:01.000Z'
    }
  ]);

  assert.deepEqual(merged.settings, payload.settings);
  assert.deepEqual(merged.alerts, payload.alerts);
  assert.equal(
    merged.urls[0].rokuImageUrl,
    'https://cdn.example/dashboard-1.png?v=10'
  );
  assert.equal(merged.urls[0].rokuCaptureStatus, 'ok');
  assert.equal(
    merged.urls[0].rokuCaptureAttemptedAt,
    '2026-07-30T20:00:00.000Z'
  );
  assert.equal(merged.urls[1].rokuCaptureStatus, 'error');
  assert.equal(merged.urls[1].rokuCaptureError, 'Tempo esgotado');
  assert.equal(merged.urls[1].name, 'PCP');
});

test('lê opções de execução com padrões seguros', () => {
  const config = readConfiguration(
    {
      CAPTURE_WIDTH: '1280',
      CAPTURE_HEIGHT: '720',
      CAPTURE_CHROME_BOTTOM: '60',
      CAPTURE_MAX_DASHBOARDS: '2',
      CAPTURE_ONLY_IDS: 'a,b'
    },
    ['--local-only']
  );

  assert.equal(config.outputWidth, 1280);
  assert.equal(config.outputHeight, 720);
  assert.equal(config.browserHeight, 780);
  assert.equal(config.localOnly, true);
  assert.equal(config.maxDashboardsPerCycle, 2);
  assert.deepEqual([...config.onlyDashboardIds], ['a', 'b']);
});

test('prioriza dashboards sem imagem e limita o lote da nuvem', () => {
  const selected = selectDashboardsForCapture([
    { id: 'recente', rokuCapturedAt: '2026-08-03T12:00:00.000Z' },
    { id: 'novo' },
    { id: 'antigo', rokuCapturedAt: '2026-07-31T12:00:00.000Z' }
  ], {
    onlyDashboardIds: new Set(),
    maxDashboardsPerCycle: 2
  });

  assert.deepEqual(selected.map(item => item.id), ['novo', 'antigo']);
});
