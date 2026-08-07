import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyPresence, normalizeHeartbeat, resolveHeartbeatStation } from './tv-status.mjs';

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
