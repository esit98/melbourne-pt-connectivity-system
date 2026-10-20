import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const key = loadEnv('production', root, 'VITE_').VITE_CARTO_BASEMAP_KEY?.trim();
if (!key || /^(your[_-]?carto[_-]?basemap[_-]?key|your[_-]?key|placeholder|change[_-]?me|replace[_-]?me)$/i.test(key) || /\s/.test(key)) {
  throw new Error('Public build requires a valid VITE_CARTO_BASEMAP_KEY (GitHub Actions secret CARTO_BASEMAP_KEY).');
}
const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const result = spawnSync(process.execPath, [vite, 'build'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_PUBLICATION_MODE: 'static', VITE_CARTO_BASEMAP_KEY: key },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
