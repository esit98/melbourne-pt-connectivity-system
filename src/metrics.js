export const METRICS = {
  travel_time_min: { label: 'Travel time', unit: 'minutes', digits: 2 },
  transfers: { label: 'Passenger transfers', unit: 'passenger transfers', digits: 0 },
  detour_ratio: { label: 'Detour ratio', unit: 'ratio', digits: 3 },
  walking_distance_m: { label: 'Walking distance', unit: 'm', digits: 0 },
  minutes_per_direct_km: { label: 'Minutes per direct km', unit: 'min/km', digits: 2 },
};
export const COLORS = ['#74b9dd', '#468de0', '#6666d9', '#8646c7', '#57208e'];
export const finite = value => typeof value === 'number' && Number.isFinite(value);

// Linear interpolation at (n - 1) * p; one common distribution for both groups.
export function quantile(sorted, p) {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  return sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower);
}

export function classification(rows, key) {
  const values = rows.map(row => row[key]).filter(finite).sort((a, b) => a - b);
  if (!values.length) return { key, breaks: [], values, discrete: key === 'transfers' };
  const discrete = key === 'transfers';
  const breaks = discrete ? [...new Set(values)] :
    [...new Set([0.2, 0.4, 0.6, 0.8, 1].map(p => quantile(values, p)))];
  return { key, breaks, values, discrete };
}

export function classIndex(value, scale) {
  if (!finite(value)) return -1;
  return scale.breaks.findIndex(upper => value <= upper);
}

export function colorFor(value, scale) {
  const index = classIndex(value, scale);
  if (index < 0) return '#717985';
  const colorIndex = scale.breaks.length === 1 ? 2 : Math.round(index * (COLORS.length - 1) / (scale.breaks.length - 1));
  return COLORS[colorIndex];
}

export function visibleRoute(row, outer, cbd) {
  return row.analysis_type === 'outer_to_outer' ? outer :
    row.analysis_type === 'outer_to_cbd_benchmark' ? cbd : false;
}

export function validateCollection(data, expected, idField, geometryType) {
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features) || data.features.length !== expected ||
      (finite(data.totalFeatures) && data.totalFeatures !== expected) ||
      (finite(data.numberMatched) && data.numberMatched !== expected)) {
    throw new Error('Unexpected or incomplete study layer returned by GeoServer.');
  }
  const identifiers = new Set();
  for (const feature of data.features) {
    const id = feature.properties?.[idField];
    if (!id || identifiers.has(id) || feature.geometry?.type !== geometryType) {
      throw new Error('Missing geometry or duplicate identifier in study layer.');
    }
    identifiers.add(id);
    const visit = coordinates => {
      if (!Array.isArray(coordinates) || !coordinates.length) throw new Error('Empty geometry.');
      if (typeof coordinates[0] === 'number') {
        if (!finite(coordinates[0]) || !finite(coordinates[1]) || coordinates[0] < 144 || coordinates[0] > 146 ||
            coordinates[1] < -39 || coordinates[1] > -37) throw new Error('Unexpected study coordinates or axis order.');
      } else coordinates.forEach(visit);
    };
    visit(feature.geometry.coordinates);
    if (idField === 'route_id' && Object.keys(METRICS).some(key => !finite(feature.properties[key]))) {
      throw new Error('A core metric is missing from the published study.');
    }
  }
  return data;
}
