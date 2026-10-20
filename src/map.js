import Map from 'ol/Map.js';
import View from 'ol/View.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import Feature from 'ol/Feature.js';
import LineString from 'ol/geom/LineString.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import XYZ from 'ol/source/XYZ.js';
import VectorSource from 'ol/source/Vector.js';
import { Circle, Fill, Stroke, Style, Text } from 'ol/style.js';
import { defaults as defaultControls, ScaleLine } from 'ol/control.js';
import { fromLonLat } from 'ol/proj.js';
import { createEmpty, extend } from 'ol/extent.js';
import { classification } from './metrics.js';
import { matchesFilters, labels, display, METRIC_KEYS } from './analysis.js';
import { paletteColor, mapPalette, shortName } from './ui.js';

const format = new GeoJSON();
const routeSource = new VectorSource();
const centreSource = new VectorSource();
const directSource = new VectorSource();
const state = { selected: null, metric: 'travel_time_min', filters: { scope: 'compare', origin: '', thresholds: {}, match: 'all' },
  showRoutes: true, showDirect: false, showCentres: true, onlySelected: false, centreFocus: '' };
let routeFeatures = [];
let centreFeatures = [];
let scales = {};
let onSelect = () => {};
let onCentre = () => {};
let hoveredId = null;

const configuredKey = import.meta.env.VITE_CARTO_BASEMAP_KEY?.trim();
const cartoKey = configuredKey && configuredKey !== 'your_carto_basemap_key' ? configuredKey : '';
const cartoUrl = 'https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png';
const base = new XYZ({
  url: cartoUrl + (cartoKey ? `?key=${encodeURIComponent(cartoKey)}` : ''),
  attributions: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://carto.com/attribution/">CARTO</a>', maxZoom: 20,
});
const baseLayer = new TileLayer({ source: base, visible: Boolean(cartoKey) });
const routeLayer = new VectorLayer({ source: routeSource, style: feature => {
  const row = feature.getProperties();
  if (!state.showRoutes || !matchesFilters(row, state.filters) || (state.onlySelected && row.route_id !== state.selected)) return undefined;
  const color = state.selected ? '#8394a8' : paletteColor(row[state.metric], scales[state.metric], mapPalette);
  return new Style({ stroke: new Stroke({ color, width: 2,
    lineDash: row.analysis_type === 'outer_to_cbd_benchmark' ? [7, 5] : undefined }) });
} });
// Separate emphasis from the translucent network so overlapping normal routes
// remain subdued as a group, while the selected itinerary stays fully opaque.
const emphasisLayer = new VectorLayer({ source: routeSource, style: feature => {
  const row = feature.getProperties(), selected = row.route_id === state.selected;
  if (!state.showRoutes || !matchesFilters(row,state.filters) || (state.onlySelected && !selected)) return undefined;
  if (selected) return [new Style({ zIndex: 20, stroke: new Stroke({ color: '#fff', width: 8 }) }),
    new Style({ zIndex: 21, stroke: new Stroke({ color: '#075cf4', width: 4.5 }) })];
  if (row.route_id !== hoveredId) return undefined;
  const hex = paletteColor(row[state.metric],scales[state.metric],mapPalette);
  const color = [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16),.88];
  return new Style({ zIndex: 10, stroke: new Stroke({ color, width: 4,
    lineDash: row.analysis_type === 'outer_to_cbd_benchmark' ? [7,5] : undefined }) });
} });
const centreLayer = new VectorLayer({ source: centreSource, declutter: true, style: feature => {
  const id = feature.get('centre_id');
  if (state.hideCBD && id === 'CBD01') return undefined;
  const selected = state.selected && routeFeatures.find(f => f.get('route_id') === state.selected);
  const active = selected && (id === selected.get('origin_id') || id === selected.get('destination_id'));
  const focused = id === state.centreFocus;
  return new Style({ zIndex: active || focused ? 10 : 1, image: new Circle({ radius: focused ? 9 : active ? 8 : 5.5, declutterMode: 'none',
    fill: new Fill({ color: active || focused ? '#075cf4' : id === 'CBD01' || state.centreFocus ? '#8496b0' : '#2467ce' }),
    stroke: new Stroke({ color: '#fff', width: 2 }) }),
    text: new Text({ text: `${active ? (id === selected.get('origin_id') ? 'Origin: ' : 'Destination: ') : ''}${shortName(feature.get('centre_name'))}`, font: `${active || focused ? 'bold ' : ''}12px Arial`,
      offsetY: -17, fill: new Fill({ color: active || focused ? '#071c58' : '#34446a' }),
      stroke: new Stroke({ color: '#fff', width: 3 }) }) });
} });
const directLayer = new VectorLayer({ source: directSource, style: new Style({
  stroke: new Stroke({ color: '#e88722', width: 2.5, lineDash: [8, 6] }),
}) });
const map = new Map({ target: 'map', layers: [baseLayer, routeLayer, emphasisLayer, directLayer, centreLayer],
  controls: defaultControls({ attributionOptions: { collapsible: false } }).extend([new ScaleLine()]),
  view: new View({ center: fromLonLat([144.97, -37.9]), zoom: 9, minZoom: 7, maxZoom: 18 }) });

let consecutiveTileFailures = 0;
function setBasemapAvailable(available) {
  const status = document.getElementById('basemap-status');
  if (!status) return;
  status.hidden = available;
  baseLayer.setVisible(available);
  document.getElementById('map-shell')?.classList.toggle('basemap-unavailable', !available);
}
function retryBasemap() {
  consecutiveTileFailures = 0;
  const canRetry = Boolean(cartoKey) && navigator.onLine;
  setBasemapAvailable(canRetry);
  if (canRetry) { base.refresh(); map.render(); }
}
base.on('tileloaderror', () => {
  consecutiveTileFailures += 1;
  if (consecutiveTileFailures >= 3) setBasemapAvailable(false);
});
base.on('tileloadend', () => { consecutiveTileFailures = 0; setBasemapAvailable(true); });
window.addEventListener('offline', () => setBasemapAvailable(false));
window.addEventListener('online', retryBasemap);
document.getElementById('retry-basemap')?.addEventListener('click', retryBasemap);
if (!cartoKey || !navigator.onLine) setBasemapAvailable(false);

export function setMapData(routes, centres) {
  routeFeatures = format.readFeatures(routes, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
  centreFeatures = format.readFeatures(centres, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
  routeSource.clear(); centreSource.clear(); routeSource.addFeatures(routeFeatures); centreSource.addFeatures(centreFeatures);
  scales = Object.fromEntries(METRIC_KEYS
    .map(key => [key, classification(routes.features.map(f => f.properties), key)]));
  fitStudy();
}
export function setMapSelection(callback, centreCallback = () => {}) { onSelect = callback; onCentre = centreCallback; }
export function updateMap(next) {
  Object.assign(state, next);
  hoveredId = null;
  document.getElementById('map-status').textContent = '';
  routeLayer.setOpacity(state.selected ? .22 : state.centreFocus ? .65 : .45);
  routeLayer.changed(); centreLayer.changed();
  emphasisLayer.changed();
  centreLayer.setVisible(state.showCentres);
  directLayer.setVisible(state.showDirect);
  directSource.clear();
  const selected = routeFeatures.find(f => f.get('route_id') === state.selected);
  const warnings=selected?.get('geometry_warnings')||[];
  const warning=document.getElementById('map-warning');warning.hidden=!warnings.length;
  warning.textContent=warnings.length?`Saved geometry offset warning: ${warnings.map(w=>`leg ${w.leg}, ${w.gap_m.toFixed(1)} m${w.requested_departure?' at '+w.requested_departure.slice(11,16):''}`).join('; ')}. Inspect the flagged departure in Route Explorer. No snapping applied.`:'';
  if (selected && state.showDirect) {
    const coordinates = selected.get('direct_od_coordinates');
    if (coordinates?.length === 2) directSource.addFeature(new Feature(new LineString(coordinates.map(coordinate => fromLonLat(coordinate)))));
  }
}
export function mountMap(slot) {
  const shell = document.getElementById('map-shell');
  slot.append(shell); shell.hidden = false;
  resizeMap();
}
export function resizeMap() { requestAnimationFrame(() => map.updateSize()); }
new ResizeObserver(resizeMap).observe(document.getElementById('map-shell'));
export function fitStudy() {
  const extent = createEmpty();
  if (routeFeatures.length) extend(extent, routeSource.getExtent());
  if (centreFeatures.length) extend(extent, centreSource.getExtent());
  if (extent.every(Number.isFinite)) map.getView().fit(extent, { padding: [35, 35, 35, 35], maxZoom: 10 });
}
export function fitSelected() {
  const feature = routeFeatures.find(f => f.get('route_id') === state.selected);
  if (feature?.getGeometry()) map.getView().fit(feature.getGeometry().getExtent(), { padding: [40, 40, 40, 40], maxZoom: 13 });
}
export function fitCentre(id) {
  const matches = routeFeatures.filter(f => f.get('origin_id') === id && f.get('analysis_type') === 'outer_to_outer');
  const extent = createEmpty(); matches.forEach(f => extend(extent, f.getGeometry().getExtent()));
  // Reserve the right edge for the compact legend so eastern endpoints stay visible.
  if (matches.length) map.getView().fit(extent, { padding: [40, map.getSize()[0] <= 400 ? 35 : 165, 40, 35], maxZoom: 11 });
}
map.on('singleclick', event => {
  const hits = [];
  map.forEachFeatureAtPixel(event.pixel, (feature, layer) => {
    if (layer === centreLayer) hits.unshift({ layer, feature });
    else if ((layer === routeLayer || layer === emphasisLayer) && matchesFilters(feature.getProperties(), state.filters) &&
      !hits.some(hit => hit.feature === feature)) hits.push({ layer, feature });
  }, { hitTolerance: 6 });
  const centre = hits.find(hit => hit.layer === centreLayer);
  if (centre) { onCentre(centre.feature.get('centre_id')); return; }
  const routes = hits.filter(hit => hit.layer === routeLayer || hit.layer === emphasisLayer).map(hit => hit.feature.get('route_id')).sort();
  if (routes.length) onSelect(routes);
});
map.on('pointermove', event => {
  if (event.dragging) return;
  const hit = map.forEachFeatureAtPixel(event.pixel, (feature, layer) => layer === routeLayer && matchesFilters(feature.getProperties(), state.filters) ? feature : null,
    { hitTolerance: 5 });
  const nextId = hit?.get('route_id') ?? null;
  if (nextId !== hoveredId) { hoveredId = nextId; emphasisLayer.changed(); }
  map.getTargetElement().style.cursor = hit ? 'pointer' : '';
  document.getElementById('map-status').textContent = hit ?
    `${hit.get('origin_name')} → ${hit.get('destination_name')}\n${labels[state.metric]}: ${display(hit.get(state.metric),state.metric)}` : '';
});
map.getViewport().addEventListener('pointerleave', () => {
  hoveredId = null; emphasisLayer.changed();
  document.getElementById('map-status').textContent = '';
  map.getTargetElement().style.cursor = '';
});
