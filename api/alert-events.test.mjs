import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeAlertEvent } from './state.mjs';

test('normaliza evento de exibicao enviado pela TV', () => {
  const event = normalizeAlertEvent({
    eventId: 'session-tv-alert-101500',
    alertId: 'alert-1',
    title: 'Qualidade',
    priority: 'critical',
    type: 'displayed',
    stationId: 'tv-1',
    stationName: 'TV Produção',
    areaId: 'producao'
  }, new Date('2026-08-04T10:15:00.000Z'));
  assert.equal(event.eventId, 'session-tv-alert-101500');
  assert.equal(event.type, 'displayed');
  assert.equal(event.priority, 'critical');
  assert.equal(event.occurredAt, '2026-08-04T10:15:00.000Z');
});

test('rejeita evento sem identificadores obrigatorios', () => {
  assert.equal(normalizeAlertEvent({ type: 'displayed' }), null);
});

test('limita valores e converte tipo desconhecido para exibido', () => {
  const event = normalizeAlertEvent({
    eventId: 'e1', alertId: 'a1', stationId: 'tv1', type: 'outro', title: 'x'.repeat(300)
  });
  assert.equal(event.type, 'displayed');
  assert.ok(event.title.length <= 120);
});
