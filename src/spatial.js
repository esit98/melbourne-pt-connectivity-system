import { esc, button, card } from './ui.js';

const time = value => value ? new Intl.DateTimeFormat('en-AU', {timeZone:'Australia/Melbourne',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)) : '—';
const num = (value, digits=1) => Number(value).toFixed(digits);
const pointName = point => `${point.centre_name} · ${point.role} · ${point.name}`;

export function validateSpatial(data) {
  if(data?.schema_version!=='v2.2-local-spatial-pilot-1'||data.samples?.length!==96||data.points?.length!==5||data.point_pair_periods?.length!==24||data.centre_periods?.length!==4) throw Error('Incomplete V2.2 spatial pilot export');
  const keys=new Set(data.samples.map(s=>s.request_key));
  if(keys.size!==96||data.samples.some(s=>!s.legs?.length||!s.metrics?.actual_arrival||s.candidate_count<1)) throw Error('Invalid V2.2 spatial pilot samples');
  return data;
}

function routeSvg(sample) {
  const lines=sample.legs.map(leg=>leg.coordinates||[]).filter(c=>c.length>1);
  const coords=lines.flat();
  if(!coords.length)return '<p>Saved leg geometry unavailable for this sample.</p>';
  const longitude=coords.map(p=>p[0]), latitude=coords.map(p=>p[1]);
  const cos=Math.cos(-37.8*Math.PI/180), minX=Math.min(...longitude)*cos,maxX=Math.max(...longitude)*cos,minY=Math.min(...latitude),maxY=Math.max(...latitude);
  const width=650,height=340,pad=28,scale=Math.min((width-2*pad)/(maxX-minX||1),(height-2*pad)/(maxY-minY||1));
  const project=p=>[pad+(p[0]*cos-minX)*scale,height-pad-(p[1]-minY)*scale];
  const colours={WALK:'#d37c29',RAIL:'#2779b7',BUS:'#7a4cab',TRAM:'#2e8b64'};
  const paths=sample.legs.map((leg,i)=>{
    if((leg.coordinates||[]).length<2)return '';
    const d=leg.coordinates.map((p,j)=>`${j?'L':'M'}${project(p).map(x=>x.toFixed(1)).join(' ')}`).join(' ');
    return `<path d="${d}" fill="none" stroke="${colours[leg.mode]||'#53606e'}" stroke-width="${leg.mode==='WALK'?3:4}" stroke-linecap="round" stroke-linejoin="round" ${leg.mode==='WALK'?'stroke-dasharray="5 5"':''}><title>Leg ${i+1}: ${esc(leg.mode)} ${esc(leg.from)} to ${esc(leg.to)}</title></path>`;
  }).join('');
  const first=project(coords[0]),last=project(coords.at(-1));
  return `<svg class="spatial-route" viewBox="0 0 ${width} ${height}" role="img" aria-label="Saved OTP journey geometry from Melton to Ringwood, with walking in orange, rail in blue and bus in purple"><rect width="${width}" height="${height}" fill="#edf4f7"/>${paths}<circle cx="${first[0]}" cy="${first[1]}" r="6" fill="#174a37" stroke="white" stroke-width="2"/><circle cx="${last[0]}" cy="${last[1]}" r="6" fill="#9a3030" stroke="white" stroke-width="2"/><text x="${Math.min(width-65,first[0]+10)}" y="${Math.max(18,first[1]-10)}">Melton</text><text x="${Math.max(8,last[0]-75)}" y="${Math.max(18,last[1]-10)}">Ringwood</text></svg><p class="spatial-legend"><span>━━ Rail</span><span>━━ Bus</span><span>┄ Walk</span> · Saved OTP leg geometry; geographic orientation, no basemap.</p>`;
}

export function renderSpatial({state,spatial}) {
  if(!spatial)return card('Loading spatial pilot','<p role="status">Loading the validated local V2.2 export…</p>');
  const samples=spatial.samples.filter(s=>s.scenario_id===state.scenario);
  const selected=samples.find(s=>s.request_key===state.spatialKey)||samples[0];
  const pair=samples.filter(s=>s.origin_point_id===selected.origin_point_id&&s.destination_point_id===selected.destination_point_id);
  const points=new Map(spatial.points.map(p=>[p.access_point_id,p]));
  const origin=points.get(selected.origin_point_id),destination=points.get(selected.destination_point_id);
  const aggregate=spatial.centre_periods.find(x=>x.scenario_id===state.scenario);
  const m=selected.metrics;
  const pairs=[...new Map(samples.map(s=>[`${s.origin_point_id}|${s.destination_point_id}`,s])).values()];
  return `<div class="spatial-intro"><strong>V2.2 · experimental spatial pilot</strong><p>One directed Melton → Ringwood OD only. Five GTFS stop locations act as research modelling proxies: three at Melton and two at Ringwood. These are not verified pedestrian entrances or a network-wide result. The V1 and V2.1 analyses remain separate.</p><p>${esc(spatial.method)}. ${esc(spatial.comparison_limit)}</p></div>`+
  card('Choose a point pair',`<div class="spatial-pairs">${pairs.map(s=>button(`${esc(points.get(s.origin_point_id).role)} → ${esc(points.get(s.destination_point_id).role)}`,`data-spatial-key="${s.request_key}" aria-pressed="${s.origin_point_id===selected.origin_point_id&&s.destination_point_id===selected.destination_point_id}"`,s.origin_point_id===selected.origin_point_id&&s.destination_point_id===selected.destination_point_id?'primary':'')).join('')}</div><p><strong>Origin:</strong> ${esc(pointName(origin))}<br><strong>Destination:</strong> ${esc(pointName(destination))}</p><div class="sample-buttons">${pair.map(s=>button(time(s.requested_departure),`data-spatial-key="${s.request_key}" aria-pressed="${s.request_key===selected.request_key}"`,s.request_key===selected.request_key?'primary':'')).join('')}</div><p>Requested departures for the selected point pair; times use Australia/Melbourne.</p>`)+
  `<div class="spatial-layout"><section class="card"><h2>Selected saved journey</h2>${routeSvg(selected)}</section><section class="card"><h2>Journey evidence</h2><dl class="v2-facts"><dt>Requested departure</dt><dd>${time(selected.requested_departure)}</dd><dt>Actual departure</dt><dd>${time(m.actual_departure)}</dd><dt>Actual arrival</dt><dd>${time(m.actual_arrival)}</dd><dt>Journey duration</dt><dd>${num(m.travel_time_min)} min</dd><dt>Requested-to-arrival</dt><dd>${num(m.request_to_arrival_min)} min</dd><dt>Initial waiting</dt><dd>${num(m.pre_departure_wait_min)} min</dd><dt>Passenger transfers</dt><dd>${m.transfers}</dd><dt>Walking distance</dt><dd>${num(m.walking_distance_m/1000,2)} km</dd><dt>Indirectness</dt><dd>${num(m.detour_ratio,2)}×</dd></dl><p>OTP candidate ${selected.selected_order} of ${selected.candidate_count}. ${esc(selected.selection_explanation)}</p>${m.transfer_review_required?'<p>Transit-leg boundaries exceed the OTP passenger-transfer count; the reviewed six cases are scheduled stay-seated connections.</p>':''}</section></div>`+
  card('Walking and transit legs',`<div class="matrix-scroll"><table><thead><tr><th>Leg</th><th>From → to</th><th>Distance</th><th>Duration</th></tr></thead><tbody>${selected.legs.map(leg=>`<tr><td>${leg.number}. ${esc(leg.mode)} ${esc(leg.route)}</td><td>${esc(leg.from)} → ${esc(leg.to)}</td><td>${num(leg.distance_m/1000,2)} km</td><td>${num(leg.duration_min)} min</td></tr>`).join('')}</tbody></table></div>`)+
  card('Scenario-level spatial summary',`<p>Six complete point pairs, 24 selected samples in this scenario. Centre value: ${num(aggregate.median_travel_time_min)} min journey duration; ${num(aggregate.median_walking_distance_m/1000,2)} km walking; ${num(aggregate.median_request_to_arrival_min)} min requested-to-arrival. Point-pair journey medians span ${num(aggregate.spatial_range_travel_time_min)} min.</p><p>The original V2.1 Melton → Ringwood result uses one different point definition. Compare it as modelling sensitivity, not measured transport change.</p>${button('Open original V2.1 route','data-route="OD_AC02_AC06"','primary')}<p><a href="./data/experimental/v2_2_spatial_pilot.json">Download the validated local pilot export</a>. Run ${esc(spatial.run_id)}; point dataset ${esc(spatial.point_dataset_version)}. This local experimental view is not published on the V1 public site.</p>`);
}
