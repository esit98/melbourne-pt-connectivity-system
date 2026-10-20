import { finite, classification, classIndex } from './metrics.js';
import { display, labels, summary, histogramData, transferDistribution, scatter, comparisonStats } from './analysis.js';

export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const routeName = row => `${row.origin_name} → ${row.destination_name}`;
export const shortName = name => name === 'Fountain Gate-Narre Warren' ? 'Fountain Gate' : name === 'Melbourne Central City' ? 'Melbourne CBD' : name;
export const fmt = (value, digits = 1) => finite(value) ? value.toFixed(digits) : 'N/A';
export const km = value => finite(value) ? `${(value / 1000).toFixed(1)} km` : 'N/A';
export const clockTime = iso => iso && Number.isFinite(Date.parse(iso)) ? new Date(iso).toLocaleTimeString('en-AU', {
  timeZone: 'Australia/Melbourne', hour: '2-digit', minute: '2-digit', hour12: false,
}) : 'N/A';
export const matrixPalette = ['#9bd8d0', '#fee5a6', '#fcb780', '#f98f80', '#ed6175'];
export const mapPalette = ['#20aca5', '#97c954', '#edc22c', '#ed884a', '#e34669'];
export function paletteColor(value, scale, palette = matrixPalette) {
  const index = classIndex(value, scale);
  return index < 0 ? '#e7ebf1' : palette[Math.round(index * (palette.length - 1) / Math.max(1, scale.breaks.length - 1))];
}
export function icon(name, className = '') {
  const shapes = {
    dashboard: '<path d="m3 10 9-7 9 7v10H5V10M9 20v-7h6v7"/>',
    map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"/>',
    matrix: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    explorer: '<path d="M6 18V6m0 0 5 4-5 4M6 18h11V6"/><circle cx="6" cy="19" r="2"/><circle cx="17" cy="5" r="2"/>',
    centres: '<path d="M19 10c0 6-7 11-7 11S5 16 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
    statistics: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 17v-5m5 5V7m5 10V9"/>',
    compare: '<rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/>',
    methodology: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
    planning: '<path d="M4 20V11m6 9V7m6 13v-5m5 5H3M3 11l7-4 6 8 5-10"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v7l4 2"/>',
    swap: '<path d="M4 7h16l-4-4M20 17H4l4 4M20 7l-4 4M4 17l4-4"/>',
    detour: '<circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18h5a4 4 0 0 0 0-8H8a4 4 0 0 1 0-8h5"/>',
    train: '<rect x="6" y="3" width="12" height="15" rx="3"/><path d="M6 11h12M9 18l-2 3m8-3 2 3M9 15h1m4 0h1M12 3v8"/>',
    walk: '<circle cx="13" cy="4" r="2"/><path d="m10 21 2-7-3-3 2-4 3 5 4 1M5 12l4-3m3 5 5 7"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    left: '<path d="m14 5-7 7 7 7"/>', right: '<path d="m10 5 7 7-7 7"/>',
    close: '<path d="m5 5 14 14M19 5 5 19"/>',
  };
  return `<svg class="icon ${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${shapes[name] || shapes.methodology}</svg>`;
}
export const button = (label, attrs = '', className = '') => `<button type="button" class="${className}" ${attrs}>${label}</button>`;
export const card = (title, body, className = '', subtitle = '') => `<section class="card ${className}">${title ? `<h2>${title}</h2>` : ''}${subtitle ? `<p class="card-subtitle">${subtitle}</p>` : ''}${body}</section>`;
export function selectControl(id, options, value, label, extra = '') {
  return `<label class="field ${extra}"><span>${label}</span><select id="${id}">${options.map(([v, t]) => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
}
export function tabs(items, selected, attribute, label) {
  return `<div class="tabs" role="tablist" aria-label="${label}">${items.map(([id, text]) =>
    `<button type="button" role="tab" aria-selected="${id === selected}" data-${attribute}="${id}" class="${id === selected ? 'active' : ''}">${text}</button>`).join('')}</div>`;
}
export function metricCard(value, label, note = '', iconName = '', tone = 'blue') {
  return `<div class="metric-card ${tone}">${iconName ? `<span class="metric-icon">${icon(iconName)}</span>` : ''}<div><strong>${value}</strong><span>${label}</span>${note ? `<small>${note}</small>` : ''}</div></div>`;
}
export function legend(rows, key, palette = mapPalette) {
  const scale = classification(rows, key);
  return `<div class="legend"><strong>${esc(labels[key])}${key === 'walking_distance_m' ? ' (km)' : key === 'travel_time_min' ? ' (min)' : ''}</strong>${scale.breaks.map((upper, index) => {
    const lower = index ? scale.breaks[index - 1] : null;
    const value = n => key === 'walking_distance_m' ? (n / 1000).toFixed(2) : n.toFixed(key === 'transfers' ? 0 : key === 'travel_time_min' ? 1 : 2);
    const label = scale.discrete ? String(upper) : index === 0 ? `≤ ${value(upper)}` : `> ${value(lower)} – ${value(upper)}`;
    return `<div title="${scale.discrete ? upper : `${index ? '> ' + lower + '; ' : ''}≤ ${upper}`}"><i style="background:${paletteColor(upper, scale, palette)}"></i><span>${label}</span></div>`;
  }).join('')}<small>${scale.discrete ? 'Exact transfer counts' : 'Dataset quintile classes'}</small></div>`;
}
export function routeBars(rows, key, limit = 8) {
  const source = [...rows].filter(row => finite(row[key])).sort((a,b) => b[key] - a[key]).slice(0,limit);
  const max = Math.max(1, ...source.map(row => row[key]));
  return `<div class="route-bars">${source.map((row,i) => `<button type="button" data-route="${esc(row.route_id)}" title="${esc(routeName(row))}: ${display(row[key], key)}"><span class="rank">${i+1}.</span><span class="bar-label">${esc(shortName(row.origin_name))} → ${esc(shortName(row.destination_name))}</span><span class="bar-track"><i style="width:${Math.max(1,row[key]/max*100)}%"></i></span><strong>${display(row[key], key)}</strong></button>`).join('')}</div>`;
}
export function histogram(rows, key, binCount = 10, height = 260) {
  const bins = histogramData(rows, key, binCount);
  if (!bins.length) return '<p class="empty">No values available.</p>';
  const maxCount = Math.max(...bins.map(b => b.count), 1), x0 = 48, y0 = height - 45, plotW = 308, plotH = height - 90;
  const label = value => key === 'walking_distance_m' ? (value / 1000).toFixed(1) : value.toFixed(key === 'detour_ratio' || key === 'minutes_per_direct_km' ? 1 : 0);
  return `<svg class="chart histogram" viewBox="0 0 385 ${height}" role="img" aria-label="${esc(labels[key])} distribution for ${rows.length} routes">
    ${[0,.5,1].map(f=>`<line class="gridline" x1="${x0}" y1="${y0-f*plotH}" x2="${x0+plotW}" y2="${y0-f*plotH}"/><text x="${x0-8}" y="${y0-f*plotH+4}" text-anchor="end">${Math.round(f*maxCount)}</text>`).join('')}
    ${bins.map((bin,i)=>`<rect x="${x0+i*plotW/binCount+1}" y="${y0-bin.count/maxCount*plotH}" width="${plotW/binCount-2}" height="${bin.count/maxCount*plotH}" rx="1"><title>${label(bin.lower)}–${label(bin.upper)}: ${bin.count} routes</title></rect>`).join('')}
    <text x="${x0}" y="${height-25}">${label(bins[0].lower)}</text><text x="${x0+plotW}" y="${height-25}" text-anchor="end">${label(bins.at(-1).upper)}</text>
    <text x="${x0+plotW/2}" y="${height-6}" text-anchor="middle">${esc(labels[key])}${key==='walking_distance_m'?' (km)':key==='travel_time_min'?' (min)':''}</text>
    <text x="12" y="${height/2}" text-anchor="middle" transform="rotate(-90 12 ${height/2})">Number of routes</text></svg>`;
}
export function transferChart(rows, height = 260) {
  const y0 = height - 45, plotH = height - 90;
  const counts = transferDistribution(rows), max = Math.max(1,...counts.map(([,n])=>n));
  return `<svg class="chart transfer-chart" viewBox="0 0 385 ${height}" role="img" aria-label="Passenger-transfer distribution">
    ${[0,.5,1].map(f=>`<line class="gridline" x1="48" y1="${y0-f*plotH}" x2="356" y2="${y0-f*plotH}"/><text x="39" y="${y0+4-f*plotH}" text-anchor="end">${Math.round(f*max)}</text>`).join('')}
    ${counts.map(([count,n],i)=>`<g><rect x="${64+i*288/counts.length}" y="${y0-n/max*plotH}" width="${220/counts.length}" height="${n/max*plotH}" rx="2"/><text x="${64+i*288/counts.length+110/counts.length}" y="${y0-8-n/max*plotH}" text-anchor="middle">${n}</text><text x="${64+i*288/counts.length+110/counts.length}" y="${height-25}" text-anchor="middle">${count}</text><title>${count} transfers: ${n} routes</title></g>`).join('')}
    <text x="205" y="${height-5}" text-anchor="middle">Passenger transfers</text><text x="12" y="${height/2}" text-anchor="middle" transform="rotate(-90 12 ${height/2})">Number of routes</text></svg>`;
}
export function scatterChart(rows, xKey, yKey, xLabel, yLabel, height = 280) {
  const y0 = height - 55, plotH = height - 100;
  const points = scatter(rows,xKey,yKey);
  if (!points.length) return '<p class="empty">No complete values available.</p>';
  const multiplier = key => key.endsWith('_distance_m') ? .001 : 1;
  const maxX = Math.max(...points.map(p=>p.x*multiplier(xKey)),1)*1.08;
  const maxY = Math.max(...points.map(p=>p.y*multiplier(yKey)),1)*1.08;
  return `<svg class="chart scatter" viewBox="0 0 385 ${height}" role="group" aria-label="${esc(yLabel)} versus ${esc(xLabel)}">
    ${[0,.25,.5,.75,1].map(f=>`<line class="gridline" x1="48" y1="${y0-f*plotH}" x2="356" y2="${y0-f*plotH}"/><text x="39" y="${y0+4-f*plotH}" text-anchor="end">${fmt(maxY*f,maxY<10?1:0)}</text><text x="${48+f*308}" y="${height-35}" text-anchor="middle">${fmt(maxX*f,maxX<10?1:0)}</text>`).join('')}
    ${points.map(p=>`<circle cx="${48+p.x*multiplier(xKey)/maxX*308}" cy="${y0-p.y*multiplier(yKey)/maxY*plotH}" r="3.7" class="${p.analysis_type === 'outer_to_cbd_benchmark' ? 'benchmark' : ''}" data-route="${esc(p.route_id)}" tabindex="0" role="button" aria-label="${esc(p.name)}: ${fmt(p.x*multiplier(xKey),2)} ${esc(xLabel)}, ${fmt(p.y*multiplier(yKey),2)} ${esc(yLabel)}"><title>${esc(p.name)}\n${esc(xLabel)}: ${fmt(p.x*multiplier(xKey),2)}\n${esc(yLabel)}: ${fmt(p.y*multiplier(yKey),2)}</title></circle>`).join('')}
    <text x="202" y="${height-11}" text-anchor="middle">${esc(xLabel)}</text><text x="12" y="${height/2}" text-anchor="middle" transform="rotate(-90 12 ${height/2})">${esc(yLabel)}</text></svg>`;
}
export function groupComparison(outer, cbd) {
  const keys = ['travel_time_min','transfers','detour_ratio'];
  return `<p class="chart-key"><span><i></i>Outer → Outer</span><span><i class="teal"></i>Outer → CBD</span></p><div class="group-chart">${keys.map(key=>{
    const a=summary(outer,key).mean,b=summary(cbd,key).mean,max=Math.max(a,b,1);
    return `<div class="group-metric"><div class="paired-bars"><div><b>${fmt(a,key==='travel_time_min'?1:2)}</b><i style="height:${a/max*128}px"></i></div><div><b>${fmt(b,key==='travel_time_min'?1:2)}</b><i style="height:${b/max*128}px"></i></div></div><span>${key==='transfers'?'Transfers':labels[key]}${key==='travel_time_min'?'<small>(min)</small>':''}</span></div>`;
  }).join('')}</div>`;
}
export function comparisonTable(outer,cbd) {
  return `<div class="table-scroll"><table class="data-table"><thead><tr><th>Metric</th><th>Outer → Outer</th><th>Outer → CBD</th><th>Difference</th><th>% difference</th></tr></thead><tbody>${Object.keys(labels).map(key=>{
    const result=comparisonStats(outer,cbd,key);
    return `<tr><th>${labels[key]}</th><td>${display(result.outer.mean,key)}</td><td>${display(result.benchmark.mean,key)}</td><td>${finite(result.difference)?(result.difference>0?'+':'')+display(result.difference,key):'N/A'}</td><td>${finite(result.percentage)?(result.percentage>0?'+':'')+fmt(result.percentage,1)+'%':'N/A'}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

// Independent within-metric scales; formatting only, using the existing comparison calculation.
export function comparisonRows(outer, cbd) {
  return `<div class="comparison-rows">${Object.keys(labels).map(key => {
    const result = comparisonStats(outer, cbd, key);
    const maximum = Math.max(result.outer.mean ?? 0, result.benchmark.mean ?? 0);
    const bar = (value, name, className) => `<div class="comparison-value ${className}"><span>${name}</span><strong>${display(value,key)}</strong><div class="comparison-track" aria-hidden="true"><i style="width:${finite(value) && maximum > 0 ? value / maximum * 100 : 0}%"></i></div></div>`;
    const difference = finite(result.difference) ? `${result.difference > 0 ? '+' : ''}${display(result.difference,key)}` : 'N/A';
    const percent = finite(result.percentage) ? `${result.percentage > 0 ? '+' : ''}${fmt(result.percentage)}%` : 'N/A';
    return `<section class="comparison-row" data-comparison="${key}"><h3>${labels[key]}</h3>${bar(result.outer.mean,'Outer → Outer','outer')}${bar(result.benchmark.mean,'Outer → CBD','cbd')}<div class="comparison-difference"><span>Difference</span><strong>${difference}</strong><small title="${finite(result.percentage) ? 'Difference as a percentage of the CBD mean' : 'Percentage unavailable because the CBD mean is zero or missing'}">${percent}</small></div></section>`;
  }).join('')}</div>`;
}
