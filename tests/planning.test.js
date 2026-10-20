import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePlanning, renderPlanning, weightedComponents, profileWeights } from '../src/planning.js';

const data=JSON.parse(readFileSync(new URL('../public/data/experimental/planning_context_v2.json',import.meta.url)));
test('experimental planning asset covers four complete directed scenarios',()=>{
  assert.equal(validatePlanning(data).rows.length,360);
  assert.equal(new Set(data.rows.map(r=>r.route_id)).size,90);
  assert.equal(data.source_year,2021);
  assert.match(data.status,/not investment advice/);
});
test('ranking view keeps proxy limitations and links to unweighted routes',()=>{
  const html=renderPlanning({v2:{scenarios:[{id:'weekday_am',label:'Weekday morning peak'}]},state:{scenario:'weekday_am',planningProfile:'balanced_experimental'},planning:data});
  assert.match(html,/not observed OD demand/);
  assert.match(html,/not an activity-centre catchment/);
  assert.match(html,/data-route="OD_AC\d\d_AC\d\d"/);
  assert.match(html,/planning-bars/);
  assert.match(html,/data-planning-route=/);
  assert.match(html,/Open full ranking table/);
  assert.match(html,/2021/);
});

test('displayed weighted components reproduce every stored profile score',()=>{
  for(const row of data.rows)for(const [key,weights] of Object.entries(profileWeights)){
    assert.equal(weights.reduce((a,b)=>a+b,0),1);
    const total=weightedComponents(row,key).reduce((sum,part)=>sum+part.value,0);
    assert.ok(Math.abs(total-row[key])<1e-10,`${row.route_id} ${row.scenario_id} ${key}`);
  }
});
test('planning asset refuses incomplete coverage',()=>{
  assert.throws(()=>validatePlanning({...data,rows:data.rows.slice(1)}),/coverage validation/);
});
