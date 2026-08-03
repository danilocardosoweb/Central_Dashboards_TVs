import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDiagnostics } from './diagnostics.mjs';

test('diagnostics counts dynamic dashboards, PPR and alerts per station', () => {
  const row = {
    revision: 9,
    payload: {
      urls: Array.from({ length: 8 }, (_, index) => ({
        id: `d${index}`,
        enabled: true,
        areaIds: ['*'],
        rokuImageUrl: `https://cdn.test/d${index}.png`
      })),
      alerts: [{ id: 'a1', enabled: true, areaIds: ['*'], displayMode: 'fullscreen' }],
      stations: [{ id: 'tv1', name: 'TV 1', areaId: 'geral' }],
      ppr: {
        enabled: true,
        stationIds: ['*'],
        areaIds: ['*'],
        showSummary: true,
        showIndicators: true,
        indicators: [{ id: 'p1', enabled: true, result: 100 }]
      }
    }
  };
  const result = buildDiagnostics(row);
  assert.equal(result.ok, true);
  assert.deepEqual(result.playlists[0], {
    stationId: 'tv1', stationName: 'TV 1', areaId: 'geral', dashboards: 8, ppr: 2, alerts: 1, totalSlides: 11
  });
});

test('diagnostics warns about active dashboards without Roku image', () => {
  const result = buildDiagnostics({ revision: 1, payload: { urls: [{ id: 'd1', enabled: true }] } });
  assert.equal(result.ok, false);
  assert.match(result.warnings[0], /sem imagem Roku/);
});
