import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const web = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = web.indexOf('function payloadSignature');
const end = web.indexOf('function formatCloudTime', start);
const context = { Array, Date, Map, Math, Number, Object, Set, String };
vm.createContext(context);
vm.runInContext(web.slice(start, end), context);

test('Central usa a API resiliente e nao acessa a tabela diretamente', () => {
  assert.match(web, /CLOUD_STATE_ENDPOINT = `\$\{CLOUD_API_ORIGIN\}\/api\/state`/);
  assert.doesNotMatch(web, /rest\/v1\/tv_app_state/);
});

test('salvamento altera somente as secoes realmente editadas', () => {
  const remote = {
    urls: [{ id: 'dash-1', name: 'Remoto' }],
    alerts: [{ id: 'alert-1' }],
    ppr: { enabled: true }
  };
  const local = {
    urls: [{ id: 'dash-1', name: 'Local' }],
    alerts: [],
    ppr: { enabled: false }
  };
  const merged = context.mergeCloudPayload(remote, local, new Set(['alerts']));
  assert.equal(merged.urls[0].name, 'Remoto');
  assert.equal(merged.ppr.enabled, true);
  assert.deepEqual(Array.from(merged.alerts), []);
});

test('edicao de dashboard preserva a captura mais recente da nuvem', () => {
  const remote = {
    urls: [{
      id: 'dash-1',
      name: 'Antigo',
      rokuImageUrl: 'https://cdn.example/novo.png?v=2',
      rokuCapturedAt: '2026-08-03T12:00:00.000Z',
      rokuCaptureStatus: 'ok'
    }]
  };
  const local = {
    urls: [{ id: 'dash-1', name: 'Nome atualizado' }]
  };
  const merged = context.mergeCloudPayload(remote, local, new Set(['urls']));
  assert.equal(merged.urls[0].name, 'Nome atualizado');
  assert.equal(merged.urls[0].rokuImageUrl, 'https://cdn.example/novo.png?v=2');
  assert.equal(merged.urls[0].rokuCaptureStatus, 'ok');
});

test('progresso da captura nao altera a assinatura da apresentacao web', () => {
  const before = {
    urls: [{ id: 'dash-1', name: 'Produção', combined: 'https://app.powerbi.com/view?r=1' }],
    ppr: { enabled: true },
    capture: { status: 'pending', completed: 0 }
  };
  const duringCapture = {
    ...before,
    urls: [{
      ...before.urls[0],
      rokuImageUrl: 'https://cdn.example/slot-1.png?v=2',
      rokuCapturedAt: '2026-08-03T19:20:00.000Z',
      rokuCaptureStatus: 'ok'
    }],
    capture: { status: 'running', completed: 1 }
  };
  assert.equal(
    context.playbackPayloadSignature(before),
    context.playbackPayloadSignature(duringCapture)
  );
});

test('mudanca de dashboard ou PPR altera a assinatura da apresentacao web', () => {
  const base = {
    urls: [{ id: 'dash-1', combined: 'https://app.powerbi.com/view?r=1' }],
    ppr: { enabled: true, indicators: [] }
  };
  assert.notEqual(
    context.playbackPayloadSignature(base),
    context.playbackPayloadSignature({
      ...base,
      urls: [{ id: 'dash-1', combined: 'https://app.powerbi.com/view?r=2' }]
    })
  );
  assert.notEqual(
    context.playbackPayloadSignature(base),
    context.playbackPayloadSignature({
      ...base,
      ppr: { enabled: true, indicators: [{ id: 'ppr-1', result: 100 }] }
    })
  );
});

