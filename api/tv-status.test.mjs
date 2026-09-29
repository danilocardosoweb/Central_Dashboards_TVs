import assert from 'node:assert/strict';
import test from 'node:test';

import { bodyFromRequest, classifyPresence, normalizeHeartbeat, resolveHeartbeatStation } from './tv-status.mjs';

test('lê o JSON enviado pelo Roku quando a plataforma entrega um Buffer', () => {
  const body = bodyFromRequest({
    body: Buffer.from(JSON.stringify({ stationId: 'station-default', appVersion: 'V_48' }), 'utf8')
  });
  assert.equal(body.stationId, 'station-default');
  assert.equal(body.appVersion, 'V_48');
});

test('normaliza heartbeat sem aceitar campos arbitrários', () => {
  const heartbeat = normalizeHeartbeat({
    stationId: 'station-prensas', stationName: 'TV Prensas', playlistCount: '8',
    currentIndex: 3, currentTitle: 'Produção', secret: 'não deve sair'
  }, new Date('2026-08-05T12:00:00Z'));
  assert.equal(heartbeat.stationId, 'station-prensas');
  assert.equal(heartbeat.playlistCount, 8);
  assert.equal(heartbeat.currentIndex, 3);
  assert.equal(heartbeat.receivedAt, '2026-08-05T12:00:00.000Z');
  assert.equal('secret' in heartbeat, false);
});

test('aceita as chaves em minúsculas emitidas pelo FormatJson do Roku', () => {
  const heartbeat = normalizeHeartbeat({
    stationid: 'tv-usinagem', stationname: 'TV Usinagem', areaid: 'usinagem',
    selectionkind: 'station', installationid: 'roku-1', sessionid: '0932',
    appversion: 'V_38', currentindex: 3, playlistcount: 7,
    currenttype: 'dashboard', currenttitle: 'Produção', staterevision: 170,
    statesource: 'network', lasterror: '', uptimeseconds: 120,
    playbackageseconds: 5, recoverycount: 1, playerstate: 'playing'
  }, new Date('2026-09-29T12:00:00.000Z'));

  assert.equal(heartbeat.stationId, 'tv-usinagem');
  assert.equal(heartbeat.stationName, 'TV Usinagem');
  assert.equal(heartbeat.appVersion, 'V_38');
  assert.equal(heartbeat.currentIndex, 3);
  assert.equal(heartbeat.playlistCount, 7);
  assert.equal(heartbeat.stateRevision, 170);
  assert.equal(heartbeat.playerState, 'playing');
});

test('classifica TV por idade do último heartbeat', () => {
  const now = new Date('2026-08-05T12:05:00Z');
  assert.equal(classifyPresence({ receivedAt: '2026-08-05T12:04:00Z' }, now).status, 'online');
  assert.equal(classifyPresence({ receivedAt: '2026-08-05T12:02:00Z' }, now).status, 'unstable');
  assert.equal(classifyPresence({ receivedAt: '2026-08-05T11:30:00Z' }, now).status, 'offline');
  assert.equal(classifyPresence(null, now).status, 'offline');
});

test('recupera o vínculo quando a TV guardou o identificador antigo, mas o nome ainda é único', () => {
  const result = resolveHeartbeatStation([
    { id: 'tv-usinagem-2026', name: 'TV Usinagem', areaId: 'geral' },
    { id: 'tv-prensas-2026', name: 'TV Prensas', areaId: 'geral' }
  ], {
    stationId: 'station-default', stationName: 'TV Usinagem'
  });
  assert.equal(result.matchedBy, 'name');
  assert.equal(result.station.id, 'tv-usinagem-2026');
});
