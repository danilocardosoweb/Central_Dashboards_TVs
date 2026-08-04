import 'dotenv/config';

import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { createClient } from '@supabase/supabase-js';

import { readConfiguration } from './capture.mjs';
import {
  pprRenderFingerprint,
  removePprSlideObjects,
  renderAndUploadPprImages
} from './ppr-images.mjs';
import { readResilientState, updateResilientState } from './state-store.mjs';
import { logEvent } from './telemetry.mjs';

function validRenderedSlides(value) {
  return (Array.isArray(value) ? value : [])
    .filter(item => String(item?.imageUrl || '').startsWith('https://'))
    .filter(item => String(item?.objectName || '').startsWith('ppr/'));
}

export async function publishPprImages(config) {
  const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const source = await readResilientState(supabase, config, { databaseFallback: false });
  if (!source.row) throw new Error('O estado central não foi encontrado no Storage.');
  const ppr = source.row.payload?.ppr;
  if (!ppr?.enabled) {
    console.log('[ppr] O PPR está desativado; nenhuma imagem foi gerada.');
    return { skipped: true, slides: 0 };
  }

  const sourceFingerprint = pprRenderFingerprint(ppr);
  const previousCurrent = validRenderedSlides(ppr.renderedSlides);
  const obsolete = validRenderedSlides(ppr.previousRenderedSlides);
  const activeIndicators = (Array.isArray(ppr.indicators) ? ppr.indicators : [])
    .filter(item => item?.enabled !== false).length;
  console.log(`[ppr] Gerando imagens para ${activeIndicators} indicador(es) ativo(s).`);
  logEvent('ppr-local-renderer', 'generation-start', {
    sourceRevision: source.row.revision,
    sourceFingerprint,
    previousSlides: previousCurrent.length
  });

  const rendered = await renderAndUploadPprImages({
    supabase,
    config,
    ppr,
    sourceRevision: source.row.revision
  });
  console.log(`[ppr] ${rendered.slides.length} arquivo(s) 1920x1080 confirmado(s) no Storage.`);

  let savedRow = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const current = await readResilientState(supabase, config, { databaseFallback: false });
    if (!current.row) throw new Error('O estado central desapareceu durante a geração do PPR.');
    const currentPpr = current.row.payload?.ppr;
    if (pprRenderFingerprint(currentPpr) !== sourceFingerprint) {
      throw new Error('O PPR foi alterado durante a geração. As imagens novas não substituíram a versão anterior.');
    }
    const result = await updateResilientState(
      supabase,
      config,
      payload => ({
        ...payload,
        ppr: {
          ...payload.ppr,
          previousRenderedSlides: previousCurrent,
          renderedSlides: rendered.slides,
          renderedAt: rendered.generatedAt,
          renderSourceUpdatedAt: payload.ppr?.updatedAt || '',
          renderVersion: rendered.fingerprint,
          renderGeneration: rendered.generation,
          renderStatus: 'ready',
          renderError: null
        }
      }),
      { expectedRevision: current.row.revision, databaseFallback: false }
    );
    if (result.updated) {
      savedRow = result.row;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, attempt * 250));
  }
  if (!savedRow) throw new Error('Não foi possível publicar os novos links do PPR por conflito de atualização.');

  // A geração imediatamente anterior permanece como contingência. Somente a
  // versão ainda mais antiga é removida, depois da troca atômica dos links.
  let removed = 0;
  try {
    removed = (await removePprSlideObjects(supabase, config, obsolete)).removed;
  } catch (error) {
    console.warn(`[ppr] Novas imagens publicadas; limpeza antiga pendente: ${error.message}`);
  }
  logEvent('ppr-local-renderer', 'generation-complete', {
    publishedRevision: savedRow.revision,
    slides: rendered.slides.length,
    generation: rendered.generation,
    removedObsoleteSlides: removed
  });
  console.log(`[ppr] Publicação concluída na revisão ${savedRow.revision}.`);
  return { skipped: false, slides: rendered.slides.length, row: savedRow, rendered };
}

async function main() {
  try {
    const config = readConfiguration(process.env, []);
    const result = await publishPprImages(config);
    if (!result.skipped) {
      console.log(`[ppr] Ciclo concluído: ${result.slides} imagem(ns) pronta(s) para as TVs.`);
    }
  } catch (error) {
    console.error(`[ppr] Falha geral: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

const isEntryPoint = process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isEntryPoint) await main();
