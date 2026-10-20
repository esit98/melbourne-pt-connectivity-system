import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {validateIndex,scenarioRows,matchedChanges,geometryCollection,ranked,melbourneTime} from '../src/temporal.js';
import {OUTER,CBD,summary,matchesFilters,transferDistribution} from '../src/analysis.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../public/data/'+p,import.meta.url)));
const data=read('v2_1/index.json');
test('frontend source remains valid UTF-8 after Windows edits',()=>{
  for(const file of fs.readdirSync(new URL('../src/',import.meta.url))){if(/\.(js|css)$/.test(file))new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(new URL('../src/'+file,import.meta.url)));}
});
test('V2.1 export counts, unique requests, dates and frozen centre identities',()=>{
  assert.equal(validateIndex(data),data);
  const names=Object.fromEntries(data.pairs.map(p=>[p.origin_id,p.origin_name]));
  assert.equal(names.AC08,'Fountain Gate-Narre Warren');assert.equal(names.AC09,'Cranbourne');assert.equal(names.AC10,'Frankston');
  for(const scenario of data.scenarios){const ss=data.samples.filter(s=>s.scenario_id===scenario.id);assert.equal(ss.length,400);assert.equal(new Set(ss.map(s=>s.route_id)).size,100);for(const s of ss){assert.equal(s.requested_departure.slice(0,10),scenario.dates[0]);assert.ok(scenario.times.includes(s.requested_departure.slice(11,16)));assert.ok(s.requested_departure.endsWith('+11:00'));}}
  assert.throws(()=>validateIndex({...data,samples:[...data.samples.slice(1),data.samples[1]]}),/Duplicate/);
});
test('all individual temporal equations and walking components preserve saved definitions',()=>{
  for(const s of data.samples){const m=s.metrics;assert.ok(Math.abs((Date.parse(m.actual_arrival)-Date.parse(m.actual_departure))/60000-m.travel_time_min)<1e-8);assert.ok(Math.abs(m.travel_time_min+m.pre_departure_wait_min-m.request_to_arrival_min)<1e-8);assert.ok(Math.abs(s.walking.access_m+s.walking.transfer_m+s.walking.egress_m-m.walking_distance_m)<1e-7);assert.ok(Number.isInteger(m.transfers));}
  assert.match(melbourneTime('2026-10-12T20:30:00Z'),/13 Oct.*07:30:00/);
});
test('400 display rows reproduce independent four-sample medians and preserve direction',()=>{
  for(const scenario of data.scenarios){const rows=scenarioRows(data,scenario.id);assert.equal(rows.length,100);assert.equal(rows.filter(r=>r.analysis_type===OUTER).length,90);assert.equal(rows.filter(r=>r.analysis_type===CBD).length,10);
    for(const r of rows){const s=data.samples.filter(s=>s.route_id===r.route_id&&s.scenario_id===scenario.id);for(const k of ['travel_time_min','transfers','walking_distance_m','request_to_arrival_min','pre_departure_wait_min','detour_ratio'])assert.ok(Math.abs(r[k]-summary(s.map(s=>s.metrics),k).median)<1e-9);}
    const f=rows.find(r=>r.route_id==='OD_AC01_AC02'),rev=rows.find(r=>r.route_id==='OD_AC02_AC01');assert.notEqual(f.travel_time_min,rev.travel_time_min);
  }
});
test('matched comparisons retain cohort, sign and zero changes for same scenario',()=>{
  const a=scenarioRows(data,'weekday_am'),b=scenarioRows(data,'weekday_interpeak');assert.equal(matchedChanges(a,b,OUTER).length,90);assert.equal(matchedChanges(a,b,CBD).length,10);assert.ok(matchedChanges(a,a,OUTER).every(r=>Object.values(r.delta).every(v=>v===0)));
  assert.ok(Math.abs(summary(matchedChanges(a,b,OUTER).map(r=>r.delta),'travel_time_min').mean-2.42)<.01);
});
test('authoritative pooled cohort summaries and diagnostic counts match source',()=>{
  for(const s of data.scenarios)for(const c of [OUTER,CBD]){const ids=new Set(data.pairs.filter(p=>p.analysis_type===c).map(p=>p.route_id));const rows=data.samples.filter(x=>x.scenario_id===s.id&&ids.has(x.route_id)).map(x=>x.metrics);for(const k of ['travel_time_min','transfers','walking_distance_m','request_to_arrival_min','pre_departure_wait_min'])assert.equal(summary(rows,k).median,data.cohorts[`${s.id} / ${c}`][k].median);}
  assert.equal(data.samples.filter(s=>s.geometry_warnings.length).length,2);assert.equal(data.samples.filter(s=>s.arrival_disadvantage_min>1e-8).length,686);assert.equal(data.samples.filter(s=>s.metrics.walking_distance_m>2000).length,267);
});
test('all retained route chunks preserve selections and leg coverage with no duplicates',()=>{
  let count=0,candidates=0,legs=0;for(const p of data.pairs){const chunk=read(`v2_1/routes/${p.route_id}.json`);assert.equal(chunk.samples.length,16);for(const s of chunk.samples){const common=data.samples.find(x=>x.request_key===s.request_key);assert.deepEqual(s.metrics,common.metrics);const selected=s.candidates.filter(c=>c.selected);assert.equal(selected.length,1);assert.equal(selected[0].candidate_id,s.selected_id);assert.equal(selected[0].otp_order,s.selected_order);assert.deepEqual(selected[0].legs,s.legs);assert.equal(s.geometry.coordinates.length,s.legs.length);count++;candidates+=s.candidates.length;legs+=s.legs.length;}}
  assert.equal(count,1600);assert.equal(candidates,4755);assert.equal(legs,8091);
});
test('scenario geometries match retained samples and invalid geometry fails visibly',()=>{
  for(const s of data.scenarios){const geo=read(`v2_1/scenarios/${s.id}.geojson`);const result=geometryCollection(geo,scenarioRows(data,s.id));for(const f of result.features){const sample=data.samples.find(x=>x.request_key===f.properties.representative_request_key);assert.equal(sample.scenario_id,s.id);assert.equal(sample.route_id,f.properties.route_id);const chunk=read(`v2_1/routes/${sample.route_id}.json`);assert.deepEqual(f.geometry,chunk.samples.find(x=>x.request_key===sample.request_key).geometry);}}
  const bad=read('v2_1/scenarios/weekday_am.geojson');bad.features[0].geometry=null;assert.throws(()=>geometryCollection(bad,scenarioRows(data,'weekday_am')),/invalid/);
});
test('manifest hashes cover every generated versioned asset',()=>{
  const manifest=read('v2_1/manifest.json');for(const [file,hash] of Object.entries(manifest.files)){assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../public/data/v2_1/'+file,import.meta.url))).digest('hex'),hash);}
});

test('complete ODbL geometry download contains every selected sample exactly once',()=>{
  const complete=read('v2_1/selected_geometries.geojson'),selected=new Map();
  for(const pair of data.pairs){for(const sample of read(`v2_1/routes/${pair.route_id}.json`).samples)selected.set(sample.request_key,sample);}
  assert.equal(complete.features.length,1600);assert.equal(selected.size,1600);
  const seen=new Set();
  for(const feature of complete.features){
    const p=feature.properties,s=selected.get(p.request_key);assert.ok(s);assert.ok(!seen.has(p.request_key));seen.add(p.request_key);
    assert.equal(p.route_id,s.route_id);assert.equal(p.scenario_id,s.scenario_id);assert.equal(p.requested_departure,s.requested_departure);
    assert.deepEqual(feature.geometry,s.geometry);assert.deepEqual(p.geometry_warnings,s.geometry_warnings);
  }
});
test('destination filters, fractional median transfers and tied ranks remain valid',()=>{
  const rows=scenarioRows(data,'weekday_am');const filtered=rows.filter(r=>matchesFilters(r,{scope:OUTER,origin:'AC01',destination:'AC02',thresholds:{}}));assert.equal(filtered.length,1);assert.equal(filtered[0].route_id,'OD_AC01_AC02');
  assert.equal(transferDistribution([{transfers:.5},{transfers:1.5}]).reduce((n,x)=>n+x[1],0),2);
  assert.deepEqual(ranked([{route_id:'b',x:3},{route_id:'a',x:3},{route_id:'c',x:2}],'x').map(r=>r.rank),[1,1,3]);
});
