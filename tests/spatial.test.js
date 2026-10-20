import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateSpatial, renderSpatial } from '../src/spatial.js';

const data=validateSpatial(JSON.parse(readFileSync(new URL('../public/data/experimental/v2_2_spatial_pilot.json',import.meta.url),'utf8')));

test('V2.2 spatial pilot stays limited to six point pairs and 96 distinct requests',()=>{
  assert.equal(data.samples.length,96);
  assert.equal(new Set(data.samples.map(x=>x.request_key)).size,96);
  assert.equal(new Set(data.samples.map(x=>`${x.origin_point_id}|${x.destination_point_id}`)).size,6);
  assert.equal(data.points.length,5);
  for(const scenario of ['weekday_am','weekday_interpeak','weekday_pm','saturday_midday']){
    assert.equal(data.samples.filter(x=>x.scenario_id===scenario).length,24);
    assert.equal(data.centre_periods.filter(x=>x.scenario_id===scenario).length,1);
  }
});

test('spatial route view displays saved legs, both temporal metrics and proxy limits',()=>{
  const html=renderSpatial({state:{scenario:'weekday_am',spatialKey:data.samples[0].request_key},spatial:data});
  assert.match(html,/research modelling proxies/);
  assert.match(html,/Requested-to-arrival/);
  assert.match(html,/Initial waiting/);
  assert.match(html,/Saved OTP leg geometry/);
  assert.match(html,/OD_AC02_AC06/);
});

test('incomplete or duplicate saved pilot export is rejected',()=>{
  assert.throws(()=>validateSpatial({...data,samples:data.samples.slice(1)}));
  assert.throws(()=>validateSpatial({...data,samples:[...data.samples.slice(1),data.samples[1]]}));
});
