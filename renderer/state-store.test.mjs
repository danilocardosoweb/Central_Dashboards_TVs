import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readResilientState,
  readStorageState,
  updateResilientState,
  writeStorageState
} from './state-store.mjs';

function createStorageMock(initial = {}) {
  const objects = new Map(Object.entries(initial));
  const bucket = {
    async download(path) {
      if (!objects.has(path)) {
        return {
          data: null,
          error: { statusCode: 404, message: 'Object not found' }
        };
      }
      return { data: new Blob([objects.get(path)]), error: null };
    },
    async upload(path, body) {
      objects.set(path, Buffer.from(body).toString('utf8'));
      return { data: { path }, error: null };
    }
  };
  return {
    objects,
    client: {
      storage: { from: () => bucket },
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          limit() { return this; },
          async maybeSingle() {
            return { data: null, error: { message: 'Database unavailable' } };
          }
        };
      }
    }
  };
}

const config = {
  bucket: 'roku-snapshots',
  stateBucket: 'central-state',
  stateObject: 'state/central.json',
  rowId: 'central',
  mirrorDatabase: false
};

test('salva e le o estado central pelo Storage', async () => {
  const mock = createStorageMock();
  await writeStorageState(mock.client, config, {
    id: 'central',
    payload: { urls: [{ id: 'dash-1' }] },
    revision: 3,
    updated_at: '2026-08-03T12:00:00.000Z'
  });

  const row = await readStorageState(mock.client, config);
  assert.equal(row.revision, 3);
  assert.equal(row.payload.urls[0].id, 'dash-1');
});

test('inicializa o Storage mesmo quando o banco esta indisponivel', async () => {
  const mock = createStorageMock();
  const result = await updateResilientState(
    mock.client,
    config,
    () => ({ urls: [{ id: 'dash-1' }], ppr: { enabled: true } }),
    { expectedRevision: 0 }
  );

  assert.equal(result.updated, true);
  assert.equal(result.row.revision, 1);
  assert.ok(mock.objects.has('state/central.json'));
});

test('rejeita gravacao baseada em revisao antiga', async () => {
  const mock = createStorageMock({
    'state/central.json': JSON.stringify({
      id: 'central',
      payload: { urls: [] },
      revision: 8,
      updated_at: '2026-08-03T12:00:00.000Z'
    })
  });
  const result = await updateResilientState(
    mock.client,
    config,
    () => ({ urls: [{ id: 'nao-deve-salvar' }] }),
    { expectedRevision: 7 }
  );

  assert.equal(result.updated, false);
  assert.equal(result.conflict, true);
  assert.equal(result.row.revision, 8);
});

test('pode consultar somente o Storage sem depender do Postgres', async () => {
  const mock = createStorageMock();
  const result = await readResilientState(mock.client, config, {
    databaseFallback: false
  });
  assert.equal(result.row, null);
  assert.equal(result.source, 'empty');
});
