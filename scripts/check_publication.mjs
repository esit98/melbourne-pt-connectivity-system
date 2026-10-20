import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const key = loadEnv('production', projectRoot, 'VITE_').VITE_CARTO_BASEMAP_KEY?.trim();
assert.ok(key && !/^(your[_-]?carto[_-]?basemap[_-]?key|your[_-]?key|placeholder|change[_-]?me|replace[_-]?me)$/i.test(key) && !/\s/.test(key), 'Valid CARTO key required for public artifact check');
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const files = [];
function visit(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) visit(path);
    else files.push(path);
  }
}
visit(root);
const names = files.map(path => relative(root, path).split(sep).join('/'));
assert.ok(names.includes('index.html'));
assert.ok(names.includes('data/study.json'));
assert.ok(names.includes('data/manifest.json'));
assert.ok(names.includes('data/route_geometries.geojson'));
assert.ok(names.includes('data/README.md'));
assert.ok(names.includes('licenses/OPENLAYERS-BSD-2-Clause.txt'));
assert.ok(names.includes('licenses/THIRD_PARTY_NOTICES.txt'));
assert.ok(names.every(name => !/(^|\/)(\.env|\.git|node_modules)(\/|$)/.test(name)));
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
assert.match(html, /\/melbourne-pt-connectivity-dashboard\/assets\//);
const scripts = files.filter(path => path.endsWith('.js')).map(path => readFileSync(path, 'utf8')).join('\n');
assert.doesNotMatch(scripts, /\/geoserver\/geom30012|127\.0\.0\.1|localhost|VITE_CARTO_BASEMAP_KEY/);
assert.match(scripts, /https:\/\/basemaps\.cartocdn\.com\/rastertiles\/light_all\//);
assert.doesNotMatch(scripts, /basemaps\.cartocdn\.com\/(?!rastertiles\/light_all\/)/);
assert.ok(scripts.includes(key), 'Built assets must contain the configured browser CARTO key');
assert.doesNotMatch(scripts, /your_carto_basemap_key|YOUR_KEY/);
assert.doesNotMatch(scripts, /sk-proj-|ghp_[A-Za-z0-9]{20}|postgres:\/\//);
assert.match(scripts, /Data Sources & Licences/);
assert.match(scripts, /\.\/licenses\/OPENLAYERS-BSD-2-Clause\.txt/);
assert.match(scripts, /\.\/data\/route_geometries\.geojson/);
console.log('Public artifact file, base-path, CARTO configuration, backend and secret checks passed');
