import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPprImageSlides,
  buildPprSlideHtml,
  pprRenderFingerprint,
  removePprSlideObjects
} from './ppr-images.mjs';

const ppr = {
  enabled: true,
  title: 'Acompanhamento do PPR',
  referencePeriod: '2026/2027',
  duration: 30,
  theme: 'light',
  showSummary: true,
  showIndicators: true,
  displayMode: 'individual',
  indicators: [
    {
      id: 'produtividade',
      name: 'Produtividade',
      description: 'Ligas especiais',
      result: 75,
      operationalValue: '1028',
      unit: 'kg/h',
      order: 1,
      enabled: true,
      performanceBands: [{ percent: 75, label: '1.020 a 1.039' }]
    }
  ],
  rules: [{ min: 0, max: 99.99, color: '#38bdf8', message: 'Próximo da meta' }]
};

test('gera resumo e uma imagem para cada indicador ativo', () => {
  const slides = buildPprImageSlides(ppr);
  assert.deepEqual(slides.map(item => item.id), ['ppr-summary', 'ppr-produtividade']);
});

test('HTML do PPR é uma tela 1920x1080 com os valores configurados', () => {
  const slide = buildPprImageSlides(ppr)[1];
  const html = buildPprSlideHtml(ppr, slide);
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /width:1920px;height:1080px/);
  assert.match(html, /Produtividade/);
  assert.match(html, /1028 kg\/h/);
  assert.match(html, /75/);
});

test('fingerprint ignora metadados da renderização anterior', () => {
  const first = pprRenderFingerprint(ppr);
  const second = pprRenderFingerprint({
    ...ppr,
    renderedSlides: [{ imageUrl: 'https://old.example/ppr.png' }],
    previousRenderedSlides: [{ imageUrl: 'https://older.example/ppr.png' }],
    renderedAt: '2026-08-04T10:00:00Z',
    renderGeneration: 'rev-10-old',
    renderStatus: 'ready'
  });
  assert.equal(first, second);
});

test('remove somente objetos PPR depois da troca de geração', async () => {
  let removed = [];
  const supabase = {
    storage: {
      from() {
        return {
          async remove(names) {
            removed = names;
            return { error: null };
          }
        };
      }
    }
  };
  const result = await removePprSlideObjects(supabase, { bucket: 'roku-snapshots' }, [
    { objectName: 'ppr/rev-antiga/ppr-summary.png' },
    { objectName: 'dashboards/invalido/slot-1.png' },
    { objectName: 'ppr/rev-antiga/sem-extensao' }
  ]);
  assert.equal(result.removed, 1);
  assert.deepEqual(removed, ['ppr/rev-antiga/ppr-summary.png']);
});

test('pendentes e resultados inválidos não entram nas imagens nem na média', () => {
  const config = { ...ppr, indicators: [null, '', undefined, -1, 151, 'inválido', 0, 112.5].map((result, index) => ({ id: String(index), name: `Indicador ${index}`, result, enabled: true })) };
  const slides = buildPprImageSlides(config);
  assert.equal(slides.length, 3);
  const html = buildPprSlideHtml(config, slides[0]);
  assert.match(html, /56,25%/);
  assert.match(html, /PPR 2026\/2027 – pagamento JUL\/2027/);
  assert.doesNotMatch(html, /Indicador 0/);
});

test('cada indicador usa sua escala sem alterar o PPR padrão', () => {
  for (const [evaluationProfile, result, expected, absent] of [
    ['returns', 120, '120%', '150%'], ['audit-bands',100,'100% Meta','125%'], ['standard',150,'150%','120%']
  ]) {
    const indicator={...ppr.indicators[0],evaluationProfile,result};
    const html=buildPprSlideHtml(ppr,{kind:'individual',indicator});
    assert.ok(html.includes(expected)); assert.ok(!html.includes(absent)); assert.match(html,/height:100%/);
  }
});
