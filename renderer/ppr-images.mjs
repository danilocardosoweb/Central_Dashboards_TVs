import crypto from 'node:crypto';

import { chromium } from 'playwright';
import sharp from 'sharp';

import { safeObjectName } from './capture.mjs';

const SCALE = [150, 125, 100, 75, 50, 0];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function numeric(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatPercent(value) {
  return `${numeric(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

function formatMeasure(indicator) {
  const value = String(indicator?.operationalValue ?? '').trim();
  const unit = String(indicator?.unit ?? '').trim();
  if (!value) return '';
  return unit ? `${value} ${unit}` : value;
}

function activeIndicators(ppr) {
  return (Array.isArray(ppr?.indicators) ? ppr.indicators : [])
    .filter(item => item?.enabled !== false)
    .filter(item => Number.isFinite(Number(item?.result)))
    .sort((left, right) => numeric(left?.order, 999) - numeric(right?.order, 999));
}

function rules(ppr) {
  return Array.isArray(ppr?.rules) ? ppr.rules : [];
}

function ruleFor(ppr, value) {
  return rules(ppr).find(rule => value >= numeric(rule?.min) && value <= numeric(rule?.max, 150)) || {
    color: value >= 100 ? '#22c55e' : '#38bdf8',
    message: value >= 100 ? 'Meta atingida' : 'Próximo da meta'
  };
}

function bandLabel(indicator, percent) {
  const band = (Array.isArray(indicator?.performanceBands) ? indicator.performanceBands : [])
    .find(item => numeric(item?.percent, -1) === percent);
  const label = String(band?.label ?? '').trim();
  if (!label) return '';
  const unit = String(indicator?.unit ?? '').trim();
  return unit && !label.toLocaleLowerCase('pt-BR').includes(unit.toLocaleLowerCase('pt-BR'))
    ? `${label} ${unit}`
    : label;
}

export function buildPprImageSlides(ppr) {
  if (!ppr?.enabled) return [];
  const indicators = activeIndicators(ppr);
  const slides = [];
  if (ppr.showSummary !== false) {
    slides.push({ id: 'ppr-summary', kind: 'summary', title: 'Resumo executivo do PPR' });
  }
  if (ppr.showIndicators !== false && indicators.length) {
    if (ppr.displayMode === 'general') {
      slides.push({ id: 'ppr-general', kind: 'general', title: 'Painel geral do PPR', indicators });
    } else {
      indicators.forEach(indicator => slides.push({
        id: `ppr-${indicator.id || safeObjectName(indicator.name)}`,
        kind: 'individual',
        title: indicator.name || 'Indicador do PPR',
        indicator
      }));
    }
  }
  return slides;
}

function header(ppr) {
  return `<header>
    <div><div class="kicker">PROGRAMA DE PARTICIPAÇÃO NOS RESULTADOS</div><h1>${escapeHtml(ppr.title || 'Acompanhamento do PPR')}</h1></div>
    <div class="period"><span></span>Período ${escapeHtml(ppr.referencePeriod || '')}</div>
  </header>`;
}

function summaryHtml(ppr) {
  const indicators = activeIndicators(ppr);
  const average = indicators.length
    ? indicators.reduce((sum, item) => sum + numeric(item.result), 0) / indicators.length
    : 0;
  const reached = indicators.filter(item => numeric(item.result) >= 100).length;
  const cards = indicators.map(indicator => {
    const value = numeric(indicator.result);
    const rule = ruleFor(ppr, value);
    const measure = formatMeasure(indicator);
    const expected = bandLabel(indicator, value);
    return `<article class="indicator-card" style="--accent:${escapeHtml(rule.color)}">
      <div class="indicator-head"><strong>${escapeHtml(indicator.name)}</strong><em>${escapeHtml(rule.message)}</em></div>
      <div class="indicator-result"><b>${escapeHtml(formatPercent(value))}</b><span>${escapeHtml(measure ? `Realizado ${measure}` : 'Resultado atualizado')}</span></div>
      <div class="progress"><i style="width:${Math.min(100, value / 1.5)}%"></i></div>
      <div class="indicator-meta"><span>${escapeHtml(expected ? `Faixa ${expected}` : 'Faixa não informada')}</span><span>Meta 100%</span></div>
    </article>`;
  }).join('');
  const angle = Math.max(0, Math.min(360, (average / 150) * 360));
  return `${header(ppr)}<main class="summary">
    <section class="score-card">
      <div class="ring" style="--angle:${angle}deg"><div>${escapeHtml(formatPercent(average))}</div></div>
      <div><small>ÍNDICE CONSOLIDADO</small><strong>${reached} de ${indicators.length}<br>indicadores na meta</strong><p>Leitura executiva do desempenho atual do programa.</p></div>
    </section>
    <section class="stats">
      <article><span class="icon blue">◆</span><small>Indicadores ativos</small><b>${indicators.length}</b></article>
      <article><span class="icon green">✓</span><small>Meta atingida</small><b>${reached}</b></article>
      <article><span class="icon amber">↗</span><small>Pontos de atenção</small><b>${Math.max(0, indicators.length - reached)}</b></article>
    </section>
    <section class="indicator-grid">${cards || '<article class="empty">Nenhum indicador ativo possui resultado atualizado.</article>'}</section>
  </main>`;
}

function thermometer(indicator, color) {
  const value = Math.max(0, Math.min(150, numeric(indicator.result)));
  const ticks = SCALE.map(percent => {
    const bottom = percent / 1.5;
    const expected = bandLabel(indicator, percent);
    return `<div class="tick ${percent === 100 ? 'target' : ''}" style="bottom:${bottom}%">
      <span>${percent === 100 ? '100% Meta' : `${percent}%`}</span><small>${escapeHtml(expected)}</small>
    </div>`;
  }).join('');
  return `<section class="gauge-card">
    <div class="thermometer">
      <div class="tube"><div class="fill" style="height:${value / 1.5}%;--accent:${escapeHtml(color)}"></div></div>
      <div class="bulb" style="--accent:${escapeHtml(color)}"></div>
      <div class="ticks">${ticks}</div>
    </div>
  </section>`;
}

function individualHtml(ppr, indicator) {
  const value = numeric(indicator.result);
  const rule = ruleFor(ppr, value);
  const measure = formatMeasure(indicator);
  const expected = bandLabel(indicator, value);
  const goal = value >= 100
    ? (value === 100 ? 'Meta atingida' : `${formatPercent(value - 100)} acima da meta`)
    : `Faltam ${formatPercent(100 - value)} para atingir a meta`;
  return `${header(ppr)}<main class="individual">
    ${thermometer(indicator, rule.color)}
    <section class="result-card" style="--accent:${escapeHtml(rule.color)}">
      <div class="performance">● DESEMPENHO ATUAL</div>
      <div class="big-value">${escapeHtml(String(value).replace('.', ','))}<span>%</span></div>
      <div class="goal">${escapeHtml(goal)}</div>
      <h2>${escapeHtml(indicator.name)}</h2>
      <p class="description">${escapeHtml(indicator.description || '')}</p>
      <div class="values">
        ${measure ? `<article><small>Valor realizado</small><strong>${escapeHtml(measure)}</strong></article>` : ''}
        ${expected ? `<article><small>Faixa esperada</small><strong>${escapeHtml(expected)}</strong></article>` : ''}
      </div>
      <div class="progress large"><i style="width:${Math.min(100, value / 1.5)}%"></i></div>
      <div class="status">${escapeHtml(rule.message)}</div>
      <footer>Referência: ${escapeHtml(indicator.referenceDate || 'Não informada')} · Atualizado em ${escapeHtml(String(indicator.updatedAt || ppr.updatedAt || '').replace('T', ' ').slice(0, 16))}</footer>
    </section>
  </main>`;
}

function generalHtml(ppr) {
  const clone = { ...ppr, showSummary: true };
  return summaryHtml(clone);
}

export function buildPprSlideHtml(ppr, slide) {
  const content = slide.kind === 'individual'
    ? individualHtml(ppr, slide.indicator)
    : slide.kind === 'general'
      ? generalHtml(ppr)
      : summaryHtml(ppr);
  const dark = ppr.theme === 'dark';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
  *{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;overflow:hidden;font-family:Inter,"Segoe UI",Arial,sans-serif;color:${dark ? '#f8fafc' : '#071a3d'}}
  body{padding:44px 62px 42px;background:${dark ? 'radial-gradient(circle at 90% 0,#172554 0,#071426 48%,#020617 100%)' : 'radial-gradient(circle at 92% 0,#dbeafe 0,#f8fbff 45%,#fff 100%)'};border-top:8px solid #2563eb}
  header{height:138px;display:flex;align-items:flex-start;justify-content:space-between}header h1{font-size:66px;line-height:1;margin:14px 0 0;letter-spacing:-2.5px}.kicker{font-size:19px;letter-spacing:7px;color:#2563eb;font-weight:800}.period{margin-top:14px;padding:18px 28px;border:1px solid #bfdbfe;border-radius:40px;background:#eff6ff;color:#1e40af;font-size:23px;font-weight:750}.period span{display:inline-block;width:13px;height:13px;border-radius:50%;margin-right:10px;background:#22c55e;box-shadow:0 0 0 7px #dcfce7}
  .summary{display:grid;grid-template-columns:535px 1fr;grid-template-rows:300px 1fr;gap:20px 24px}.score-card,.stats article,.indicator-card,.gauge-card,.result-card{border:1px solid ${dark ? '#334155' : '#d6e1f0'};background:${dark ? '#0f1e33' : 'rgba(255,255,255,.94)'};box-shadow:0 20px 50px rgba(15,23,42,.09);border-radius:28px}.score-card{padding:34px;display:flex;align-items:center;gap:28px}.ring{width:190px;height:190px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#2563eb var(--angle),#e9eef5 0);position:relative;flex:none}.ring:before{content:"";position:absolute;inset:17px;border-radius:50%;background:${dark ? '#0f1e33' : '#fff'}}.ring div{z-index:1;font-size:50px;font-weight:800}.score-card small,.stats small{display:block;color:#64748b;font-weight:750;letter-spacing:2px}.score-card strong{display:block;font-size:31px;line-height:1.25;margin:12px 0}.score-card p{font-size:18px;color:#64748b;line-height:1.4;margin:0}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.stats article{padding:32px;display:flex;flex-direction:column}.stats b{font-size:68px;margin-top:12px}.icon{display:grid;place-items:center;width:48px;height:48px;border-radius:15px;margin-bottom:22px}.blue{color:#2563eb;background:#dbeafe}.green{color:#16a34a;background:#dcfce7}.amber{color:#d97706;background:#fef3c7}.indicator-grid{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:18px;align-content:start}.indicator-card{position:relative;overflow:hidden;padding:24px 28px;min-height:205px}.indicator-card:before{content:"";position:absolute;left:0;top:0;bottom:0;width:8px;background:var(--accent)}.indicator-head{display:flex;justify-content:space-between;gap:20px;align-items:start}.indicator-head strong{font-size:24px}.indicator-head em{font-style:normal;color:var(--accent);background:color-mix(in srgb,var(--accent) 13%,white);padding:8px 13px;border-radius:20px;font-weight:700}.indicator-result{display:flex;align-items:end;justify-content:space-between;margin:18px 0}.indicator-result b{font-size:48px;color:var(--accent)}.indicator-result span,.indicator-meta{color:#64748b}.progress{height:9px;border-radius:10px;background:#e7edf4;overflow:hidden}.progress i{display:block;height:100%;border-radius:10px;background:var(--accent)}.indicator-meta{display:flex;justify-content:space-between;font-size:20px;font-weight:650;margin-top:14px}.empty{grid-column:1/-1;padding:50px;font-size:28px}
  .individual{height:850px;display:grid;grid-template-columns:640px 1fr;gap:32px}.gauge-card{position:relative;padding:50px}.thermometer{position:absolute;left:75px;top:95px;width:520px;height:650px}.tube{position:absolute;left:60px;top:0;width:134px;height:570px;border:9px solid #94a3b8;border-radius:75px 75px 35px 35px;overflow:hidden;background:${dark ? '#1e293b' : '#fff'}}.fill{position:absolute;left:12px;right:12px;bottom:8px;border-radius:60px 60px 20px 20px;background:var(--accent)}.bulb{position:absolute;left:73px;bottom:2px;width:108px;height:108px;border:9px solid #94a3b8;border-radius:50%;background:var(--accent);box-shadow:inset 0 0 0 10px rgba(255,255,255,.45)}.ticks{position:absolute;left:220px;top:0;width:300px;height:570px}.tick{position:absolute;left:0;display:flex;align-items:center;gap:12px;transform:translateY(50%);white-space:nowrap}.tick:before{content:"";width:30px;border-top:2px solid #64748b}.tick span{font-size:21px;font-weight:750}.tick small{font-size:16px;color:#64748b;font-weight:650}.tick.target:before{width:44px;border-top:6px solid #0f172a}.tick.target span{font-size:23px;color:#0f172a}.result-card{padding:42px 56px;position:relative}.performance{color:var(--accent);font-size:19px;letter-spacing:3px;font-weight:800}.big-value{font-size:145px;line-height:1;font-weight:850;letter-spacing:-7px;margin:12px 0 0}.big-value span{font-size:68px;color:#93c5fd;letter-spacing:-2px}.goal{font-size:22px;color:var(--accent);font-weight:750;margin:8px 0 26px}.result-card h2{font-size:46px;line-height:1.08;margin:0 0 17px;letter-spacing:-1px}.description{font-size:26px;color:#64748b;margin:0 0 22px}.values{display:flex;gap:16px}.values article{min-width:230px;border:1px solid #d6e1f0;border-radius:18px;padding:17px 20px}.values small{display:block;color:#64748b;font-size:17px}.values strong{display:block;font-size:28px;margin-top:8px}.large{margin-top:18px;height:10px}.status{display:inline-block;margin-top:18px;padding:14px 22px;border-left:6px solid var(--accent);background:color-mix(in srgb,var(--accent) 12%,white);font-size:26px;font-weight:800}.result-card footer{position:absolute;left:56px;right:56px;bottom:28px;border-top:1px solid #d6e1f0;padding-top:17px;color:#64748b;font-size:18px}
  </style></head><body>${content}</body></html>`;
}

export function pprRenderFingerprint(ppr) {
  const relevant = { ...ppr };
  delete relevant.renderedSlides;
  delete relevant.renderedAt;
  delete relevant.renderVersion;
  delete relevant.renderStatus;
  delete relevant.renderError;
  delete relevant.renderSourceUpdatedAt;
  return crypto.createHash('sha256').update(JSON.stringify(relevant)).digest('hex').slice(0, 16);
}

export async function renderAndUploadPprImages({ supabase, config, ppr, sourceRevision }) {
  const slides = buildPprImageSlides(ppr);
  if (!slides.length) throw new Error('O PPR não possui telas ativas para gerar.');
  const fingerprint = pprRenderFingerprint(ppr);
  const generation = `rev-${numeric(sourceRevision)}-${fingerprint}-${Date.now()}`;
  const browser = await chromium.launch({ headless: true, ...(config.browserLaunchOptions || {}) });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    colorScheme: ppr.theme === 'dark' ? 'dark' : 'light',
    reducedMotion: 'reduce'
  });
  const uploaded = [];
  try {
    for (const slide of slides) {
      const page = await context.newPage();
      await page.setContent(buildPprSlideHtml(ppr, slide), { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => document.fonts?.ready);
      const image = await page.screenshot({ type: 'png', fullPage: false });
      await page.close();
      const metadata = await sharp(image).metadata();
      if (metadata.width !== 1920 || metadata.height !== 1080) {
        throw new Error(`A imagem ${slide.id} foi gerada em tamanho inválido.`);
      }
      const objectName = `ppr/${generation}/${safeObjectName(slide.id)}.png`;
      const { error } = await supabase.storage.from(config.bucket).upload(objectName, image, {
        contentType: 'image/png',
        cacheControl: '31536000',
        upsert: false
      });
      if (error) throw new Error(`Falha ao publicar ${slide.title}: ${error.message}`);
      const { data } = supabase.storage.from(config.bucket).getPublicUrl(objectName);
      if (!data?.publicUrl) throw new Error(`O Storage não retornou a URL de ${slide.title}.`);
      uploaded.push({
        id: slide.id,
        kind: slide.kind,
        title: slide.title,
        imageUrl: data.publicUrl,
        objectName,
        width: 1920,
        height: 1080,
        duration: numeric(ppr.duration, 30),
        fingerprint
      });
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
  return { slides: uploaded, fingerprint, generation, generatedAt: new Date().toISOString() };
}
