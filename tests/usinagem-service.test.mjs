import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregate, durationHours, groupByUnit, operationalDay, shiftFor, supabaseUsinagem, validInterval } from '../services/usinagem-service.mjs';

test('Usinagem calcula produção boa, bruta, refugo e produtividade por unidade', () => {
  const rows = [
    { quantidade: 100, qtd_refugo: 5, unidade: 'PC', inicio: '2026-09-15T06:30:00Z', fim: '2026-09-15T07:30:00Z' },
    { quantidade: 2, qtd_refugo: 1, unidade: 'KG', inicio: '2026-09-15T06:30:00Z', fim: '2026-09-15T08:30:00Z' },
    { quantidade: 999, qtd_refugo: 9, unidade: 'PC', inicio: '2026-09-15T08:00:00Z', fim: '2026-09-15T08:00:00Z' }
  ];
  const result = aggregate(rows);
  assert.deepEqual(result.map(item => item.unit), ['PC', 'KG']);
  assert.equal(result[0].good, 1099); assert.equal(result[0].gross, 1113); assert.equal(result[0].scrap, 14); assert.equal(result[0].productivity, 100);
  assert.equal(result[1].productivity, 1); assert.equal(durationHours(rows[2]), 0); assert.equal(validInterval(rows[2]), false);
  assert.deepEqual(groupByUnit(rows, 'maquina').map(item => item.name), ['Não informado · PC', 'Não informado · KG']);
});

test('Usinagem centraliza turno e dia operacional do TC', () => {
  assert.equal(shiftFor('2026-09-15T06:29:00'), 'TC');
  assert.equal(shiftFor('2026-09-15T06:30:00'), 'TB');
  assert.equal(shiftFor('2026-09-15T16:10:00'), 'TC');
  assert.equal(operationalDay('2026-09-16T01:19:00'), '2026-09-15');
  assert.equal(operationalDay('2026-09-16T01:20:00'), '2026-09-16');
});

test('Usinagem não tenta consultar sem credenciais', async () => {
  const previous = supabaseUsinagem.config;
  supabaseUsinagem.configure({ url: '', anonKey: '' });
  await assert.rejects(() => supabaseUsinagem.select('apontamentos'), /não configurada/);
  supabaseUsinagem.configure(previous);
});
