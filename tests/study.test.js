import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CBD, OUTER, centreProfiles, matrix, summary } from '../src/analysis.js';

const study = JSON.parse(readFileSync(new URL('../public/data/study.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('../public/data/manifest.json', import.meta.url), 'utf8'));
const rows = study.routes.features.map(f => f.properties);
const centres = study.centres.features.map(f => f.properties).filter(c => c.centre_id !== 'CBD01');

test('exported final study has complete directional routes, leg coverage, and source hashes', () => {
  assert.equal(rows.length, 100); assert.equal(new Set(rows.map(r => r.route_id)).size, 100);
  assert.equal(rows.filter(r => r.analysis_type === OUTER).length, 90);
  assert.equal(rows.filter(r => r.analysis_type === CBD).length, 10);
  assert.equal(study.legs.length, 533); assert.equal(centres.length, 10);
  assert.deepEqual(new Set(study.legs.map(l => l.route_id)), new Set(rows.map(r => r.route_id)));
  assert.deepEqual(study.source_sha256, manifest.source_sha256);
  assert.equal(manifest.study_sha256, createHash('sha256').update(readFileSync(new URL('../public/data/study.json', import.meta.url))).digest('hex'));
  assert.equal(manifest.study_bytes, readFileSync(new URL('../public/data/study.json', import.meta.url)).length);
  assert.deepEqual(manifest.route_counts, { outer_to_outer: 90, outer_to_cbd_benchmark: 10, total: 100 });
  assert.equal(manifest.leg_count, 533);
  assert.equal(study.routes.features.every(f => f.geometry?.type === 'MultiLineString' && f.geometry.coordinates.length > 0), true);
  assert.equal(study.routes.features.every(f => f.properties.requested_departure === manifest.scenario), true);
});
test('study matrix and published descriptive means agree with final saved results', () => {
  const outer = rows.filter(r => r.analysis_type === OUTER);
  assert.equal(matrix(outer, centres).flat().filter(Boolean).length, 90);
  assert.ok(Math.abs(summary(outer, 'travel_time_min').mean - 106.700011) < .00001);
  assert.ok(Math.abs(summary(outer, 'transfers').mean - 1.211111) < .00001);
  assert.ok(Math.abs(summary(outer, 'detour_ratio').mean - 1.3997) < .00001);
  assert.ok(Math.abs(summary(rows.filter(r => r.analysis_type === CBD), 'travel_time_min').mean - 68.855) < .00001);
  assert.ok(centreProfiles(rows, centres).every(profile => profile.count === 9));
});
