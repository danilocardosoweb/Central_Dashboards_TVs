import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const web = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = web.indexOf('function calculatePresentationEstimate');
const end = web.indexOf('function formatPresentationDuration', start);
const context = { Array, Math, Number };
vm.createContext(context);
vm.runInContext(web.slice(start, end), context);

test('estima dashboards, PPR, avisos e transicoes em uma volta', () => {
  const estimate = context.calculatePresentationEstimate({
    dashboardCount: 2,
    dashboardDurationSeconds: 10,
    alertDurations: [20],
    pprSlideCount: 3,
    pprDurationSeconds: 30,
    transitionSeconds: 1.4,
    bannerCount: 1
  });

  assert.equal(estimate.slideCount, 6);
  assert.equal(estimate.dashboardSeconds, 20);
  assert.equal(estimate.alertSeconds, 20);
  assert.equal(estimate.pprSeconds, 90);
  assert.ok(Math.abs(estimate.transitionSeconds - 8.4) < 1e-9);
  assert.ok(Math.abs(estimate.totalSeconds - 138.4) < 1e-9);
  assert.equal(estimate.bannerCount, 1);
});

test('a visao geral possui o resumo visual da duracao', () => {
  assert.match(web, /id="presentationEstimateTotal"/);
  assert.match(web, /id="presentationEstimateDashboards"/);
  assert.match(web, /id="presentationEstimatePpr"/);
  assert.match(web, /id="presentationEstimateAlerts"/);
});
