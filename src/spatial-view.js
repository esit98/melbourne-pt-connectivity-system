import { esc, button, card, selectControl } from './ui.js';
import { scenarioRows } from './temporal.js';

const time=value=>value?new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Melbourne',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)):'—';
const n=(value,digits=1)=>Number(value).toFixed(digits);
export const spatialMetrics=[['travel_time_min','Journey duration','min'],['request_to_arrival_min','Requested-to-arrival','min'],['walking_distance_m','Walking distance','km'],['transfers','Passenger transfers',''],['detour_ratio','Indirectness','×']];
const val=(row,key)=>Number(row[`median_${key}`]);
const fmt=(value,key)=>`${n(key==='walking_distance_m'?value/1000:value,key==='walking_distance_m'||key==='detour_ratio'?2:1)}${key==='walking_distance_m'?' km':key==='detour_ratio'?'×':key==='transfers'?'':' min'}`;
const pairId=row=>`${row.origin_access_point_id}|${row.destination_access_point_id}`;

function pairMatrix(spatial,state,scenario,metric,selected,points){
  const origins=spatial.points.filter(p=>p.centre_id==='AC02'),destinations=spatial.points.filter(p=>p.centre_id==='AC06');
  const pairs=spatial.point_pair_periods.filter(p=>p.scenario_id===scenario);
  const byId=new Map(pairs.map(p=>[pairId(p),p]));
  const values=pairs.map(p=>val(p,metric)),min=Math.min(...values),max=Math.max(...values);
  return `<div class="spatial-matrix-scroll" tabindex="0"><table class="spatial-matrix"><thead><tr><th scope="col">Melton origin ↓<br>Ringwood destination →</th>${destinations.map(p=>`<th scope="col">${esc(p.role)}<small>${esc(p.name)}</small></th>`).join('')}</tr></thead><tbody>${origins.map(origin=>`<tr><th scope="row">${esc(origin.role)}<small>${esc(origin.name)}</small></th>${destinations.map(destination=>{
    const row=byId.get(`${origin.access_point_id}|${destination.access_point_id}`);
    const sample=spatial.samples.find(s=>s.scenario_id===scenario&&s.origin_point_id===origin.access_point_id&&s.destination_point_id===destination.access_point_id);
    const active=origin.access_point_id===selected.origin_point_id&&destination.access_point_id===selected.destination_point_id;
    const fraction=max===min?.5:(val(row,metric)-min)/(max-min);
    return `<td><button type="button" data-spatial-key="${sample.request_key}" class="spatial-cell ${active?'selected':''}" style="--cell-opacity:${(.10+.32*fraction).toFixed(2)}" aria-pressed="${active}" title="${esc(origin.name)} to ${esc(destination.name)}: ${fmt(val(row,metric),metric)}"><strong>${fmt(val(row,metric),metric)}</strong><small>4 departures</small></button></td>`;
  }).join('')}</tr>`).join('')}</tbody></table></div><p class="fine-print">Each cell is the median of four selected departures for one directed point pair and scenario. Colour scales within the selected scenario.</p>`;
}

function periodPlot(spatial,v2,metric,selected,points){
  const scenarios=v2.scenarios,all=spatial.point_pair_periods;
  const values=all.map(p=>metric==='walking_distance_m'?val(p,metric)/1000:val(p,metric));
  const rawMin=Math.min(...values),rawMax=Math.max(...values),margin=Math.max((rawMax-rawMin)*.12,.02);
  const min=Math.max(0,rawMin-margin),max=rawMax+margin,width=700,height=320,left=64,right=24,top=18,bottom=62;
  const xs=scenarios.map((_,i)=>left+i*(width-left-right)/(scenarios.length-1));
  const y=value=>top+(max-value)*(height-top-bottom)/(max-min);
  const selectedPair=`${selected.origin_point_id}|${selected.destination_point_id}`;
  const pairs=[...new Set(all.map(pairId))];
  const grid=[0,1,2,3,4].map(i=>{const value=min+(max-min)*i/4;return `<line x1="${left}" x2="${width-right}" y1="${y(value)}" y2="${y(value)}" stroke="#dce5ed"/><text x="${left-8}" y="${y(value)+4}" text-anchor="end">${n(value,metric==='walking_distance_m'||metric==='detour_ratio'?2:1)}</text>`;}).join('');
  const lines=pairs.map(id=>{
    const active=id===selectedPair,rows=scenarios.map(s=>all.find(p=>pairId(p)===id&&p.scenario_id===s.id));
    const color=active?'#075cf4':'#a4b3c1',point=points.get(rows[0].origin_access_point_id),dest=points.get(rows[0].destination_access_point_id);
    const yy=rows.map(r=>y(metric==='walking_distance_m'?val(r,metric)/1000:val(r,metric)));
    return `<polyline points="${xs.map((x,i)=>`${x},${yy[i]}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${active?3.5:1.7}" stroke-dasharray="${active?'':'4 4'}"/>${rows.map((r,i)=>`<circle cx="${xs[i]}" cy="${yy[i]}" r="${active?6:4}" fill="${color}" stroke="white" stroke-width="1"><title>${esc(point.name)} → ${esc(dest.name)} · ${esc(scenarios[i].label)}: ${fmt(val(r,metric),metric)} (four-departure median)</title></circle>`).join('')}`;
  }).join('');
  return `<div class="spatial-plot-scroll" tabindex="0" aria-label="Scrollable scenario comparison chart"><svg class="spatial-plot" viewBox="0 0 ${width} ${height}" role="img" aria-label="Four categorical departure scenarios; selected point pair blue, five other pairs grey. Values are four-departure medians.">${grid}${lines}${scenarios.map((s,i)=>`<text x="${xs[i]}" y="${height-24}" text-anchor="middle">${esc(s.label.replace('Weekday ','').replace('Saturday ','Sat '))}</text>`).join('')}<text x="${left}" y="12">${esc(spatialMetrics.find(x=>x[0]===metric)[1])} (${esc(spatialMetrics.find(x=>x[0]===metric)[2]||'count')})</text></svg></div><p class="spatial-plot-legend"><i></i> Selected point pair <span>┄ Other five pairs</span></p><p class="fine-print">Named scenarios are categories, not a continuous time series or observed service reliability. Hover a point for its exact value. On narrow screens, scroll the plot horizontally to read labels.</p>`;
}

export function renderSpatial({v2,state,spatial}){
  if(!spatial)return card('Loading spatial analysis','<p role="status">Loading the validated saved experiment…</p>');
  const metric=spatialMetrics.some(x=>x[0]===state.spatialMetric)?state.spatialMetric:'travel_time_min';
  const samples=spatial.samples.filter(s=>s.scenario_id===state.scenario);
  const selected=samples.find(s=>s.request_key===state.spatialKey)||samples[0];
  const pair=samples.filter(s=>s.origin_point_id===selected.origin_point_id&&s.destination_point_id===selected.destination_point_id);
  const points=new Map(spatial.points.map(p=>[p.access_point_id,p]));
  const origin=points.get(selected.origin_point_id),destination=points.get(selected.destination_point_id),m=selected.metrics;
  const centre=spatial.centre_periods.find(x=>x.scenario_id===state.scenario);
  const reference=scenarioRows(v2,state.scenario).find(r=>r.route_id==='OD_AC02_AC06');
  return `<div class="spatial-intro"><strong>Melton → Ringwood: access-point experiment</strong><p>Three Melton and two Ringwood GTFS stop locations form six directed research-proxy pairs. All 96 scheduled requests succeeded across four scenarios. These points are not verified pedestrian entrances, and this one centre pair is not a city-wide spatial study.</p></div>`+
    `<div class="controls-row">${selectControl('spatial-metric',spatialMetrics.map(([key,label])=>[key,label]),metric,'Spatial metric')}</div>`+
    card('Select a point pair · 3 × 2',pairMatrix(spatial,state,state.scenario,metric,selected,points),'','The departure-period control above also updates this matrix.')+
    card('Compare four departure periods',periodPlot(spatial,v2,metric,selected,points),'','Selected pair in blue; remaining saved pairs in grey.')+
    `<div class="spatial-layout"><section class="card"><h2>Five source points and selected saved route</h2><div id="spatial-map" aria-label="CARTO Light map of five research proxy points and one saved selected itinerary"></div><div id="spatial-basemap-status" class="spatial-basemap-status" hidden><strong>Basemap unavailable.</strong> Saved points and route remain visible. ${button('Retry basemap','id="retry-spatial-basemap"')}</div><ul class="spatial-point-list">${spatial.points.map(p=>`<li><strong>${esc(p.centre_name)} ${esc(p.role)}</strong><span>${esc(p.name)}</span></li>`).join('')}</ul><p class="fine-print">The line shows the ${time(selected.requested_departure)} requested departure sample, not a median geometry. Orange dashed segments are walking; blue and purple segments are transit.</p></section><section class="card"><h2>Selected pair and journey</h2><p><strong>Melton ${esc(origin.role)}:</strong> ${esc(origin.name)}<br><strong>Ringwood ${esc(destination.role)}:</strong> ${esc(destination.name)}</p><div class="sample-buttons">${pair.map(s=>button(time(s.requested_departure),`data-spatial-key="${s.request_key}" aria-pressed="${s.request_key===selected.request_key}"`,s.request_key===selected.request_key?'primary':'')).join('')}</div><dl class="v2-facts"><dt>Requested</dt><dd>${time(selected.requested_departure)}</dd><dt>Actual departure</dt><dd>${time(m.actual_departure)}</dd><dt>Arrival</dt><dd>${time(m.actual_arrival)}</dd><dt>Journey duration</dt><dd>${n(m.travel_time_min)} min</dd><dt>Requested-to-arrival</dt><dd>${n(m.request_to_arrival_min)} min</dd><dt>Initial interval</dt><dd>${n(m.pre_departure_wait_min)} min</dd><dt>Passenger transfers</dt><dd>${m.transfers}</dd><dt>Walking</dt><dd>${n(m.walking_distance_m/1000,2)} km</dd><dt>Indirectness</dt><dd>${n(m.detour_ratio,2)}×</dd></dl><p>Selected candidate ${selected.selected_order} of ${selected.candidate_count}. ${esc(selected.selection_explanation)}</p></section></div>`+
    card('Walking and transit legs',`<details><summary>Inspect ${selected.legs.length} saved legs for this departure</summary><div class="v2-table-scroll" tabindex="0"><table class="v2-table"><thead><tr><th>Leg / mode</th><th>From → to</th><th>Distance</th><th>Duration</th></tr></thead><tbody>${selected.legs.map(l=>`<tr><td>${l.number}. ${esc(l.mode)} ${esc(l.route)}</td><td>${esc(l.from)} → ${esc(l.to)}</td><td>${n(l.distance_m/1000,2)} km</td><td>${n(l.duration_min)} min</td></tr>`).join('')}</tbody></table></div></details>`)+
    card('Aggregation and single-point reference',`<p>Equal-point-pair summary: ${fmt(val(centre,metric),metric)}. This is the median of six complete point-pair period medians, each based on four departures; it is not population weighted. Pair medians span ${fmt(centre[`min_${metric}`],metric)}–${fmt(centre[`max_${metric}`],metric)} in this scenario.</p><p>Single-point reference: ${fmt(reference[metric],metric)} for Melton → Ringwood under a different endpoint definition. Differences describe modelling sensitivity, not improved services.</p>${button('Inspect single-point reference route','data-route="OD_AC02_AC06"')}<p><a href="./data/experimental/v2_2_spatial_pilot.json">Download saved experimental evidence</a>. Run <code>${esc(spatial.run_id)}</code>; point dataset <code>${esc(spatial.point_dataset_version)}</code>.</p><p>${esc(spatial.method)}. ${esc(spatial.comparison_limit)}</p>`);
}
