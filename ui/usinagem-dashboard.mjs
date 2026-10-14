import { supabaseUsinagem, loadUsinagem } from '../services/usinagem-service.mjs';

const root = document.getElementById('usinagemRoot');
const PERIOD_STORAGE_KEY = 'usinagemDashboardPeriodV1';
const PERIOD_VALUES = new Set(['7', 'today', 'yesterday', '30', 'month', 'custom']);
const periodPreference = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(PERIOD_STORAGE_KEY) || '{}');
    return saved && typeof saved === 'object' ? saved : {};
  } catch { return {}; }
})();
function dateInputValue(value) {
  const date = new Date(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}
const initialDate = new Date();
const initialCustomFrom = new Date(initialDate);
initialCustomFrom.setDate(initialCustomFrom.getDate() - 7);
const filters = {
  period: PERIOD_VALUES.has(periodPreference.period) ? periodPreference.period : '7',
  customFrom: parseLocalDate(periodPreference.customFrom) ? periodPreference.customFrom : dateInputValue(initialCustomFrom),
  customTo: parseLocalDate(periodPreference.customTo) ? periodPreference.customTo : dateInputValue(initialDate),
  from: new Date(Date.now() - 7 * 86400000),
  to: initialDate
};
let data = null; let tab = 'overview';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const fmt = value => Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
function state(message, error = false) { root.innerHTML = `<div class="usinagem-state" role="status">${error ? '⚠️ ' : ''}${esc(message)}</div>`; }
function parseLocalDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : null;
}
function setPeriodRange(period = filters.period, now = new Date()) {
  const end = new Date(now);
  const todayStart = new Date(end);
  todayStart.setHours(0, 0, 0, 0);
  let from;
  let to = end;
  if (period === 'today') {
    from = todayStart;
  } else if (period === 'yesterday') {
    to = todayStart;
    from = new Date(todayStart);
    from.setDate(from.getDate() - 1);
  } else if (period === 'month') {
    from = new Date(end.getFullYear(), end.getMonth(), 1);
  } else if (period === 'custom') {
    from = parseLocalDate(filters.customFrom);
    const lastDay = parseLocalDate(filters.customTo);
    if (from && lastDay) {
      to = new Date(lastDay);
      to.setDate(to.getDate() + 1);
    }
  }
  if (!from) {
    from = new Date(end);
    from.setDate(from.getDate() - (period === '30' ? 30 : 7));
  }
  filters.from = from;
  filters.to = to;
}
function persistPeriodPreference() {
  try {
    localStorage.setItem(PERIOD_STORAGE_KEY, JSON.stringify({
      period: filters.period,
      customFrom: filters.customFrom,
      customTo: filters.customTo
    }));
  } catch { /* preference persistence is optional */ }
}
function select(name, label, values) {
  const selected = String(filters[name] || 'all');
  const options = [...new Set(values.map(String))];
  if (selected !== 'all' && !options.includes(selected)) options.unshift(selected);
  return '<label>' + label + '<select class="select-field" data-usi-filter="' + name + '"><option value="all" ' + (selected === 'all' ? 'selected' : '') + '>Todos</option>' + options.map(v => '<option value="' + esc(v) + '" ' + (selected === v ? 'selected' : '') + '>' + esc(v) + '</option>').join('') + '</select></label>';
}
function periodOption(value, label) {
  return '<option value="' + value + '" ' + (filters.period === value ? 'selected' : '') + '>' + label + '</option>';
}
function filtersHtml() {
  const customRange = filters.period === 'custom'
    ? '<label>De<input class="select-field" type="date" data-usi-filter="customFrom" value="' + esc(filters.customFrom) + '"></label><label>At&eacute;<input class="select-field" type="date" data-usi-filter="customTo" value="' + esc(filters.customTo) + '"></label>'
    : '';
  return '<div class="usinagem-filters"><label>Per&iacute;odo<select class="select-field" data-usi-filter="period">'
    + periodOption('7', '7 dias')
    + periodOption('today', 'Hoje')
    + periodOption('yesterday', 'Ontem')
    + periodOption('30', '30 dias')
    + periodOption('month', 'M&ecirc;s atual')
    + periodOption('custom', 'Personalizado')
    + '</select></label>' + customRange
    + select('maquina', 'M&aacute;quina', unique('maquina'))
    + select('operador', 'Operador', unique('operador'))
    + select('produto', 'Produto', unique('produto'))
    + select('cliente', 'Cliente', unique('cliente'))
    + select('pedido', 'Pedido / OP', unique('pedido'))
    + select('turno', 'Turno', ['TB', 'TC'])
    + '</div>';
}
function unique(key) { return [...new Set((data?.apontamentos || []).map(r => r[`${key}_id`] ?? r[key]).filter(Boolean))].sort(); }
function kpi(title, value, suffix = '') { return `<article class="usinagem-kpi"><small>${title}</small><strong>${fmt(value)}${suffix}</strong></article>`; }
function unitKpis(title, field, suffix = '') { return (data?.totals || []).map(item => kpi(`${title} (${item.unit})`, item[field], suffix)).join('') || kpi(title, 0, suffix); }
function bars(items) { if (!items.length) return '<div class="usinagem-state">Sem dados para os filtros atuais.</div>'; const max = items[0].total || 1; return `<div class="usinagem-bars">${items.slice(0, 12).map(i => `<div class="usinagem-bar"><span>${esc(i.name)}</span><i style="width:${Math.max(2, i.total / max * 100)}%"></i><b>${fmt(i.total)}</b></div>`).join('')}</div>`; }
function rowsTable(rows) { const cols = [['data','Data'],['inicio','Início'],['fim','Fim'],['maquina','Máquina'],['operador','Operador'],['pedido','Pedido'],['op','OP'],['produto','Produto'],['cliente','Cliente'],['quantidade','Qtd. boa'],['qtd_refugo','Refugo'],['unidade','Unidade'],['rack','Rack']]; return `<div class="usinagem-table-wrap"><table class="usinagem-table"><thead><tr>${cols.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, 500).map(r => `<tr>${cols.map(([key]) => `<td>${esc(r[key] ?? r[`${key}_id`] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
function content() { const totals = data.totals; const productive = totals.reduce((s, x) => s + x.hours, 0); const stops = data.stopsHours; const title = { overview:'Visão Geral', production:'Produção', productivity:'Produtividade', stops:'Paradas', scrap:'Refugo', orders:'Ordens', machines:'Máquinas' }[tab]; let body = '';
  if (tab === 'overview' || tab === 'production') body = `<div class="usinagem-kpis">${unitKpis('Produção líquida','good')}${unitKpis('Produção bruta','gross')}${unitKpis('Refugo','scrap')}${totals.map(t=>kpi(`Refugo % (${t.unit})`, t.scrapRate, '%')).join('')}${kpi('Tempo produtivo', productive, ' h')}${kpi('Tempo de parada', stops, ' h')}${kpi('Tempo de setup', data.setups.reduce((s,r)=>s+(new Date(r.fim)-new Date(r.inicio))/3600000,0), ' h')}${kpi('Apontamentos', data.scoped.length)}</div><h4>Produção por máquina e unidade</h4>${bars(data.groups.maquina)}<h4>Produção por operador e unidade</h4>${bars(data.groups.operador)}<h4>Apontamentos detalhados</h4>${rowsTable(data.scoped)}`;
  else if (tab === 'productivity') body = `<div class="usinagem-kpis">${totals.map(t=>kpi(`Produtividade (${t.unit})`, t.productivity ?? 0))}${kpi('Horas válidas', productive, ' h')}</div><h4>Produtividade por unidade</h4>${bars(totals.map(t=>({name:t.unit,total:t.productivity || 0})))}<p class="ppr-help">Somente apontamentos com início, fim e fim posterior ao início entram neste cálculo. Unidades PC e KG permanecem separadas.</p>`;
  else if (tab === 'stops') { const byReason = [...data.validStops.reduce((map, row) => { const key = String(row.motivo || row.tipo || row.classificacao || 'Não informado'); map.set(key, (map.get(key) || 0) + (new Date(row.fim) - new Date(row.inicio)) / 3600000); return map; }, new Map())].map(([name,total])=>({name,total})).sort((a,b)=>b.total-a.total); body = `<div class="usinagem-kpis">${kpi('Tempo total de parada', stops, ' h')}${kpi('Quantidade de paradas', data.validStops.length)}${kpi('Média por parada', data.validStops.length ? stops / data.validStops.length : 0, ' h')}${kpi('Tempo de setup', data.setups.reduce((s,r)=>(s+(new Date(r.fim)-new Date(r.inicio))/3600000),0), ' h')}</div><h4>Pareto por motivo (horas)</h4>${bars(byReason)}`; }
  else if (tab === 'scrap') body = `<div class="usinagem-kpis">${unitKpis('Quantidade refugado','scrap')}${totals.map(t=>kpi(`Taxa de refugo (${t.unit})`, t.scrapRate, '%')).join('')}</div>${bars(data.groups.maquina.map(x=>({name:x.name,total:x.total})))}`;
  else if (tab === 'machines') body = data.maquinas.length ? rowsTable(data.maquinas) : '<div class="usinagem-state">Nenhuma máquina cadastrada.</div>';
  else if (tab === 'orders') body = data.pedidos.length ? rowsTable(data.pedidos) : '<div class="usinagem-state">Nenhuma ordem encontrada.</div>';
  return `<div class="usinagem-tabs">${Object.entries({overview:'Visão Geral',production:'Produção',productivity:'Produtividade',stops:'Paradas',scrap:'Refugo',orders:'Ordens',machines:'Máquinas'}).map(([k,v])=>`<button class="usinagem-tab ${tab===k?'active':''}" data-usi-tab="${k}">${v}</button>`).join('')}</div>${filtersHtml()}<h4>${title}</h4>${body}`; }
function uniqueFilters() {
  root.querySelectorAll('[data-usi-filter]').forEach(el => el.addEventListener('change', async () => {
    const name = el.dataset.usiFilter;
    if (name === 'period') {
      filters.period = el.value;
      setPeriodRange(filters.period);
      persistPeriodPreference();
    } else if (name === 'customFrom' || name === 'customTo') {
      filters[name] = el.value;
      filters.period = 'custom';
      setPeriodRange('custom');
      persistPeriodPreference();
    } else {
      filters[name] = el.value;
    }
    await refresh();
  }));
  root.querySelectorAll('[data-usi-tab]').forEach(el => el.addEventListener('click', () => {
    tab = el.dataset.usiTab;
    render();
  }));
}
async function configureFromApi() { if (supabaseUsinagem.configured) return true; try { const response = await fetch('./api/usinagem-config', { cache: 'no-store' }); if (!response.ok) return false; const config = await response.json(); if (config?.configured) supabaseUsinagem.configure(config); } catch { /* configuração opcional em instalações locais */ } return supabaseUsinagem.configured; }
async function refresh() { if (!await configureFromApi()) return state('Fonte de dados da Usinagem ainda não configurada.'); try { data = await loadUsinagem(filters); render(); } catch (error) { state(error.message || 'Não foi possível carregar os dados da Usinagem.', true); } }
function render() { root.innerHTML = data ? content() : '<div class="usinagem-state">Carregando indicadores da Usinagem…</div>'; if (data) uniqueFilters(); }
setPeriodRange(filters.period);
render(); refresh();
