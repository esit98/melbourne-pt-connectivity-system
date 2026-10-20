import './check_publication.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const root=new URL('../dist/data/v2_1/',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root),'utf8'));
const index=JSON.parse(fs.readFileSync(new URL('index.json',root),'utf8'));
assert.equal(index.run_id,'v2_1_full_1600');assert.equal(index.samples.length,1600);assert.equal(index.aggregates.length,400);
for(const [file,hash] of Object.entries(manifest.files)){
  const bytes=fs.readFileSync(new URL(file,root));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash,`Export hash mismatch: ${file}`);
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  assert.ok(!/(?:[AC]:\\|C:\/Users\/|postgres(?:ql)?:\/\/|sk-proj-|ghp_[A-Za-z0-9]{20}|"(?:password|PGPASSWORD|api_key)"\s*:)/i.test(text),`Private material in ${file}`);
}
assert.ok(fs.existsSync(new URL('../V2_1_NOTICES.md',root)));
// The Pages upload is exactly the static application and reviewed public data.
const dist=new URL('../dist/',import.meta.url);
const expected=new Set(['index.html','data/README.md','data/study.json','data/manifest.json','data/route_geometries.geojson','data/V2_1_NOTICES.md','licenses/OPENLAYERS-BSD-2-Clause.txt','licenses/THIRD_PARTY_NOTICES.txt','data/v2_1/manifest.json',...Object.keys(manifest.files).map(f=>'data/v2_1/'+f)]);
const html=fs.readFileSync(new URL('index.html',dist),'utf8');
for(const match of html.matchAll(/(?:src|href)="\/melbourne-pt-connectivity-dashboard\/(assets\/[^"?]+\.(?:js|css))"/g))expected.add(match[1]);
const actual=fs.readdirSync(dist,{recursive:true}).map(f=>String(f).replaceAll('\\','/')).filter(f=>fs.statSync(new URL(f,dist)).isFile());
assert.deepEqual([...actual].sort(),[...expected].sort(),'Unexpected or missing file in Pages artifact');
console.log(`Exact Pages upload allowlist: ${actual.length} files; no extra documentation, configuration or QA output.`);
console.log(`V2.1 artifact: ${Object.keys(manifest.files).length} data assets hash-verified; metadata privacy scan passed; component notice present.`);
