import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const web = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sql = fs.readFileSync(new URL('../supabase/alert_assets.sql', import.meta.url), 'utf8');
const roku = fs.readFileSync(new URL('../roku/components/MainScene.brs', import.meta.url), 'utf8');

test('scripts da Central Web continuam sintaticamente válidos', () => {
    const scripts = [...web.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
        .map(match => match[1])
        .filter(source => source.trim());
    scripts.forEach((source, index) => {
        assert.doesNotThrow(() => new vm.Script(source, { filename: `inline-${index + 1}.js` }));
    });
});

test('editor oferece aviso somente por imagem', () => {
    for (const id of ['alertContentType', 'alertImageFit', 'alertImageBackground']) {
        assert.match(web, new RegExp(`id=["']${id}["']`));
    }
    assert.match(web, /function newImageAlert\(/);
    assert.match(web, /contentType === 'image'/);
    assert.match(web, /alert\.imageUrl \|\| alert\.imageData/);
    assert.match(web, /1920 \/ image\.naturalWidth/);
    assert.match(web, /1080 \/ image\.naturalHeight/);
});

test('imagens são publicadas em bucket próprio do Supabase', () => {
    assert.match(web, /ALERT_STORAGE_BUCKET = 'alert-assets'/);
    assert.match(web, /\/storage\/v1\/object\/public\//);
    assert.match(sql, /'alert-assets'/);
    assert.match(sql, /for insert/i);
    assert.match(sql, /for select/i);
    assert.match(sql, /bucket_id = 'alert-assets'/);
    assert.match(sql, /name like 'alerts\/%'/);
});

test('Roku continua consumindo a URL remota do aviso', () => {
    assert.match(roku, /alertImageUrl = remoteAlertImage\(alert\)/);
    assert.match(roku, /imageUrl: alertImageUrl/);
    assert.match(roku, /"imageUrl"/);
    assert.match(roku, /"mediaUrl"/);
    assert.match(roku, /"attachmentUrl"/);
});

test('a Central exige uma URL HTTPS para imagens que serão exibidas na TV', () => {
    assert.match(web, /Envie uma imagem para a TV antes de salvar/);
    assert.match(web, /uploadAlertAsset\(asset\.blob, asset\.mimeType, asset\.extension\)/);
    assert.doesNotMatch(web, /uploadAlertImage\(/);
});

test('alterações dos avisos são encaminhadas imediatamente para a base central', () => {
    assert.match(web, /function persistAlerts\(\)/);
    assert.match(web, /window\.saveCloudSectionNow\('alerts'\)/);
    assert.match(web, /window\.scheduleCloudSectionSave\('alerts', 0\)/);
    assert.match(web, /Não foi possível salvar/);
});

test('avisos possuem ordem manual persistente usada na Central e no Roku', () => {
    assert.match(web, /displayOrder/);
    assert.match(web, /function moveAlert\(id, direction\)/);
    assert.match(web, /Mover para cima/);
    assert.match(web, /Mover para baixo/);
    assert.match(roku, /function temporaryAlertOrder\(/);
    assert.match(roku, /order < existingOrder/);
});
