import crypto from 'node:crypto';
import sharp from 'sharp';

export function validateState(row) {
  const payload = row?.payload || {};
  const dashboards = Array.isArray(payload.urls) ? payload.urls.filter(item => item?.enabled !== false) : [];
  const alerts = Array.isArray(payload.alerts) ? payload.alerts.filter(item => item?.enabled !== false) : [];
  const indicators = Array.isArray(payload.ppr?.indicators)
    ? payload.ppr.indicators.filter(item => item?.enabled !== false)
    : [];
  const errors = [];
  if (!Number.isFinite(Number(row?.revision))) errors.push('Revisao ausente.');
  if (!dashboards.length) errors.push('Nenhum dashboard ativo.');
  dashboards.forEach((item, index) => {
    if (!item?.id) errors.push(`Dashboard ${index + 1} sem id.`);
    if (!String(item?.rokuImageUrl || '').startsWith('https://')) {
      errors.push(`Dashboard ${item?.name || index + 1} sem imagem HTTPS.`);
    }
  });
  return {
    ok: errors.length === 0,
    revision: Number(row?.revision) || 0,
    counts: {
      dashboards: dashboards.length,
      alerts: alerts.length,
      pprIndicators: indicators.length,
      stations: Array.isArray(payload.stations) ? payload.stations.length : 0
    },
    dashboards,
    errors
  };
}

export async function inspectImage(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, { headers: { 'Cache-Control': 'no-cache' } });
  if (!response.ok) throw new Error(`Imagem respondeu HTTP ${response.status}.`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) throw new Error(`Content-Type invalido: ${contentType}.`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(buffer).metadata();
  return {
    bytes: buffer.length,
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || '',
    sha256: crypto.createHash('sha256').update(buffer).digest('hex')
  };
}

export async function runAudit(baseUrl, fetchImpl = fetch) {
  const base = String(baseUrl).replace(/\/$/, '');
  const stateResponse = await fetchImpl(`${base}/api/state`, { headers: { 'Cache-Control': 'no-cache' } });
  if (!stateResponse.ok) throw new Error(`/api/state respondeu HTTP ${stateResponse.status}.`);
  const stateBody = await stateResponse.json();
  const row = stateBody?.row || stateBody;
  const state = validateState(row);

  const diagnosticsResponse = await fetchImpl(`${base}/api/diagnostics`, { headers: { 'Cache-Control': 'no-cache' } });
  const diagnosticsText = await diagnosticsResponse.text();
  let diagnostics = {};
  try {
    diagnostics = JSON.parse(diagnosticsText);
  } catch {
    diagnostics = { ok: false, warnings: ['Endpoint de diagnostico ainda nao publicado.'] };
  }
  const images = [];
  for (const dashboard of state.dashboards) {
    try {
      images.push({ id: dashboard.id, ok: true, ...(await inspectImage(dashboard.rokuImageUrl, fetchImpl)) });
    } catch (error) {
      images.push({ id: dashboard.id, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  const distinctHashes = new Set(images.filter(item => item.ok).map(item => item.sha256)).size;
  const errors = [
    ...state.errors,
    ...images.filter(item => !item.ok).map(item => `${item.id}: ${item.error}`)
  ];
  if (!diagnosticsResponse.ok && diagnosticsResponse.status !== 207) {
    errors.push(`/api/diagnostics respondeu HTTP ${diagnosticsResponse.status}.`);
  }
  if (diagnostics?.warnings?.length) errors.push(...diagnostics.warnings);
  if (images.some(item => item.ok && (item.width !== 1920 || item.height !== 1080))) {
    errors.push('Uma ou mais imagens nao possuem 1920x1080.');
  }
  return {
    ok: errors.length === 0,
    checkedAt: new Date().toISOString(),
    baseUrl: base,
    revision: state.revision,
    counts: state.counts,
    diagnostics: {
      ok: diagnostics?.ok === true,
      traceId: diagnostics?.traceId || null,
      playlists: diagnostics?.playlists || []
    },
    images: images.map(({ sha256, ...item }) => item),
    distinctImages: distinctHashes,
    errors
  };
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/scripts/audit-e2e.mjs')) {
  const baseUrl = process.argv[2] || 'https://central-dashboards-t-vs.vercel.app';
  const result = await runAudit(baseUrl);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
