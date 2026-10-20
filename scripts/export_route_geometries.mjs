// Publish the saved route lines as a separately attributed, machine-readable copy.
// This copies validated coordinates only; it does not run routing or recalculate results.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const source = new URL('../public/data/study.json', import.meta.url);
const manifestPath = new URL('../public/data/manifest.json', import.meta.url);
const destination = new URL('../public/data/route_geometries.geojson', import.meta.url);
const sourceBytes = readFileSync(source);
const sourceHash = createHash('sha256').update(sourceBytes).digest('hex');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
assert.equal(sourceHash, manifest.study_sha256, 'Frozen study hash differs from manifest');
const study = JSON.parse(sourceBytes);
assert.equal(study.routes.features.length, 100);
const features = study.routes.features.map(feature => {
  assert.equal(feature.geometry.type, 'MultiLineString');
  assert.ok(feature.geometry.coordinates.length > 0);
  return {
    type: 'Feature',
    properties: { route_id: feature.properties.route_id },
    geometry: feature.geometry,
  };
});
assert.equal(new Set(features.map(feature => feature.properties.route_id)).size, 100);
const output = {
  type: 'FeatureCollection',
  name: 'Saved OpenTripPlanner itinerary geometries',
  attribution: 'Contains information from OpenStreetMap contributors, available under the Open Database License (ODbL). Transit geometry also derives from Transport Victoria GTFS Schedule, CC BY 4.0.',
  license: 'ODbL-1.0 for the OSM-derived route geometry database component',
  license_url: 'https://opendatacommons.org/licenses/odbl/1-0/',
  notice: 'See data/README.md for source-specific terms, attribution, and the derivation method.',
  source_study_sha256: sourceHash,
  features,
};
const bytes = Buffer.from(JSON.stringify(output) + '\n');
if (process.argv.includes('--check')) {
  assert.deepEqual(readFileSync(destination), bytes, 'Route geometry copy differs from saved study');
} else {
  writeFileSync(destination, bytes);
}
console.log(`100 saved geometries; SHA-256 ${createHash('sha256').update(bytes).digest('hex')}`);
