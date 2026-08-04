import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPprImageSlides,
  buildPprSlideHtml,
  pprRenderFingerprint
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
    renderedAt: '2026-08-04T10:00:00Z',
    renderStatus: 'ready'
  });
  assert.equal(first, second);
});
