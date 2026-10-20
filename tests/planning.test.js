import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePlanning, renderPlanning } from '../src/planning.js';

const data=JSON.parse(readFileSync(new URL('../public/data/experimental/planning_context_v2.json',import.meta.url)));
test('experimental planning asset covers four complete directed scenarios',()=>{
  assert.equal(validatePlanning(data).rows.length,360);
  assert.equal(new Set(data.rows.map(r=>r.route_id)).size,90);
  assert.equal(data.source_year,2021);
  assert.match(data.status,/not investment advice/);
});
test('ranking view keeps proxy limitations and links to unweighted routes',()=>{
  const html=renderPlanning({v2:{scenarios:[{id:'weekday_am',label:'Weekday morning peak'}]},state:{scenario:'weekday_am',planningProfile:'balanced_experimental'},planning:data});
  assert.match(html,/not observed origin/);
  assert.match(html,/not an activity-centre catchment/);
  assert.match(html,/data-route="OD_AC\d\d_AC\d\d"/);
  assert.match(html,/2021/);
});
test('planning asset refuses incomplete coverage',()=>{
  assert.throws(()=>validatePlanning({...data,rows:data.rows.slice(1)}),/coverage validation/);
});
