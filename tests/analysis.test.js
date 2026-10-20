import test from 'node:test';
import assert from 'node:assert/strict';
import { CBD, OUTER, centreProfiles, csvMatrix, matchesFilters, matrix, reverseRoute, routeIndex,
  scatter, summary, transferDistribution, histogramData, comparisonStats, searchStudy } from '../src/analysis.js';

const centres = [{ centre_id: 'A', centre_name: 'Alpha' }, { centre_id: 'B', centre_name: 'Beta' }];
const rows = [
  { route_id: 'AB', analysis_type: OUTER, origin_id: 'A', origin_name: 'Alpha', destination_id: 'B', destination_name: 'Beta', travel_time_min: 80, transfers: 1, detour_ratio: 1.2, walking_distance_m: 1000, minutes_per_direct_km: 3, direct_distance_m: 20000 },
  { route_id: 'BA', analysis_type: OUTER, origin_id: 'B', origin_name: 'Beta', destination_id: 'A', destination_name: 'Alpha', travel_time_min: 100, transfers: 2, detour_ratio: 1.4, walking_distance_m: 2000, minutes_per_direct_km: 4, direct_distance_m: 18000 },
  { route_id: 'ACBD', analysis_type: CBD, origin_id: 'A', origin_name: 'Alpha', destination_id: 'CBD', destination_name: 'City', travel_time_min: 50, transfers: 0, detour_ratio: 1.1, walking_distance_m: 500, minutes_per_direct_km: 2, direct_distance_m: 12000 },
];

test('multiword route search matches both names and offers centre profiles', () => {
  assert.equal(searchStudy(rows, centres, 'Alpha Beta').filter(r=>r.type==='Route').length, 2);
  assert.equal(searchStudy(rows, centres, 'Alpha')[0].type, 'Centre');
  assert.equal(searchStudy(rows, centres, 'unknown').length, 0);
});
test('histogram counts every finite value including the maximum and identical values', () => {
  assert.equal(histogramData(rows,'travel_time_min').reduce((sum,b)=>sum+b.count,0),3);
  assert.equal(histogramData([{v:5},{v:5},{v:null}],'v').reduce((sum,b)=>sum+b.count,0),2);
});
test('comparison uses signed difference and leaves zero-denominator percentage undefined', () => {
  const result=comparisonStats(rows.slice(0,2),[rows[2]],'travel_time_min');
  assert.equal(result.difference,40);assert.equal(result.percentage,80);
  assert.equal(comparisonStats(rows.slice(0,2),[rows[2]],'transfers').percentage,null);
});

test('directional matrix excludes self and benchmark and exports selected metric', () => {
  const m = matrix(rows, centres);
  assert.equal(m[0][0], null); assert.equal(m[0][1].route_id, 'AB');
  assert.equal(m[1][0].route_id, 'BA'); assert.equal(m[1][1], null);
  const csv = csvMatrix(rows, centres, 'transfers');
  assert.match(csv, /"Alpha","","1"/); assert.match(csv, /"Beta","2",""/);
});
test('reverse route exists only for analysed reverse direction', () => {
  const index = routeIndex(rows);
  assert.equal(reverseRoute(rows[0], index).route_id, 'BA');
  assert.equal(reverseRoute(rows[2], index), null);
});
test('summary and centre profile keep missing values out of calculations', () => {
  assert.deepEqual(summary([{ value: 1 }, { value: 3 }, { value: null }], 'value'),
    { count: 2, mean: 2, median: 2, min: 1, max: 3, q1: 1.5, q3: 2.5 });
  const profiles = centreProfiles(rows, centres);
  assert.equal(profiles[0].count, 1); assert.equal(profiles[0].fastest.route_id, 'AB');
  assert.equal(profiles[1].travel.mean, 100);
});
test('filters support scope, origin, all and any transparent thresholds', () => {
  const filters = { scope: OUTER, origin: 'A', match: 'all', thresholds: { travel_time_min: 70, transfers: 2 } };
  assert.equal(matchesFilters(rows[0], filters), false);
  filters.match = 'any'; assert.equal(matchesFilters(rows[0], filters), true);
  assert.equal(matchesFilters(rows[1], filters), false);
  filters.scope = CBD; assert.equal(matchesFilters(rows[0], filters), false);
  filters.scope = OUTER; filters.origin = ''; filters.thresholds = { travel_time_min: 80 }; filters.timeComparison = 'gt';
  assert.equal(matchesFilters(rows[0], filters), false); assert.equal(matchesFilters(rows[1], filters), true);
});
test('scatter and transfer counts use actual complete routes', () => {
  assert.equal(scatter(rows, 'direct_distance_m', 'travel_time_min').length, 3);
  assert.deepEqual(transferDistribution(rows), [[0, 1], [1, 1], [2, 1], [3, 0]]);
});
