import { finite, quantile } from './metrics.js';

export const OUTER = 'outer_to_outer';
export const CBD = 'outer_to_cbd_benchmark';
export const METRIC_KEYS = ['travel_time_min', 'transfers', 'detour_ratio', 'walking_distance_m', 'minutes_per_direct_km','request_to_arrival_min','pre_departure_wait_min'];
export const labels = {
  travel_time_min: 'Travel time', transfers: 'Passenger transfers', detour_ratio: 'Detour ratio',
  walking_distance_m: 'Walking distance', minutes_per_direct_km: 'Minutes per direct km',
  request_to_arrival_min:'Elapsed from requested departure',pre_departure_wait_min:'Initial waiting opportunity',
};
export const units = {
  travel_time_min: 'min', transfers: '', detour_ratio: '', walking_distance_m: 'km', minutes_per_direct_km: 'min/km',
};

export function display(value, key) {
  if (!finite(value)) return 'N/A';
  if (key === 'walking_distance_m') return `${(value / 1000).toFixed(2)} km`;
  if (key === 'transfers') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (key === 'detour_ratio' || key === 'minutes_per_direct_km') return value.toFixed(2) + (units[key] ? ` ${units[key]}` : '');
  return `${value.toFixed(1)} min`;
}

export function summary(rows, key) {
  const values = rows.map(row => row[key]).filter(finite).sort((a, b) => a - b);
  if (!values.length) return { count: 0, mean: null, median: null, min: null, max: null, q1: null, q3: null };
  return { count: values.length, mean: values.reduce((a, b) => a + b, 0) / values.length,
    median: quantile(values, .5), min: values[0], max: values.at(-1), q1: quantile(values, .25), q3: quantile(values, .75) };
}

export function routeKey(originId, destinationId) { return `${originId}|${destinationId}`; }
export function routeIndex(rows) { return new Map(rows.map(row => [routeKey(row.origin_id, row.destination_id), row])); }
export function reverseRoute(row, index) { return index.get(routeKey(row.destination_id, row.origin_id)) || null; }
export function matrix(rows, centres) {
  const index = routeIndex(rows.filter(row => row.analysis_type === OUTER));
  return centres.map(origin => centres.map(destination => origin.centre_id === destination.centre_id ? null :
    index.get(routeKey(origin.centre_id, destination.centre_id)) || null));
}
export function centreProfiles(rows, centres) {
  const main = rows.filter(row => row.analysis_type === OUTER);
  return centres.map(centre => {
    const outbound = main.filter(row => row.origin_id === centre.centre_id);
    const sorted = [...outbound].sort((a, b) => a.travel_time_min - b.travel_time_min);
    const detour = [...outbound].sort((a, b) => b.detour_ratio - a.detour_ratio);
    return { ...centre, outbound, count: outbound.length,
      travel: summary(outbound, 'travel_time_min'), transfers: summary(outbound, 'transfers'),
      detour: summary(outbound, 'detour_ratio'), walking: summary(outbound, 'walking_distance_m'),
      minutesKm: summary(outbound, 'minutes_per_direct_km'),
      fastest: sorted[0] || null, slowest: sorted.at(-1) || null, highestDetour: detour[0] || null };
  });
}

export function matchesFilters(row, filters) {
  if (filters.scope !== 'compare' && row.analysis_type !== filters.scope) return false;
  if (filters.origin && row.origin_id !== filters.origin) return false;
  if (filters.destination && row.destination_id !== filters.destination) return false;
  const thresholds = METRIC_KEYS.filter(key => finite(filters.thresholds[key]));
  if (!thresholds.length) return true;
  const checks = thresholds.map(key => finite(row[key]) && (key === 'travel_time_min' && filters.timeComparison === 'gt' ?
    row[key] > filters.thresholds[key] : row[key] >= filters.thresholds[key]));
  return filters.match === 'any' ? checks.some(Boolean) : checks.every(Boolean);
}

export function scatter(rows, xKey, yKey) {
  return rows.filter(row => finite(row[xKey]) && finite(row[yKey])).map(row => ({
    route_id: row.route_id, name: `${row.origin_name} → ${row.destination_name}`,
    x: row[xKey], y: row[yKey], analysis_type: row.analysis_type,
  }));
}

export function transferDistribution(rows) {
  const counts = new Map();
  rows.forEach(row => { if (finite(row.transfers)) counts.set(row.transfers, (counts.get(row.transfers) || 0) + 1); });
  const bins=new Set([...counts.keys(),...Array.from({length:Math.floor(Math.max(3,...counts.keys(),0))+1},(_,i)=>i)]);
  return [...bins].sort((a,b)=>a-b).map(count=>[count,counts.get(count)||0]);
}

export function csvMatrix(rows, centres, key) {
  const table = matrix(rows, centres);
  const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [['Origin / destination', ...centres.map(c => c.centre_name)].map(quote).join(','),
    ...table.map((line, index) => [centres[index].centre_name, ...line.map(row => row ? row[key] : '')].map(quote).join(','))].join('\r\n');
}

export function histogramData(rows, key, binCount = 8) {
  const values = rows.map(row => row[key]).filter(finite);
  if (!values.length) return [];
  const min = Math.min(...values), max = Math.max(...values);
  const width = (max - min || 1) / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    lower: min + index * width, upper: min + (index + 1) * width, count: 0,
  }));
  values.forEach(value => { bins[Math.min(binCount - 1, Math.floor((value - min) / width))].count++; });
  return bins;
}

export function comparisonStats(outer, benchmark, key) {
  const a = summary(outer, key), b = summary(benchmark, key);
  const difference = finite(a.mean) && finite(b.mean) ? a.mean - b.mean : null;
  return { outer: a, benchmark: b, difference,
    percentage: finite(difference) && finite(b.mean) && b.mean !== 0 ? difference / b.mean * 100 : null };
}

export function searchStudy(rows, centres, query) {
  const tokens = query.toLowerCase().replace(/[→–—]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const matches = text => tokens.every(token => text.toLowerCase().includes(token));
  return [
    ...centres.filter(centre => matches(centre.centre_name)).map(centre => ({
      type: 'Centre', id: centre.centre_id, label: centre.centre_name,
    })),
    ...rows.filter(row => matches(`${row.origin_name} ${row.destination_name} ${row.route_id}`)).map(row => ({
      type: 'Route', id: row.route_id, label: `${row.origin_name} → ${row.destination_name}`,
    })),
  ].slice(0, 20);
}

export function orderedRoutes(rows) {
  return [...rows].sort((a, b) => a.origin_id.localeCompare(b.origin_id) || a.destination_name.localeCompare(b.destination_name));
}
