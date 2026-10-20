import { esc, button, card, selectControl } from './ui.js';

export const profiles=[
  ['connectivity_burden','Unweighted connectivity burden'],
  ['demand_context','Demand context proxies · residents + jobs'],
  ['equity_context','Equity context only'],
  ['balanced_experimental','Experimental combined · 50 / 25 / 25'],
  ['population_context_emphasis','Demand context emphasis · 40 / 40 / 20'],
  ['equity_context_emphasis','Equity emphasis · 40 / 20 / 40'],
];

export function validatePlanning(data){
  if(data?.schema_version!=='experimental-planning-context-v2'||data.routing_run_id!=='v2_1_full_1600'||data.source_year!==2021||data.centres?.length!==10||data.rows?.length!==360)throw Error('Planning context failed identity or coverage validation');
  const groups=new Map();
  for(const row of data.rows){
    if(!/^OD_AC\d\d_AC\d\d$/.test(row.route_id)||!/^AC\d\d$/.test(row.origin_id)||!/^AC\d\d$/.test(row.destination_id))throw Error('Invalid planning route identity');
    if(!groups.has(row.scenario_id))groups.set(row.scenario_id,new Set());
    const set=groups.get(row.scenario_id);if(set.has(row.route_id))throw Error('Duplicate planning route');set.add(row.route_id);
    for(const [key] of profiles){if(!Number.isFinite(row[key])||!Number.isInteger(row[`rank_${key}`])||row[`rank_${key}`]<1||row[`rank_${key}`]>90)throw Error('Invalid planning score or rank');}
  }
  if(groups.size!==4||[...groups.values()].some(s=>s.size!==90))throw Error('Planning scenario coverage incomplete');
  return data;
}

const number=(x,decimals=1)=>Number(x).toFixed(decimals);
function table(rows){
  return `<div class="v2-table-scroll" tabindex="0" aria-label="Scrollable experimental ranking table"><table class="v2-table"><thead><tr><th>Rank</th><th>Directed pair</th><th>Score</th><th>Duration</th><th>Transfers</th><th>Walking</th><th>IRSD context</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.currentRank}</td><td>${button(esc(`${r.originName} → ${r.destinationName}`),`data-route="${r.route_id}"`)}</td><td>${number(r.currentScore,3)}</td><td>${number(r.median_travel_time_min)} min</td><td>${number(r.median_transfers)}</td><td>${number(r.median_walking_distance_m/1000,2)} km</td><td>${esc(r.originIrsd)} / ${esc(r.destinationIrsd)} decile</td></tr>`).join('')}</tbody></table></div>`;
}

export function renderPlanning({v2,state,planning}){
  if(!planning)return '<p>Experimental planning context is unavailable.</p>';
  const key=profiles.some(([name])=>name===state.planningProfile)?state.planningProfile:'connectivity_burden';
  const names=new Map(planning.centres.map(c=>[c.centre_id,c.centre_name]));
  const irsd=new Map(planning.centres.map(c=>[c.centre_id,c.irsd_decile_2021_sa2]));
  const current=planning.rows.filter(r=>r.scenario_id===state.scenario).map(r=>({
    ...r,currentRank:r[`rank_${key}`],currentScore:r[key],originName:names.get(r.origin_id),destinationName:names.get(r.destination_id),
    originIrsd:irsd.get(r.origin_id),destinationIrsd:irsd.get(r.destination_id),
  })).sort((a,b)=>a.currentRank-b.currentRank);
  if(current.length!==90)return '<p>Scenario ranking coverage is incomplete.</p>';
  const base=new Set(current.filter(r=>r.rank_connectivity_burden<=10).map(r=>r.route_id));
  const selected=new Set(current.slice(0,10).map(r=>r.route_id));
  const overlap=[...base].filter(id=>selected.has(id)).length;
  const legend='<p class="v2-context">Exploratory 2021 SA2 population, place-of-work employment, zero-vehicle household and SEIFA IRSD context joined to frozen V2.1 centre coordinates. The SA2 is not an activity-centre catchment, and these counts are not observed origin–destination demand. These scores do not establish investment priorities.</p>';
  return legend+`<div class="controls-row">${selectControl('planning-profile',profiles,key,'Ranking view')}</div>`+
    card('What changes under this assumption',`<p><strong>${overlap} of the unweighted top ten</strong> remain in the selected view. Rankings are recalculated within the same ${esc(v2.scenarios.find(s=>s.id===state.scenario)?.label||state.scenario)} period and 90 directed outer routes.</p><p>Connectivity burden combines normalised scheduled duration (40%), passenger transfers (20%), walking distance (20%) and indirectness (20%). Demand context combines origin SA2 residents and destination SA2 workplace employment equally after log scaling and normalisation. Equity context combines zero-vehicle household share and inverse IRSD decile equally. The experimental combined view weights these three components 50%, 25% and 25%.</p>`)+
    card('Explore directed routes',table(current.slice(0,20))+`<details><summary>Show all 90 ranked routes</summary>${table(current)}</details>`, '', 'Scores are scenario-specific normalised comparisons. Open a route to inspect its unweighted saved itinerary.')+
    card('Source and interpretation',`<p>ABS Census 2021 General Community Profile G01 and G34; 2021 Working Population Profile W01B; ABS SEIFA 2021 Table 1; ABS ASGS 2021 SA2 point-in-polygon service. V2.1 routing run: <code>${esc(planning.routing_run_id)}</code>. The 2021 context is older than the October 2026 scheduled timetable. ${esc(planning.spatial_unit)}.</p><p>Double counting may occur because IRSD includes socioeconomic variables related to the separate indicators. The ten selected SA2s differ in area and are not comparable centre catchments. Inspect the <a href="./data/experimental/planning_context_v2.json">experimental data and source hashes</a> before using any ranking.</p>`);
}
