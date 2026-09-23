import { supabaseUsinagem, loadUsinagem } from '../services/usinagem-service.mjs';

const app = document.getElementById('app');
const screenNames = { resumo: 'Resumo operacional', producao: 'Produção por máquina', qualidade: 'Qualidade e refugo', paradas: 'Paradas e ordens' };
const requestedScreen = new URLSearchParams(window.location.search).get('screen') || 'auto';
const previewMode = new URLSearchParams(window.location.search).get('preview') === '1';
const screenKeys = Object.keys(screenNames);
let data = null;
let screenIndex = 0;
let refreshBusy = false;

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const fmt = value => number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const fmtHours = value => `${fmt(value)} h`;
const validDate = value => { const date = new Date(value); return Number.isFinite(date.getTime()) ? date : null; };

function machineName(value) {
  const id = String(value || '');
  const machine = (data?.maquinas || []).find(item => String(item.id) === id);
  return machine?.nome?.trim() || id || 'Não informado';
}

function unitName(value) {
  const unit = String(value || '').trim().toUpperCase();
  return unit || 'N/I';
}

function duration(row) {
  const from = validDate(row?.inicio); const to = validDate(row?.fim);
  return from && to && to > from ? (to - from) / 3600000 : 0;
}

function total(field) { return (data?.totals || []).reduce((sum, item) => sum + number(item[field]), 0); }

function groupRows(rows, getName, getValue) {
  const groups = new Map();
  (rows || []).forEach(row => {
    const name = String(getName(row) || 'Não informado').trim() || 'Não informado';
    groups.set(name, (groups.get(name) || 0) + number(getValue(row)));
  });
  return [...groups].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function card(label, value, detail = '', tone = '') {
  return `<article class="metric-card ${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong>${detail ? `<small>${esc(detail)}</small>` : ''}</article>`;
}

function bars(items, suffix = '') {
  if (!items.length) return '<div class="empty-panel">Nenhum registro no período.</div>';
  const max = Math.max(...items.map(item => item.value), 1);
  return `<div class="bar-list">${items.slice(0, 8).map(item => `<div class="bar-row"><div class="bar-label"><span>${esc(item.name)}</span><b>${fmt(item.value)}${esc(suffix)}</b></div><div class="bar-track"><i style="width:${Math.max(3, item.value / max * 100)}%"></i></div></div>`).join('')}</div>`;
}

function panel(title, kicker, content, className = '') {
  return `<article class="panel ${className}"><div class="panel-heading"><div><span>${esc(kicker)}</span><h2>${esc(title)}</h2></div></div>${content}</article>`;
}

function summaryData() {
  const stops = (data?.validStops || []).reduce((sum, row) => sum + duration(row), 0);
  const productive = total('hours');
  const good = total('good');
  const scrap = total('scrap');
  const gross = good + scrap;
  const machines = groupRows(data?.scoped, row => machineName(row.maquina), row => row.quantidade ?? row.quantidade_boa);
  const operators = groupRows(data?.scoped, row => row.operador, row => row.quantidade ?? row.quantidade_boa);
  const stopReasons = groupRows(data?.validStops, row => row.motivo_parada || row.tipo_parada || 'Não informado', duration);
  const orderStatus = groupRows(data?.pedidos, row => row.status || 'Sem status', row => 1);
  const scrapByMachine = groupRows(data?.scoped, row => machineName(row.maquina), row => row.qtd_refugo ?? row.refugo);
  return { stops, productive, good, scrap, gross, machines, operators, stopReasons, orderStatus, scrapByMachine };
}

function resumoScreen(summary) {
  const rate = summary.gross ? summary.scrap / summary.gross * 100 : 0;
  return `<div class="metric-grid compact">${card('Produção', fmt(summary.good), 'peças boas', 'blue')}${card('Produtividade', summary.productive ? `${fmt(summary.good / summary.productive)}/h` : '—', 'peças por hora', 'violet')}${card('Refugo', `${fmt(summary.scrap)} · ${fmt(rate)}%`, 'da produção bruta', 'orange')}${card('Paradas', fmtHours(summary.stops), 'tempo perdido', 'red')}</div><div class="panel-grid">${panel('Produção por máquina', 'RANKING', bars(summary.machines))}${panel('Ordens por status', 'PROGRAMAÇÃO', bars(summary.orderStatus))}</div>`;
}

function producaoScreen(summary) {
  return `<div class="metric-grid compact">${card('Peças produzidas', fmt(summary.good), 'produção líquida', 'blue')}${card('Máquinas ativas', fmt(summary.machines.length), 'no período', 'green')}${card('Operadores', fmt(summary.operators.length), 'no período', 'violet')}</div><div class="panel-grid wide-left">${panel('Produção por máquina', 'TOP 8', bars(summary.machines))}${panel('Produção por operador', 'TOP 8', bars(summary.operators))}</div>`;
}

function qualidadeScreen(summary) {
  const rate = summary.gross ? summary.scrap / summary.gross * 100 : 0;
  const rateWidth = Math.min(100, rate);
  return `<div class="metric-grid compact">${card('Produção bruta', fmt(summary.gross), 'boas + refugo', 'blue')}${card('Refugo total', fmt(summary.scrap), 'quantidade apontada', 'orange')}${card('Taxa de refugo', `${fmt(rate)}%`, 'indicador de qualidade', rate > 2 ? 'red' : 'green')}</div><div class="panel-grid wide-left">${panel('Refugo por máquina', 'QUALIDADE', bars(summary.scrapByMachine))}${panel('Resultado geral', 'INDICADOR', `<div class="quality-focus"><strong>${fmt(rate)}%</strong><span>refugo sobre a produção bruta</span><div><i style="width:${rateWidth}%"></i></div></div>`)}</div>`;
}

function paradasScreen(summary) {
  const pending = summary.orderStatus.find(item => /pend|abert|wip/i.test(item.name))?.value || 0;
  return `<div class="metric-grid compact">${card('Tempo parado', fmtHours(summary.stops), 'paradas válidas', 'red')}${card('Ocorrências', fmt(data.validStops.length), 'registros', 'orange')}${card('Ordens', fmt(data.pedidos.length), 'carregadas', 'blue')}${card('Pendentes', fmt(pending), 'em aberto', 'violet')}</div><div class="panel-grid wide-left">${panel('Principais motivos', 'PARETO', bars(summary.stopReasons, ' h'))}${panel('Status das ordens', 'PROGRAMAÇÃO', bars(summary.orderStatus))}</div>`;
}

function screenBody(key, summary) {
  if (key === 'producao') return producaoScreen(summary);
  if (key === 'qualidade') return qualidadeScreen(summary);
  if (key === 'paradas') return paradasScreen(summary);
  return resumoScreen(summary);
}

function render() {
  if (!data) { app.innerHTML = '<p class="state">Carregando indicadores da Usinagem…</p>'; return; }
  const key = requestedScreen === 'auto' ? screenKeys[screenIndex % screenKeys.length] : (screenNames[requestedScreen] ? requestedScreen : 'resumo');
  const summary = summaryData();
  const active = screenKeys.indexOf(key);
  app.innerHTML = `<header><div><div class="eyebrow">TECNOPERFIL · USINAGEM</div><h1>${esc(screenNames[key])}</h1><div class="stamp">Indicadores dos últimos 7 dias · atualização automática</div></div><div class="header-meta"><span class="live-dot"></span><span>Atualizado ${new Date().toLocaleTimeString('pt-BR')}</span></div></header><main class="screen-content">${screenBody(key, summary)}</main><footer><span>🏭 Central de Indicadores da Usinagem</span><span class="screen-dots">${screenKeys.map((item, index) => `<i class="${index === active ? 'active' : ''}" title="${esc(screenNames[item])}"></i>`).join('')}</span><span>${requestedScreen === 'auto' ? 'Rotação automática' : `Tela fixa · ${esc(screenNames[key])}`}</span></footer>`;
}

async function configure() {
  if (supabaseUsinagem.configured) return true;
  try {
    const response = await fetch('../api/usinagem-config', { cache: 'no-store' });
    if (!response.ok) return false;
    const config = await response.json();
    if (config?.configured) supabaseUsinagem.configure(config);
  } catch { /* a mensagem visual explica quando a configuração ainda não existe */ }
  return supabaseUsinagem.configured;
}

async function refresh() {
  if (refreshBusy) return;
  refreshBusy = true;
  try {
    if (!await configure()) { app.innerHTML = '<p class="state">Fonte de dados da Usinagem ainda não configurada.</p>'; return; }
    const now = new Date();
    data = await loadUsinagem({ from: new Date(now.getTime() - 7 * 24 * 3600000), to: now });
    render();
  } catch (error) {
    app.innerHTML = `<p class="state">${esc(error.message || 'Não foi possível carregar os indicadores.')}</p>`;
  } finally { refreshBusy = false; }
}

if (previewMode) document.body.classList.add('preview-mode');
render();
refresh();
if (requestedScreen === 'auto') setInterval(() => { screenIndex = (screenIndex + 1) % screenKeys.length; render(); }, 15000);
setInterval(refresh, 300000);
