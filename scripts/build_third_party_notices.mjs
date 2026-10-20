// Bundle notices for every production dependency, including packages that may
// be tree-shaken from this particular Vite build. This is intentionally broad.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const destination = join(root, 'public/licenses/THIRD_PARTY_NOTICES.txt');
const apache = readFileSync(join(root, 'node_modules/web-worker/LICENSE'), 'utf8').trim();
const sections = [
  'Third-party software notices for the public dashboard',
  'Generated from the pinned production dependencies in package-lock.json.',
  'These terms apply to their respective packages, not to the original dashboard code or research data.',
];
for (const [path, info] of Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b))) {
  if (!path || info.dev) continue;
  const directory = join(root, path);
  const file = readdirSync(directory).find(name => /^(licen[cs]e|copying|notice)(\.|$)/i.test(name));
  let notice;
  if (file) notice = readFileSync(join(directory, file), 'utf8').trim();
  else if (path === 'node_modules/lerc') {
    notice = 'Copyright © 2017–2021 Esri. Licensed under Apache License 2.0.\n\n' + apache;
  } else throw new Error(`Missing licence notice for ${path}`);
  assert.ok(info.license && notice.length > 50, `Incomplete notice for ${path}`);
  sections.push(`\n${'='.repeat(72)}\n${path.slice('node_modules/'.length)} ${info.version} — ${info.license}\n${'='.repeat(72)}\n${notice}`);
}
const content = sections.join('\n') + '\n';
if (process.argv.includes('--check')) assert.equal(readFileSync(destination, 'utf8'), content);
else writeFileSync(destination, content);
console.log(`Notices verified for ${sections.length - 3} production packages`);
