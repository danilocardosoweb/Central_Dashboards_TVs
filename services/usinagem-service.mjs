const DEFAULT_TABLES = {
  apontamentos: 'apontamentos',
  paradas: 'paradas',
  pedidos: 'pedidos',
  maquinas: 'maquinas'
};

export const USINAGEM_ENV_KEYS = ['VITE_USINAGEM_SUPABASE_URL', 'VITE_USINAGEM_SUPABASE_ANON_KEY'];

export function usinagemConfig(source = globalThis) {
  const runtime = source?.__USINAGEM_CONFIG__ || {};
  const env = source?.import?.meta?.env || source?.importMetaEnv || {};
  return {
    url: String(runtime.url || env.VITE_USINAGEM_SUPABASE_URL || source?.VITE_USINAGEM_SUPABASE_URL || '').replace(/\/$/, ''),
    anonKey: String(runtime.anonKey || env.VITE_USINAGEM_SUPABASE_ANON_KEY || source?.VITE_USINAGEM_SUPABASE_ANON_KEY || ''),
    tables: { ...DEFAULT_TABLES, ...(runtime.tables || {}) }
  };
}

export const supabaseUsinagem = {
  config: usinagemConfig(),
  configure(config) { this.config = { ...this.config, ...config }; return this; },
  get configured() { return Boolean(this.config.url && this.config.anonKey); },
  async select(table, { columns = '*', filters = [], limit = 5000 } = {}) {
    if (!this.configured) throw new Error('Fonte de dados da Usinagem ainda não configurada.');
    const query = buildSelectQuery(columns, filters, limit);
    const response = await fetch(`${this.config.url}/rest/v1/${this.config.tables[table] || table}?${query}`, {
      headers: { apikey: this.config.anonKey, Authorization: `Bearer ${this.config.anonKey}` }
    });
    if (!response.ok) throw new Error(`Usinagem: falha ao consultar ${table} (${response.status}).`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }
};

export function buildSelectQuery(columns = '*', filters = [], limit = 5000) {
  const params = new URLSearchParams({ select: columns, limit: String(limit) });
  filters.forEach(({ field, op = 'eq', value }) => {
    if (value !== '' && value != null) params.set(field, `${op}.${value}`);
  });
  return params.toString();
}

export function validInterval(row, start = 'inicio', end = 'fim') {
  const from = new Date(row?.[start]); const to = new Date(row?.[end]);
  return Number.isFinite(from.getTime()) && Number.isFinite(to.getTime()) && to > from;
}

export function durationHours(row) {
  if (!validInterval(row)) return 0;
  return (new Date(row.fim) - new Date(row.inicio)) / 3600000;
}

export function operationalDay(value) {
  const date = new Date(value); if (!Number.isFinite(date.getTime())) return '';
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes < 80) date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function shiftFor(value) {
  const date = new Date(value); if (!Number.isFinite(date.getTime())) return '';
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes >= 390 && minutes < 970 ? 'TB' : 'TC';
}

function value(row, ...keys) { for (const key of keys) if (row?.[key] != null && row[key] !== '') return row[key]; return ''; }
function number(row, ...keys) { const n = Number(value(row, ...keys)); return Number.isFinite(n) ? n : 0; }
function dateValue(row) { return value(row, 'inicio', 'data', 'created_at', 'data_apontamento'); }

function applyFilters(rows, filters = {}) {
  return rows.filter(row => {
    const checks = [['maquina', ['maquina_id', 'maquina', 'machine_id']], ['operador', ['operador_id', 'operador']], ['produto', ['produto_id', 'produto']], ['cliente', ['cliente_id', 'cliente']], ['pedido', ['pedido_id', 'pedido', 'op']], ['turno', ['turno']]];
    return checks.every(([name, keys]) => !filters[name] || filters[name] === 'all' || (name === 'turno' ? shiftFor(dateValue(row)) === filters[name] : String(value(row, ...keys)) === String(filters[name])))
      && (!filters.from || new Date(dateValue(row)) >= filters.from) && (!filters.to || new Date(dateValue(row)) < filters.to);
  });
}

export function aggregate(rows, filters = {}) {
  const selected = applyFilters(rows, filters); const byUnit = new Map();
  selected.forEach(row => { const unit = String(value(row, 'unidade', 'unit') || 'Não informado').toUpperCase(); const good = number(row, 'quantidade', 'quantidade_boa'); const scrap = number(row, 'qtd_refugo', 'refugo'); const item = byUnit.get(unit) || { unit, good: 0, scrap: 0, gross: 0, productiveGood: 0, hours: 0, count: 0 }; item.good += good; item.scrap += scrap; item.gross += good + scrap; if (validInterval(row)) { item.productiveGood += good; item.hours += durationHours(row); } item.count += 1; byUnit.set(unit, item); });
  return [...byUnit.values()].map(item => ({ ...item, scrapRate: item.gross ? item.scrap / item.gross * 100 : 0, productivity: item.hours ? item.productiveGood / item.hours : null }));
}

export function groupBy(rows, key, filters = {}) { const map = new Map(); applyFilters(rows, filters).forEach(row => { const name = String(value(row, key, `${key}_id`) || 'Não informado'); map.set(name, (map.get(name) || 0) + number(row, 'quantidade', 'quantidade_boa')); }); return [...map].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total); }
export function groupByUnit(rows, key, filters = {}) { const map = new Map(); applyFilters(rows, filters).forEach(row => { const name = String(value(row, key, `${key}_id`) || 'Não informado'); const unit = String(value(row, 'unidade', 'unit') || 'Não informado').toUpperCase(); const id = `${name} · ${unit}`; map.set(id, (map.get(id) || 0) + number(row, 'quantidade', 'quantidade_boa')); }); return [...map].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total); }

export async function loadUsinagem(filters = {}) {
  const from = filters.from ? new Date(filters.from) : new Date(Date.now() - 30 * 86400000); const to = filters.to ? new Date(filters.to) : new Date();
  const dateFilters = [{ field: 'inicio', op: 'gte', value: from.toISOString() }, { field: 'inicio', op: 'lt', value: to.toISOString() }];
  const [apontamentos, paradas, pedidos, maquinas] = await Promise.all([
    supabaseUsinagem.select('apontamentos', { filters: dateFilters }),
    supabaseUsinagem.select('paradas', { filters: dateFilters }),
    supabaseUsinagem.select('pedidos', { limit: 2000 }),
    supabaseUsinagem.select('maquinas', { limit: 1000 })
  ]);
  const scoped = applyFilters(apontamentos, filters); const validStops = applyFilters(paradas, filters).filter(row => validInterval(row));
  const totals = aggregate(scoped, filters); const stopsHours = validStops.reduce((sum, row) => sum + durationHours(row), 0);
  const setups = validStops.filter(row => /setup/i.test(String(value(row, 'tipo', 'motivo', 'classificacao'))));
  return { apontamentos, paradas, pedidos, maquinas, scoped, validStops, totals, stopsHours, setups, groups: { maquina: groupByUnit(scoped, 'maquina', filters), operador: groupByUnit(scoped, 'operador', filters), produto: groupByUnit(scoped, 'produto', filters), cliente: groupByUnit(scoped, 'cliente', filters), pedido: groupByUnit(scoped, 'pedido', filters) } };
}
