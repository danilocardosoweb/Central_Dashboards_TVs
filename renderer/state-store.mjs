const DEFAULT_STATE_OBJECT = 'state/central.json';

function textFromBlob(blob) {
  if (blob && typeof blob.text === 'function') return blob.text();
  return Promise.resolve(String(blob || ''));
}

export function stateObjectName(config = {}) {
  return String(config.stateObject || DEFAULT_STATE_OBJECT)
    .replace(/^\/+/, '') || DEFAULT_STATE_OBJECT;
}

export function stateBucketName(config = {}) {
  return String(config.stateBucket || 'central-state').trim() || 'central-state';
}

export function normalizeStateRow(value, rowId = 'central') {
  const source = value && typeof value === 'object' ? value : {};
  return {
    id: String(source.id || rowId),
    payload: source.payload && typeof source.payload === 'object'
      ? source.payload
      : {},
    revision: Number(source.revision) || 0,
    updated_at: source.updated_at || source.updatedAt || null
  };
}

export function isMissingStorageObject(error) {
  const status = Number(error?.statusCode || error?.status || 0);
  const message = String(error?.message || '').toLowerCase();
  return status === 404 ||
    message.includes('not found') ||
    message.includes('object not found');
}

export async function readStorageState(supabase, config) {
  const { data, error } = await supabase.storage
    .from(stateBucketName(config))
    .download(stateObjectName(config));

  if (error) {
    if (isMissingStorageObject(error)) return null;
    throw new Error(`Falha ao ler o estado no Storage: ${error.message}`);
  }

  try {
    const parsed = JSON.parse(await textFromBlob(data));
    return normalizeStateRow(parsed, config.rowId);
  } catch (error) {
    throw new Error(
      `O estado salvo no Storage é inválido: ${error instanceof Error ? error.message : error}`
    );
  }
}

export async function writeStorageState(supabase, config, row) {
  const normalized = normalizeStateRow(row, config.rowId);
  const body = Buffer.from(JSON.stringify(normalized), 'utf8');
  const { error } = await supabase.storage
    .from(stateBucketName(config))
    .upload(stateObjectName(config), body, {
      // O bucket central-state restringe uploads ao MIME application/json.
      contentType: 'application/json',
      cacheControl: '0',
      upsert: true
    });

  if (error) {
    throw new Error(`Falha ao salvar o estado no Storage: ${error.message}`);
  }
  return normalized;
}

export async function readDatabaseState(supabase, rowId = 'central') {
  const { data, error } = await supabase
    .from('tv_app_state')
    .select('id,payload,revision,updated_at')
    .eq('id', rowId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Falha ao ler o estado no banco: ${error.message}`);
  return data ? normalizeStateRow(data, rowId) : null;
}

export async function mirrorDatabaseState(supabase, row) {
  const { error } = await supabase
    .from('tv_app_state')
    .upsert(row, { onConflict: 'id' });
  if (error) throw new Error(`Falha ao espelhar o estado no banco: ${error.message}`);
}

export async function readResilientState(supabase, config, options = {}) {
  const storageRow = await readStorageState(supabase, config);
  if (storageRow) return { row: storageRow, source: 'storage' };

  if (options.databaseFallback === false) return { row: null, source: 'empty' };

  try {
    const databaseRow = await readDatabaseState(supabase, config.rowId);
    if (!databaseRow) return { row: null, source: 'empty' };
    await writeStorageState(supabase, config, databaseRow);
    return { row: databaseRow, source: 'database-migrated' };
  } catch (error) {
    if (options.allowEmptyOnDatabaseError) {
      return {
        row: null,
        source: 'database-unavailable',
        databaseError: error instanceof Error ? error.message : String(error)
      };
    }
    throw error;
  }
}

export async function updateResilientState(
  supabase,
  config,
  buildPayload,
  options = {}
) {
  const currentResult = await readResilientState(supabase, config, {
    allowEmptyOnDatabaseError: true,
    databaseFallback: options.databaseFallback !== false
  });
  const current = currentResult.row || normalizeStateRow({}, config.rowId);
  const expectedRevision = options.expectedRevision;

  if (
    expectedRevision !== undefined &&
    expectedRevision !== null &&
    Number(expectedRevision) !== Number(current.revision)
  ) {
    return { row: current, updated: false, conflict: true };
  }

  const payload = buildPayload(current.payload, current);
  if (!payload) return { row: current, updated: false, conflict: false };

  const row = {
    id: config.rowId,
    payload,
    revision: Number(current.revision) + 1,
    updated_at: options.updatedAt || new Date().toISOString()
  };
  await writeStorageState(supabase, config, row);

  if (config.mirrorDatabase) {
    await mirrorDatabaseState(supabase, row).catch(error => {
      console.warn(`[estado] Banco indisponível; Storage preservado: ${error.message}`);
    });
  }

  return { row, updated: true, conflict: false };
}
