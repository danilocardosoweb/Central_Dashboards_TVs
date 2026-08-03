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
    assert.match(sql, /bucket_id = 'alert-assets'/);
    assert.match(sql, /name like 'alerts\/%'/);
});

test('Roku continua consumindo a URL remota do aviso', () => {
    assert.match(roku, /imageUrl: remoteAlertImage\(alert\)/);
    assert.match(roku, /candidate = valueOr\(alert, "imageUrl", ""\)/);
});
