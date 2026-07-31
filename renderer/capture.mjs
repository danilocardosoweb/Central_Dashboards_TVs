import 'dotenv/config';

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { chromium } from 'playwright';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://ypwpumtzbdraldccctfd.supabase.co';
const DEFAULT_PUBLISHABLE_KEY =
  'sb_publishable_rtGvHhP6FGA4snm_aDDUgA_vZWnEhFv';

export function readConfiguration(env = process.env, argv = process.argv.slice(2)) {
  const watch = argv.includes('--watch');
  const localOnly = argv.includes('--local-only') || env.CAPTURE_LOCAL_ONLY === 'true';
  const outputWidth = positiveInteger(env.CAPTURE_WIDTH, 1920);
  const outputHeight = positiveInteger(env.CAPTURE_HEIGHT, 1080);
  const cropBottom = nonNegativeInteger(env.CAPTURE_CHROME_BOTTOM, 90);

  return {
    supabaseUrl: env.SUPABASE_URL || DEFAULT_SUPABASE_URL,
    supabaseKey:
      env.SUPABASE_RENDERER_KEY ||
      env.SUPABASE_SERVICE_ROLE_KEY ||
      env.SUPABASE_PUBLISHABLE_KEY ||
      DEFAULT_PUBLISHABLE_KEY,
    bucket: env.SUPABASE_SNAPSHOT_BUCKET || 'roku-snapshots',
    rowId: env.SUPABASE_STATE_ROW_ID || 'central',
    outputDirectory: path.resolve(env.CAPTURE_OUTPUT_DIR || 'renderer/output'),
    outputWidth,
    outputHeight,
    browserHeight: outputHeight + cropBottom,
    cropBottom,
    navigationTimeoutMs: positiveInteger(env.CAPTURE_NAVIGATION_TIMEOUT_MS, 120000),
    detectionTimeoutMs: positiveInteger(env.CAPTURE_DETECTION_TIMEOUT_MS, 45000),
    settleMs: positiveInteger(env.CAPTURE_SETTLE_MS, 18000),
    powerBiZoom: boundedInteger(env.CAPTURE_POWERBI_ZOOM, 89, 33, 200),
    watchIntervalMs: positiveInteger(env.CAPTURE_INTERVAL_MS, 300000),
    headless: env.CAPTURE_HEADLESS !== 'false',
    trimWhitespace: env.CAPTURE_TRIM_WHITESPACE !== 'false',
    localOnly,
    watch,
    debug: env.CAPTURE_DEBUG === 'true',
    onlyDashboardIds: parseIdFilter(env.CAPTURE_ONLY_IDS)
  };
}

export function normalizeDashboardUrl(dashboard) {
  const source = String(
    dashboard?.combined || dashboard?.public || dashboard?.url || ''
  ).trim();
  if (!source) return '';

  let parsed;
  try {
    parsed = new URL(source);
  } catch {
    return '';
  }

  if (parsed.protocol !== 'https:') return '';
  if (!parsed.hostname.endsWith('powerbi.com')) return '';

  if (dashboard?.pageName && !parsed.searchParams.has('pageName')) {
    parsed.searchParams.set('pageName', String(dashboard.pageName));
  }

  return parsed.toString();
}

export function safeObjectName(value) {
  return String(value || 'dashboard')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'dashboard';
}

export function mergeCaptureResults(payload, captureResults) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const urls = Array.isArray(source.urls) ? source.urls : [];
  const byId = new Map(captureResults.map((result) => [String(result.id), result]));

  return {
    ...source,
    urls: urls.map((dashboard) => {
      const result = byId.get(String(dashboard.id));
      if (!result) return dashboard;

      if (result.ok) {
        return {
          ...dashboard,
          rokuImageUrl: result.publicUrl,
          rokuCapturedAt: result.capturedAt,
          rokuCaptureStatus: 'ok',
          rokuCaptureError: null
        };
      }

      return {
        ...dashboard,
        rokuCaptureStatus: 'error',
        rokuCaptureError: result.error,
        rokuCaptureAttemptedAt: result.capturedAt
      };
    })
  };
}

async function readCentralRow(supabase, rowId) {
  const { data, error } = await supabase
    .from('tv_app_state')
    .select('id,payload,revision,updated_at')
    .eq('id', rowId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Falha ao ler o estado central: ${error.message}`);
  if (!data) throw new Error(`A linha central "${rowId}" não foi encontrada.`);
  return data;
}

async function waitForPowerBi(page, config) {
  let detected = false;
  try {
    await page.waitForFunction(
      () => {
        const bodyText = document.body?.innerText || '';
        const hasVisualSurface = Boolean(
          document.querySelector(
            'iframe, canvas, svg, [class*="visualContainer"], [class*="visual-container"]'
          )
        );
        const hasReportText =
          /Microsoft Power BI|1 de \d+|Resumo|Produção|Dashboard/i.test(bodyText);
        return hasVisualSurface || hasReportText;
      },
      { timeout: config.detectionTimeoutMs }
    );
    detected = true;
  } catch {
    detected = false;
  }

  await page.waitForTimeout(config.settleMs);
  return detected;
}

async function preparePageForCapture(page, config) {
  try {
    const zoomButton = page.locator('button.zoomValue').first();
    await zoomButton.waitFor({ state: 'attached', timeout: 5000 });
    await zoomButton.evaluate((element) => element.click());

    const customRadio = page
      .locator('input[type="radio"][value="custom"]')
      .first();
    await customRadio.waitFor({ state: 'attached', timeout: 3000 });
    await customRadio.evaluate((element) => element.click());

    const customInput = page
      .locator(
        'input[aria-label*="zoom personalizado"], input[aria-label*="Custom zoom"]'
      )
      .first();
    await customInput.waitFor({ state: 'attached', timeout: 3000 });
    await customInput.evaluate((element, zoom) => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      ).set;
      setter.call(element, String(zoom));
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }, config.powerBiZoom);

    const applyButton = page
      .getByRole('button', { name: /Aplicar|Apply/i, exact: true })
      .first();
    await applyButton.evaluate((element) => element.click());
    await page.waitForTimeout(5000);
  } catch {
    await page.keyboard.press('Escape').catch(() => {});
  }

  const css = `
    [class*="loadingSpinner"],
    [class*="loading-spinner"] {
      opacity: 0 !important;
    }
  `;

  for (const frame of page.frames()) {
    try {
      await frame.addStyleTag({ content: css });
    } catch {
      // Alguns frames do Power BI bloqueiam injeção; a captura continua.
    }
  }
}

async function captureDashboard(page, dashboard, config) {
  const captureUrl = normalizeDashboardUrl(dashboard);
  const capturedAt = new Date().toISOString();

  if (!captureUrl) {
    return {
      id: dashboard.id,
      ok: false,
      capturedAt,
      error: 'O dashboard não possui um link HTTPS válido do Power BI.'
    };
  }

  const fileBase = safeObjectName(dashboard.id || dashboard.name);
  const outputPath = path.join(config.outputDirectory, `${fileBase}.png`);

  try {
    await page.goto(captureUrl, {
      waitUntil: 'domcontentloaded',
      timeout: config.navigationTimeoutMs
    });

    const reportDetected = await waitForPowerBi(page, config);
    await preparePageForCapture(page, config);
    await page.waitForTimeout(1000);
    const appliedZoom =
      (await page.locator('button.zoomValue').first().textContent().catch(() => ''))
        ?.trim() || 'desconhecido';
    if (config.debug) {
      console.log(`[captura] Zoom aplicado: ${appliedZoom}`);
    }

    const reportArea = page.locator('.displayArea').first();
    const hasReportArea =
      (await reportArea.count()) > 0 && (await reportArea.isVisible());
    const reportBox = hasReportArea ? await reportArea.boundingBox() : null;
    if (config.debug && reportBox) {
      console.log(
        `[captura] Área do relatório: ${Math.round(reportBox.width)}×${Math.round(reportBox.height)} em (${Math.round(reportBox.x)}, ${Math.round(reportBox.y)}).`
      );
    }
    const rawScreenshot = hasReportArea && reportBox
      ? await page.screenshot({
          type: 'png',
          clip: reportBox
        })
      : await page.screenshot({
          type: 'png',
          fullPage: false
        });

    let imagePipeline = sharp(rawScreenshot);
    if (!hasReportArea || !reportBox) {
      imagePipeline = imagePipeline.extract({
        left: 0,
        top: 0,
        width: config.outputWidth,
        height: config.outputHeight
      });
      if (config.trimWhitespace) {
        imagePipeline = imagePipeline.trim({
          background: '#ffffff',
          threshold: 18
        });
      }
    }

    imagePipeline = imagePipeline.resize(
      config.outputWidth,
      config.outputHeight,
      { fit: 'fill' }
    );

    const image = await imagePipeline
      .png({ compressionLevel: 8, adaptiveFiltering: true })
      .toBuffer();

    await fs.writeFile(outputPath, image);

    return {
      id: dashboard.id,
      name: dashboard.name,
      ok: true,
      capturedAt,
      captureUrl,
      reportDetected,
      outputPath,
      captureRegion: hasReportArea && reportBox ? 'report' : 'viewport',
      appliedZoom,
      image
    };
  } catch (error) {
    if (config.debug) {
      const debugPath = path.join(config.outputDirectory, `${fileBase}-erro.png`);
      await page.screenshot({ path: debugPath, fullPage: false }).catch(() => {});
    }

    return {
      id: dashboard.id,
      name: dashboard.name,
      ok: false,
      capturedAt,
      captureUrl,
      error: conciseError(error)
    };
  }
}

async function uploadCapture(supabase, capture, config) {
  const objectName = `dashboards/${safeObjectName(capture.id)}.png`;
  const { error } = await supabase.storage
    .from(config.bucket)
    .upload(objectName, capture.image, {
      contentType: 'image/png',
      cacheControl: '60',
      upsert: true
    });

  if (error) {
    throw new Error(`Falha no envio da imagem: ${error.message}`);
  }

  const { data } = supabase.storage.from(config.bucket).getPublicUrl(objectName);
  const cacheVersion = Date.parse(capture.capturedAt) || Date.now();
  return `${data.publicUrl}?v=${cacheVersion}`;
}

async function persistCaptureResults(supabase, config, results) {
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const latest = await readCentralRow(supabase, config.rowId);
    const payload = mergeCaptureResults(latest.payload, results);
    const nextRevision = Number(latest.revision || 0) + 1;

    const { data, error } = await supabase
      .from('tv_app_state')
      .update({
        payload,
        revision: nextRevision,
        updated_at: new Date().toISOString()
      })
      .eq('id', config.rowId)
      .eq('revision', latest.revision)
      .select('id,revision,updated_at');

    if (error) {
      throw new Error(`Falha ao atualizar o estado central: ${error.message}`);
    }

    if (Array.isArray(data) && data.length === 1) return data[0];
    if (attempt < maxAttempts) await delay(250 * attempt);
  }

  throw new Error(
    'A configuração foi alterada por outro dispositivo durante a gravação. Tente novamente.'
  );
}

export async function runCaptureCycle(config) {
  await fs.mkdir(config.outputDirectory, { recursive: true });

  const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  const centralRow = await readCentralRow(supabase, config.rowId);
  const allDashboards = Array.isArray(centralRow.payload?.urls)
    ? centralRow.payload.urls
    : [];
  const dashboards = config.onlyDashboardIds.size
    ? allDashboards.filter((item) =>
        config.onlyDashboardIds.has(String(item.id))
      )
    : allDashboards;

  if (!dashboards.length) {
    console.log('[captura] Nenhum dashboard disponível.');
    return { successes: 0, failures: 0, results: [] };
  }

  console.log(
    `[captura] Iniciando ${dashboards.length} dashboard(s) em ${config.outputWidth}×${config.outputHeight}.`
  );

  const browser = await chromium.launch({
    headless: config.headless,
    ...(config.browserLaunchOptions || {})
  });
  const context = await browser.newContext({
    viewport: {
      width: config.outputWidth,
      height: config.browserHeight
    },
    deviceScaleFactor: 1,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    colorScheme: 'light',
    reducedMotion: 'reduce'
  });

  const results = [];
  try {
    for (const dashboard of dashboards) {
      const page = await context.newPage();
      console.log(`[captura] Abrindo: ${dashboard.name || dashboard.id}`);
      const result = await captureDashboard(page, dashboard, config);
      await page.close().catch(() => {});

      if (result.ok && !config.localOnly) {
        try {
          result.publicUrl = await uploadCapture(supabase, result, config);
        } catch (error) {
          result.ok = false;
          result.error = conciseError(error);
        }
      }

      if (result.ok) {
        console.log(
          `[captura] OK: ${dashboard.name || dashboard.id}` +
            (result.reportDetected ? '' : ' (carregamento não confirmado)')
        );
      } else {
        console.error(
          `[captura] ERRO: ${dashboard.name || dashboard.id} — ${result.error}`
        );
      }
      results.push(result);
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  if (!config.localOnly) {
    const storageResults = results.map((result) => {
      const { image, ...serializable } = result;
      return serializable;
    });
    const saved = await persistCaptureResults(supabase, config, storageResults);
    console.log(`[captura] Estado central atualizado para revisão ${saved.revision}.`);
  } else {
    console.log(`[captura] Modo local: imagens não foram enviadas ao Supabase.`);
  }

  const successes = results.filter((result) => result.ok).length;
  const failures = results.length - successes;
  return { successes, failures, results };
}

async function main() {
  const config = readConfiguration();

  do {
    const startedAt = Date.now();
    try {
      const summary = await runCaptureCycle(config);
      console.log(
        `[captura] Ciclo concluído: ${summary.successes} sucesso(s), ${summary.failures} falha(s).`
      );
      if (!config.watch && summary.failures > 0) process.exitCode = 1;
    } catch (error) {
      console.error(`[captura] Falha geral: ${conciseError(error)}`);
      if (!config.watch) process.exitCode = 1;
    }

    if (!config.watch) break;
    const elapsed = Date.now() - startedAt;
    const waitMs = Math.max(1000, config.watchIntervalMs - elapsed);
    console.log(
      `[captura] Próximo ciclo em ${Math.ceil(waitMs / 1000)} segundo(s).`
    );
    await delay(waitMs);
  } while (config.watch);
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function parseIdFilter(value) {
  return new Set(
    String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function conciseError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const isEntryPoint =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntryPoint) {
  await main();
}
