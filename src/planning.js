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
export const profileWeights={
  connectivity_burden:[1,0,0],demand_context:[0,1,0],equity_context:[0,0,1],
  balanced_experimental:[.5,.25,.25],population_context_emphasis:[.4,.4,.2],equity_context_emphasis:[.4,.2,.4],
};
const components=['connectivity_burden','demand_context','equity_context'];
const componentLabels=['Connectivity burden','Demand context','Equity context'];
export function weightedComponents(row,key){return components.map((component,i)=>({label:componentLabels[i],raw:row[component],weight:profileWeights[key][i],value:row[component]*profileWeights[key][i]}));}
const profileDescription={
  connectivity_burden:'Scheduled duration, transfers, walking and indirectness only.',
  demand_context:'Origin-area residents and destination-area jobs as contextual proxies.',
  equity_context:'Zero-vehicle households and inverse IRSD decile as area-level context.',
  balanced_experimental:'Connectivity 50%, demand context 25%, equity context 25%.',
  population_context_emphasis:'Connectivity 40%, demand context 40%, equity context 20%.',
  equity_context_emphasis:'Connectivity 40%, demand context 20%, equity context 40%.',
};
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
  const chosen=current.find(r=>r.route_id===state.planningRoute)||current[0];
  const parts=weightedComponents(chosen,key),delta=chosen.rank_connectivity_burden-chosen.currentRank;
  const sort=state.planningSort||'rank';
  const ordered=[...current].sort((a,b)=>sort==='duration'?b.median_travel_time_min-a.median_travel_time_min:sort==='walking'?b.median_walking_distance_m-a.median_walking_distance_m:sort==='transfers'?b.median_transfers-a.median_transfers:a.currentRank-b.currentRank);
  const scale=Math.max(...current.slice(0,10).map(r=>r.currentScore),.01);
  const chart=`<div class="planning-bars" role="list" aria-label="Ten leading directed connections">${current.slice(0,10).map(r=>{
    const segments=weightedComponents(r,key).filter(p=>p.weight>0).map(p=>`<i class="component-${componentLabels.indexOf(p.label)}" style="width:${100*p.value/r.currentScore}%" title="${esc(p.label)}: ${number(p.value,3)} weighted points"></i>`).join('');
    return `<button type="button" role="listitem" class="planning-bar ${r.route_id===chosen.route_id?'selected':''}" data-planning-route="${r.route_id}" aria-pressed="${r.route_id===chosen.route_id}" title="Rank ${r.currentRank}: ${esc(r.originName)} to ${esc(r.destinationName)}, score ${number(r.currentScore,3)}"><span class="planning-bar-label"><b>${r.currentRank}.</b> ${esc(r.originName)} → ${esc(r.destinationName)}</span><span class="planning-bar-track"><span style="width:${100*r.currentScore/scale}%">${segments}</span></span><strong>${number(r.currentScore,3)}</strong></button>`;
  }).join('')}</div><p class="planning-legend"><span>Connectivity burden</span><span>Demand context</span><span>Equity context</span></p>`;
  const detail=`<div class="planning-selected"><p><strong>#${chosen.currentRank} ${esc(chosen.originName)} → ${esc(chosen.destinationName)}</strong><br>Burden-only rank #${chosen.rank_connectivity_burden}; ${delta>0?`moves up ${delta}`:delta<0?`moves down ${-delta}`:'unchanged'} in this profile.</p><div class="planning-contributions">${parts.map((p,i)=>`<div class="component-${i}"><small>${p.label}</small><strong>${number(p.value,3)}</strong><span>${number(p.raw,3)} × ${number(p.weight*100,0)}%</span></div>`).join('')}</div><p>The three weighted contributions sum to ${number(parts.reduce((sum,p)=>sum+p.value,0),3)} (${number(chosen.currentScore,3)} stored). A rank moves because other directed pairs have different component values under this profile; the route itself has not changed.</p>${button('Inspect saved journey',`data-route="${chosen.route_id}"`,'primary')}</div>`;
  const legend='<p class="v2-context">Exploratory ABS 2021 containing-SA2 residents, jobs, zero-vehicle households and SEIFA IRSD. The SA2 is not an activity-centre catchment, and these are not observed OD demand or approved investment priorities.</p>';
  return legend+`<div class="controls-row">${selectControl('planning-profile',profiles,key,'Ranking profile')}</div>`+
    card('Ranking assumption',`<p><strong>${esc(profileDescription[key])}</strong> ${overlap} of the burden-only top ten remain in this view. Rankings are recalculated within the ${esc(v2.scenarios.find(s=>s.id===state.scenario)?.label||state.scenario)} period across 90 directed outer routes. Scores are scenario-specific and cannot be compared as absolute values across periods.</p><p>Burden combines normalised scheduled duration (40%), transfers (20%), walking (20%) and indirectness (20%). Demand combines residents and workplace employment equally; equity combines zero-vehicle share and inverse IRSD decile equally.</p>`)+
    `<div class="planning-layout">${card('Leading directed connections',chart,'','Select a bar to inspect its actual component values.')}${card('Selected connection',detail)}</div>`+
    card('All 90 directed connections',`<details><summary>Open full ranking table</summary><div class="controls-row">${selectControl('planning-sort',[['rank','Profile rank'],['duration','Journey duration'],['transfers','Transfers'],['walking','Walking distance']],sort,'Sort by')}</div>${table(ordered)}</details>`,'','Open a route to inspect its unweighted saved itinerary.')+
    card('Source and interpretation',`<p>ABS Census 2021 General Community Profile G01 and G34; 2021 Working Population Profile W01B; ABS SEIFA 2021 Table 1; ABS ASGS 2021 SA2 point-in-polygon service. Routing run: <code>${esc(planning.routing_run_id)}</code>. The 2021 context predates the October 2026 timetable. ${esc(planning.spatial_unit)}.</p><p>IRSD may overlap with separate indicators. The ten containing SA2s differ in area and are not comparable centre catchments. <a href="./data/experimental/planning_context_v2.json">Download source data and hashes</a>.</p>`);
}
