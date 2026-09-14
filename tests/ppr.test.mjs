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
    assert.match(web, /Ligas 6005, 6061, 6082 e 6351/);
    assert.doesNotMatch(web, /Ligas 6005, 6061, 6082 e 6301/);
});

test('escala mantém os seis marcos e o resultado decimal', () => {
    for (const mark of [0, 50, 75, 100, 125, 150]) {
        assert.match(web, new RegExp(`\\[${mark},`));
    }
    assert.match(web, /step="0\.01"/);
    assert.match(web, /value \/ maximum/);
});

test('layout do PPR respeita a area segura de TVs 16:9', () => {
    assert.match(web, /PPR TV safe area/);
    assert.match(web, /\.ppr-individual-screen\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\)/);
    assert.match(web, /\.ppr-individual-layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(410px, 31%\) minmax\(0, 1fr\)/);
    assert.match(web, /\.ppr-thermometer-wrap\s*\{[\s\S]*?overflow:\s*hidden/);
    assert.match(web, /\.ppr-tick\s*\{[\s\S]*?grid-template-columns:\s*var\(--ppr-tick-line\) max-content minmax\(0, 1fr\)/);
    assert.match(web, /\.ppr-indicator-meta > span\s*\{/);
    assert.doesNotMatch(web, /\.ppr-summary-indicator span\s*\{/);
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

test('Roku aceita numeros encapsulados pelo ParseJson e nao exibe zero falso', () => {
    assert.match(roku, /normalizedType = LCase\(valueType\)/);
    assert.match(roku, /normalizedType = "roint"/);
    assert.match(roku, /normalizedType = "rofloat"/);
    assert.match(roku, /normalizedType = "rodouble"/);
    assert.match(roku, /normalizedType = "rostring"/);
    assert.match(roku, /return Val\(value\.ToStr\(\)\)/);
    assert.match(roku, /enabledPprIndicatorCount\(ppr\)/);
    assert.match(roku, /m\.pprSummaryAverage\.text = "--"/);
    assert.match(roku, /ppr-invalid-results/);
});

test('limites exclusivos, inclusivos, zero e percentuais brasileiros', () => {
    const context = { Number, String };
    vm.createContext(context);
    vm.runInContext(web.slice(web.indexOf('function parsePprMeasureNumber'), web.indexOf('function getPprBandLabel')), context);
    assert.equal(context.parsePprMeasureNumber(0), 0);
    assert.equal(context.parsePprMeasureNumber('0,25%'), 0.25);
    assert.equal(context.parsePprMeasureNumber(''), null);
    assert.equal(context.parsePprMeasureNumber('0x10'), null);
    const performanceBands = [{ percent: 150, label: 'Até 1,5%' }, { percent: 100, label: 'Maior que 1,5%' }];
    assert.equal(context.pprBandsOverlap(performanceBands), false);
    assert.equal(context.calculatePprResultFromBands({ operationalValue: '1,5%', performanceBands }), 150);
    assert.equal(context.calculatePprResultFromBands({ operationalValue: '1,5001%', performanceBands }), 100);
    assert.equal(context.parsePprBandRange('maior ou igual a 79').min, 79);
    assert.equal(context.parsePprBandRange('menor ou igual a 79').max, 79);
    assert.equal(context.calculatePprResultFromBands({ operationalValue: '84,02', performanceBands: [{ percent: 100, label: '84 a 84,9 %' }] }), 100);
});

test('admin distingue pendência de zero e preserva decimais proporcionais', () => {
    const context = { Number, String };
    vm.createContext(context);
    vm.runInContext(web.slice(web.indexOf('function hasPprResult'), web.indexOf('function parsePprMeasureNumber')), context);
    assert.equal(context.formatPprPercent(null), 'Sem resultado');
    assert.equal(context.formatPprPercent(''), 'Sem resultado');
    assert.equal(context.formatPprPercent(0), '0%');
    assert.equal(context.formatPprPercent(112.5), '112,5%');
    assert.equal(context.hasPprResult(150.01), false);
    assert.equal(context.formatPprMeasure(0, '%'), '0 %');
});

test('Devolução aceita faixas decrescentes e preserva os percentuais da referência', () => {
    const c = { Number, String, createEntityId: () => 'id', hasOwnTarget: (item, key) => Object.hasOwn(item, key) };
    vm.createContext(c);
    vm.runInContext(web.slice(web.indexOf('function defaultPprRules'), web.indexOf('function initializePpr')), c);
    vm.runInContext(web.slice(web.indexOf('function parsePprMeasureNumber'), web.indexOf('function getPprBandLabel')), c);
    const indicator = { evaluationProfile: 'returns', performanceBands: c.defaultPprBands('returns') };
    const samples = [['0,08%',120],['0,09',120],['0,10',110],['0,11',110],['0,12',100],['0,13',100],['0,14',50],['0,15',50],['0,16',25],['0,17',25],['0,18',null],['0,19',0],['0,07',null],['0,135',null],['-0,1',null],['',null]];
    for (const [value, result] of samples) assert.equal(c.calculatePprResultFromBands(indicator, value), result, value);
    assert.equal(c.getPprBandValidationIssue(indicator.performanceBands, true), null);
    assert.equal(c.findPprBandOverlap(indicator.performanceBands, true), null);
    const restored = c.normalizePprConfig({ indicators: [indicator] }).indicators[0];
    assert.deepEqual(Array.from(restored.performanceBands, b => b.percent), [120,110,100,50,25,0]);
    assert.equal(restored.evaluationProfile, 'returns');
    assert.equal(c.getPprMaxResult(restored), 120);
    assert.equal(c.calculatePprResultFromBands({evaluationProfile:'audit-score'},'79,5%'),79.5);
    assert.equal(c.calculatePprResultFromBands({evaluationProfile:'audit-score'},'100,01'),null);
    assert.equal(c.getPprMaxResult({evaluationProfile:'audit-bands'}),100);
    assert.equal(c.normalizePprConfig({ indicators: [{evaluationProfile:'audit-bands',result:125}] }).indicators[0].result,null);
});

test('Auditoria usa a tabela oficial de 0% a 100%', () => {
    const context = { Number, String, createEntityId: () => 'id', hasOwnTarget: (item, key) => Object.hasOwn(item, key) };
    vm.createContext(context);
    vm.runInContext(web.slice(web.indexOf('function defaultPprRules'), web.indexOf('function initializePpr')), context);
    vm.runInContext(web.slice(web.indexOf('function parsePprMeasureNumber'), web.indexOf('function getPprBandLabel')), context);
    const indicator = { evaluationProfile: 'audit-bands', performanceBands: context.defaultPprBands('audit-bands') };
    for (const [value, expected] of [['100', 100], ['90',100], ['89',75], ['80',75], ['79',50], ['70',50], ['69',25], ['51',25], ['50',null], ['49,9',0]]) {
        assert.equal(context.calculatePprResultFromBands(indicator, value), expected, value);
    }
    assert.equal(context.getPprMaxResult(indicator), 100);
});
