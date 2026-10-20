import test from 'node:test';
import assert from 'node:assert/strict';
import { classification, classIndex, colorFor, quantile, validateCollection, visibleRoute } from '../src/metrics.js';

test('quintiles interpolate, include extrema and assign boundary ties consistently', () => {
  const rows = [10, 20, 30, 40, 50, 60].map(travel_time_min => ({ travel_time_min }));
  const scale = classification(rows, 'travel_time_min');
  assert.deepEqual(scale.breaks, [20, 30, 40, 50, 60]);
  assert.equal(classIndex(20, scale), 0);
  assert.equal(classIndex(20.01, scale), 1);
  assert.equal(classIndex(60, scale), 4);
  assert.equal(quantile([0, 10], .2), 2);
});
test('null metrics never become zero and all-equal values remain usable', () => {
  const scale = classification([{ detour_ratio: null }, { detour_ratio: 1.2 }, { detour_ratio: 1.2 }], 'detour_ratio');
  assert.deepEqual(scale.breaks, [1.2]);
  assert.equal(classIndex(null, scale), -1);
  assert.equal(colorFor(1.2, scale), '#6666d9');
  assert.deepEqual(classification([], 'detour_ratio').breaks, []);
});
test('passenger transfer counts remain discrete, including genuine zero', () => {
  const scale = classification([0, 0, 1, 3].map(transfers => ({ transfers })), 'transfers');
  assert.deepEqual(scale.breaks, [0, 1, 3]);
  assert.equal(classIndex(0, scale), 0);
});
test('layer toggles select exact analysis types without changing the scale', () => {
  assert.equal(visibleRoute({ analysis_type: 'outer_to_outer' }, false, true), false);
  assert.equal(visibleRoute({ analysis_type: 'outer_to_cbd_benchmark' }, false, true), true);
  assert.equal(visibleRoute({ analysis_type: 'pilot' }, true, true), false);
});
test('service validation rejects truncation, null metrics, duplicate IDs and axis swaps', () => {
  const feature = { properties: { route_id: 'test', travel_time_min: 1, transfers: 0, detour_ratio: 1, walking_distance_m: 100, minutes_per_direct_km: 2 },
    geometry: { type: 'MultiLineString', coordinates: [[[145, -38], [145.1, -38.1]]] } };
  const collection = { type: 'FeatureCollection', features: [feature] };
  assert.equal(validateCollection(collection, 1, 'route_id', 'MultiLineString'), collection);
  assert.throws(() => validateCollection({ ...collection, numberMatched: 100 }, 1, 'route_id', 'MultiLineString'));
  assert.throws(() => validateCollection({ ...collection, features: [feature, feature] }, 2, 'route_id', 'MultiLineString'));
  const missing = structuredClone(collection); missing.features[0].properties.transfers = null;
  assert.throws(() => validateCollection(missing, 1, 'route_id', 'MultiLineString'));
  const swapped = structuredClone(collection); swapped.features[0].geometry.coordinates = [[[-38, 145], [-38.1, 145.1]]];
  assert.throws(() => validateCollection(swapped, 1, 'route_id', 'MultiLineString'));
});
