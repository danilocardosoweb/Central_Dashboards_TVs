import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const web = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const roku = fs.readFileSync(new URL('../roku/components/MainScene.brs', import.meta.url), 'utf8');
const rokuXml = fs.readFileSync(new URL('../roku/components/MainScene.xml', import.meta.url), 'utf8');

test('scripts da Central Web continuam sintaticamente válidos', () => {
    const scripts = [...web.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
        .map(match => match[1])
        .filter(source => source.trim());
    assert.ok(scripts.length >= 3);
    scripts.forEach((source, index) => {
        assert.doesNotThrow(() => new vm.Script(source, { filename: `inline-${index + 1}.js` }));
    });
});

test('PPR possui administração, telas e persistência central', () => {
    const requiredIds = [
        'pprEnabled',
        'pprIndicatorList',
        'pprPreviewModal',
        'pprAreaTargets',
        'pprStationTargets',
        'pprStaleDays',
        'pprTheme',
        'pprIndicatorOperationalValue',
        'pprIndicatorUnit',
        'pprIndicatorAutoCalculate',
        'pprIndicatorBandList'
    ];
    requiredIds.forEach(id => assert.match(web, new RegExp(`id=["']${id}["']`)));
    assert.match(web, /'dashboardPprV1'/);
    assert.match(web, /ppr:\s*parseStoredJson\('dashboardPprV1'/);
    assert.match(web, /function buildPprSlides\(/);
    assert.match(web, /sequencePosition/);
    assert.match(web, /ppr-theme-light/);
    assert.match(web, /formatPprMeasure/);
    assert.match(web, /function calculatePprResultFromBands\(/);
    assert.match(web, /function parsePprBandRange\(/);
    assert.match(web, /ppr-summary-hero/);
    assert.match(web, /ppr-score-ring/);
    assert.match(web, /ppr-progress-fill/);
    assert.match(web, /ppr-performance-label/);
    assert.match(web, /function updatePresentationChrome\(/);
});

test('escala mantém os seis marcos e o resultado decimal', () => {
    for (const mark of [0, 50, 75, 100, 125, 150]) {
        assert.match(web, new RegExp(`\\[${mark},`));
    }
    assert.match(web, /step="0\.01"/);
    assert.match(web, /value \/ 150/);
});

test('valor realizado encontra automaticamente a faixa configurada', () => {
    const start = web.indexOf('function parsePprMeasureNumber');
    const end = web.indexOf('function getPprBandLabel', start);
    const context = { Number, String };
    vm.createContext(context);
    vm.runInContext(web.slice(start, end), context);
    const indicator = {
        operationalValue: '1.318',
        performanceBands: [
            { percent: 150, label: '1.360 ou mais' },
            { percent: 125, label: '1.340 a 1.359' },
            { percent: 100, label: '1.310 a 1.339' },
            { percent: 75, label: '1.290 a 1.309' },
            { percent: 50, label: '1.270 a 1.289' },
            { percent: 0, label: 'Abaixo de 1.250' }
        ]
    };
    assert.equal(context.calculatePprResultFromBands(indicator), 100);
    assert.equal(context.pprBandsOverlap(indicator.performanceBands), false);
    assert.equal(context.parsePprBandRange('1.269 ou menos').max, 1269);
    assert.equal(context.parsePprBandRange('1.360 a 1.280').reversed, true);
    assert.equal(context.getPprBandValidationIssue([
        { percent: 150, label: '1.360 a 1.280' }
    ]).percent, 150);
    assert.equal(context.pprBandsOverlap([
        { percent: 150, label: '1.280 a 1.360' },
        { percent: 100, label: '1.310 a 1.339' }
    ]), true);
});

test('player Roku lê e renderiza o PPR sem imagens', () => {
    assert.match(roku, /valueOr\(m\.state, "ppr", invalid\)/);
    assert.match(roku, /function buildPprSlides\(/);
    assert.match(roku, /sub renderPprIndividual\(/);
    assert.match(roku, /sub renderPprSummary\(/);
    assert.match(roku, /sub applyPprTheme\(/);
    assert.match(roku, /function pprOperationalText\(/);
    assert.match(roku, /sub updatePprScaleLabels\(/);
    assert.match(roku, /m\.pprSummaryGroup\.visible = true/);
    assert.match(roku, /m\.pprProgressFill\.width/);
    assert.match(rokuXml, /id="pprPanel"/);
    assert.match(rokuXml, /id="pprThermometerFill"/);
    assert.match(rokuXml, /id="pprScale100"/);
    assert.match(rokuXml, /id="pprSummaryGroup"/);
    assert.match(rokuXml, /id="pprProgressFill"/);
    assert.match(rokuXml, /id="pprValueCaption"/);
    assert.match(rokuXml, /id="pprGoalContext"/);
});
