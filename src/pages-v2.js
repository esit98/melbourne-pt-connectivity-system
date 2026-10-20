import { OUTER, CBD, labels, display, summary } from './analysis.js';
import { esc, card, button, selectControl, metricCard, routeName, histogram, routeBars, legend, paletteColor, matrixPalette } from './ui.js';
import { classification } from './metrics.js';
import { temporalKeys, scenarioRows, matchedChanges, ranked, melbourneTime } from './temporal.js';
import { renderPage as original } from './pages.js';
import { renderPlanning } from './planning.js';
import { renderSpatial } from './spatial.js';
import { renderExplorer } from './explorer-v2.js';

const chooseMetric=s=>selectControl('metric-select',temporalKeys.map(k=>[k,labels[k]]),s.metric,'Metric');
const cohortControl=s=>selectControl('scope-select',[[OUTER,'90 Outer → Outer'],[CBD,'10 Outer → CBD']],s.scope===CBD?CBD:OUTER,'Cohort');
const cohort=s=>s.scope===CBD?CBD:OUTER;
const table=(heads,lines)=>`<div class="v2-table-scroll" tabindex="0" aria-label="Scrollable data table"><table class="v2-table"><thead><tr>${heads.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${lines.map(cells=>`<tr>${cells.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const routeLink=r=>button(esc(routeName(r)),`data-route="${r.route_id}"`);
const warn=s=>s.geometry_warnings?.length?`<p class="v2-warning" role="note">Saved geometry offset: ${s.geometry_warnings.map(w=>`leg ${w.leg}, ${w.gap_m.toFixed(1)} m`).join('; ')}. Inspect at street scale. Geometry is retained without snapping.</p>`:'';
export const ruleText='Retain candidates within five minutes of the shortest journey duration; then prefer fewer passenger transfers, shorter duration, less walking and earlier actual arrival, followed by the recorded deterministic fallback. These returned alternatives are not every feasible journey.';
const context='<p class="v2-context">Values are medians of four selected departure samples per directed OD pair. Fractional transfer medians are summaries, not fractional transfers on a journey. Scheduled variation is not observed service reliability.</p>';
function overview({v2,state}) {
  const selected=v2.scenarios.find(s=>s.id===state.scenario);
  return `<div class="kpi-grid">${metricCard('1,600','Selected results','100 pairs × 16 departures','explorer')}${metricCard('400','OD / scenario summaries','Four samples each','matrix','purple')}${metricCard('4,755','Retained alternatives','Bounded OTP candidate set','swap','green')}${metricCard('4','Departure scenarios','13 & 17 October 2026','clock','orange')}</div>`+
    card('Across the four departure periods',table(['Scenario / cohort','Journey duration','Elapsed from request','Initial waiting','Transfers','Walking'],v2.scenarios.flatMap(s=>[OUTER,CBD].map(c=>{
      const d=v2.cohorts[`${s.id} / ${c}`];return [button(esc(s.label),`data-scenario="${s.id}"`)+`<small>${c===OUTER?'Outer → Outer · 360 samples':'Outer → CBD · 40 samples'}</small>`,...['travel_time_min','request_to_arrival_min','pre_departure_wait_min','transfers','walking_distance_m'].map(k=>display(d[k].median,k))];
    }))),'','Pooled sample medians; each cohort is kept separate. These are not medians of the OD medians.')+
    card('Change between matched directed pairs',table(['Comparison','Pairs','Mean change in OD median duration','Mean change in OD median elapsed'],[['weekday_am','weekday_interpeak'],['weekday_am','weekday_pm'],['weekday_interpeak','saturday_midday']].map(([a,b])=>{
      const changes=matchedChanges(scenarioRows(v2,a),scenarioRows(v2,b),OUTER);
      return [esc(`${v2.scenarios.find(s=>s.id===b).label} minus ${v2.scenarios.find(s=>s.id===a).label}`),changes.length,...['travel_time_min','request_to_arrival_min'].map(k=>signed(summary(changes.map(c=>c.delta),k).mean,k))];
    })),'','Outer → Outer only. Different scheduled conditions, not measured network improvement or deterioration.')+
    card('Read the findings in context',`<p>Selected period: <strong>${esc(selected.label)}</strong>. ${v2.diagnostics.later_arrival_count} of 1,600 selections arrive later than a returned alternative because duration, transfers and walking precede arrival in the hierarchy. ${v2.diagnostics.walking_over2km} selections require more than 2 km of walking; the maximum is 5.21 km.</p><p>Use these patterns to investigate connectivity. They are not investment priorities without demand, equity and professional planning evidence.</p>${button('Explore the network','data-page="map"','primary')}`);
}
function mapPage(ctx) {
  let html=original.map(ctx);
  html=html.replace('Mean travel time','Mean OD median duration').replace('Mean transfers','Mean OD median transfers').replace('Mean detour ratio','Mean OD median detour ratio');
  return `<details class="map-method-note"><summary>Scheduled medians, not live journeys <span>About this map</span></summary>${context}<p>Colour represents the selected OD median. Each line is a retained sample nearest median duration, not a median path. Open Route Explorer to inspect the four actual paths.</p><p>Tap or click a line to select a route; overlapping lines open a chooser. Use the route list for keyboard access. Selected endpoints are labelled Origin and Destination. Blue highlights the selection, not its metric class.</p></details>`+html;
}
const signed=(v,k)=>`${v>0?'+':''}${display(v,k)}`;
function matrixPage({v2,state,rows,centres}) {
  const other=new Map(scenarioRows(v2,state.compareScenario).map(r=>[r.route_id,r]));
  const lookup=new Map(rows.map(r=>[`${r.origin_id}|${r.destination_id}`,r]));
  const scale=classification(rows.filter(r=>r.analysis_type===OUTER),state.metric);
  const options=v2.scenarios.map(s=>[s.id,s.label]);
  return context+card('Directed OD matrix',`<div class="controls-row">${chooseMetric(state)}${selectControl('matrix-mode',[['absolute','Selected scenario'],['difference','Difference: B minus selected A']],state.matrixMode,'Display')}${selectControl('comparison-scenario',options,state.compareScenario,'Comparison B')}${button('Export displayed CSV','id="download-matrix"')}</div><p>Rows are origins; columns are destinations. ${state.matrixMode==='difference'?'Blue = lower in B; rose = higher in B; grey = unchanged. Values are signed differences in OD medians.':'Colours use selected-scenario quintiles; transfers use distinct median values.'}</p><div class="matrix-scroll" tabindex="0" aria-label="Scrollable directional matrix"><table class="od-matrix"><thead><tr><th>Origin ↓ / Destination →</th>${centres.map(c=>`<th scope="col">${esc(c.centre_name)}</th>`).join('')}</tr></thead><tbody>${centres.map(c=>`<tr><th scope="row">${esc(c.centre_name)}</th>${centres.map(d=>{
    const r=lookup.get(`${c.centre_id}|${d.centre_id}`);if(!r)return '<td aria-label="Same centre">—</td>';
    const delta=other.get(r.route_id)[state.metric]-r[state.metric], diff=state.matrixMode==='difference';
    return `<td style="background:${diff?(Math.abs(delta)<1e-9?'#eef0f4':delta>0?'#f9c5cf':'#c4e4f4'):paletteColor(r[state.metric],scale,matrixPalette)}">${button(diff?signed(delta,state.metric):display(r[state.metric],state.metric),`data-route="${r.route_id}" title="${esc(routeName(r))}"`)}</td>`;
  }).join('')}</tr>`).join('')}</tbody></table></div>${state.matrixMode==='absolute'?legend(rows.filter(r=>r.analysis_type===OUTER),state.metric,matrixPalette):''}`);
}
function centresPage({state,rows,centres}) {
  const key=state.centreDirection==='inbound'?'destination_id':'origin_id';
  const chosen=rows.filter(r=>r.analysis_type===OUTER&&r[key]===state.centreId);
  const cbd=rows.find(r=>r.analysis_type===CBD&&r.origin_id===state.centreId);
  return context+`<div class="controls-row">${selectControl('centre-select',centres.map(c=>[c.centre_id,c.centre_name]),state.centreId,'Activity centre')}${selectControl('centre-direction',[['outbound','Outbound to other centres'],['inbound','Inbound from other centres']],state.centreDirection,'Direction')}</div>`+
    card('Connectivity summary',table(['Measure','Mean of nine OD medians'],temporalKeys.map(k=>[labels[k],display(summary(chosen,k).mean,k)])),'',`${state.centreDirection==='inbound'?'Inbound':'Outbound'} · selected scenario · outer-centre cohort only`)+
    card('Nine outer-centre connections',table(['Directed connection',...temporalKeys.map(k=>labels[k])],chosen.map(r=>[routeLink(r),...temporalKeys.map(k=>display(r[k],k))])))+
    card('Outer → CBD benchmark',`<p>The CBD benchmark is outbound only. No CBD-origin routing results were collected.</p>${table(['Directed connection',...temporalKeys.map(k=>labels[k])],[[routeLink(cbd),...temporalKeys.map(k=>display(cbd[k],k))]])}`);
}
function statistics({v2,state,rows}) {
  const c=cohort(state), chosen=rows.filter(r=>r.analysis_type===c);
  const samples=v2.samples.filter(s=>s.scenario_id===state.scenario&&chosen.some(r=>r.route_id===s.route_id)).map(s=>s.metrics);
  return context+`<div class="controls-row">${chooseMetric(state)}${cohortControl(state)}</div><div class="v2-two">${card('Individual sample distribution',histogram(samples,state.metric,10),'',`${samples.length} scheduled samples; not a reliability measure`)}${card('Highest OD medians',routeBars(chosen,state.metric,8),'','Descriptive ranking, not investment priority')}</div>`+
    card('Period comparison',table(['Scenario','Pooled sample median','Minimum sample','Maximum sample'],v2.scenarios.map(s=>{const d=v2.cohorts[`${s.id} / ${c}`][state.metric];return [esc(s.label),display(d.median,state.metric),display(d.min,state.metric),display(d.max,state.metric)];})))+
    card('All directed pairs in this cohort',table(['Rank (ties shared)','Connection','OD median','Journey-duration range over four samples'],ranked(chosen,state.metric).map(r=>[r.rank,routeLink(r),display(r[state.metric],state.metric),`${r.min_travel_time_min.toFixed(1)}–${r.max_travel_time_min.toFixed(1)} min`])));
}
function compare({v2,state,rows,centres}) {
  const a=v2.scenarios.find(s=>s.id===state.scenario), b=v2.scenarios.find(s=>s.id===state.compareScenario);
  const matches=matchedChanges(rows,scenarioRows(v2,b.id),cohort(state)).filter(c=>!state.compareOrigin||c.a.origin_id===state.compareOrigin);
  return context+`<div class="controls-row">${selectControl('comparison-scenario',v2.scenarios.map(s=>[s.id,s.label]),b.id,'Comparison B')}${cohortControl(state)}${selectControl('compare-origin',[['','All origins'],...centres.map(c=>[c.centre_id,c.centre_name])],state.compareOrigin,'Origin')}</div>`+
    card('Matched scenario comparison',`<p>A: <strong>${esc(a.label)}</strong> · B: <strong>${esc(b.label)}</strong>. ${matches.length} identical directed pairs. Positive differences mean a larger burden in B.</p>${table(['Metric','Mean OD median A','Mean OD median B','Mean paired difference B − A'],temporalKeys.map(k=>[labels[k],display(summary(matches.map(c=>c.a),k).mean,k),display(summary(matches.map(c=>c.b),k).mean,k),signed(summary(matches.map(c=>c.delta),k).mean,k)]))}<p>These are mean differences between four-sample OD medians, not changes in observed network performance.</p>`)+
    card('Pair-by-pair details',`<div class="controls-row">${chooseMetric(state)}</div>${table(['Directed pair','A','B','B − A'],matches.map(c=>[routeLink(c.a),display(c.a[state.metric],state.metric),display(c.b[state.metric],state.metric),signed(c.delta[state.metric],state.metric)]))}`);
}
function methodology({v2}) {
  const sections=[['What this study supports','Transport planners, councils and infrastructure decision-makers can compare scheduled cross-suburban burdens, inspect the underlying itineraries and identify questions for further investigation. A maintained, versioned pipeline enables repeatable timetable comparisons and transparent review beyond a one-off map. Demand, equity and professional validation are needed before prioritising investment.'],
    ['Scope and dates','The main scheduled study has 100 directed pairs: 90 outer-to-outer and ten outer-to-CBD benchmarks, using one fixed representative point per centre. Scheduled samples on 13 and 17 October 2026, Australia/Melbourne (UTC+11); no live routing, disruption, crowding or observed reliability. A separate Melton → Ringwood research-proxy experiment covers six point pairs and 96 saved departures. Its points are not verified pedestrian entrances, and it does not replace the 100-pair study.'],
    ['Itinerary selection',ruleText+' Passenger transfers use the validated OTP numberOfTransfers; transit-leg boundaries can represent stay-seated services.'],
    ['Metric definitions','Journey duration = actual arrival minus actual itinerary departure. Requested-departure-to-arrival elapsed time includes the initial waiting opportunity. Initial waiting = actual departure minus requested departure. These are separate indicators; four-sample medians need not add together. Route indirectness = total itinerary distance divided by direct geographic distance.'],
    ['Aggregation and comparison','Each OD/scenario record summarises four selected samples. Map and matrix values are OD medians; overview cohort tables pool 360 outer or 40 CBD samples per period. Scenario comparisons match the same directed pairs. Scheduled sample variation is not measured real-world reliability. Rankings show individual burdens, without a combined cost or priority score.'],
    ['Walking and geometry','267 selected samples exceed 2 km walking; maximum 5.21 km. No new walking cap has been applied. Two selected itineraries retain small documented geometry offsets. Map lines show a retained sample nearest median duration, not a median route. Route Explorer shows each actual sample and propagates its warnings. No snapping or smoothing was performed.'],
    ['Temporal limitations','686 selections arrive later than a returned alternative. Transfer, duration and walking preferences can outweigh arrival time; this is not automatically an error. Journey duration remains the headline metric, while elapsed time and waiting expose departure-time accessibility. The candidate set is bounded by OTP and does not enumerate all feasible journeys.'],
    ['Selection and reproducibility','The current saved analysis evaluates returned alternatives within a five-minute duration window, then applies transfers, duration, walking, earlier arrival and a deterministic fallback across 16 requested departures per directed pair. Run IDs, rule versions and hashes are retained below for independent checking.'],
    ['Architecture and provenance','OpenTripPlanner 2.9.0 generated the saved research results using GTFS schedules and OSM. Python and PostGIS retained candidates, selections and summaries. This static Vite/OpenLayers website reads versioned files; it does not connect to PostgreSQL or GeoServer. No OTP requests are made by this dashboard.'],
    ['Data sources and distribution','Transport Victoria GTFS Schedule (Department of Transport and Planning), CC BY 4.0; Plan Melbourne centre points with source attribution; © OpenStreetMap contributors, ODbL. CARTO Light basemap attribution and configuration are retained. The complete selected-geometry collection is provided separately under ODbL with derivation and component notices. This independent research website is not government endorsed. Basemap requests go directly to CARTO and include technical request information such as IP address, referrer and browser details; see <a href="https://carto.com/privacy">CARTO privacy information</a>. This dashboard does not request your device location.']];
  return `<article class="methodology">${sections.map(([t,b],i)=>`<section><span class="section-number">${i+1}</span><div><h2>${t}</h2><p>${b}</p></div></section>`).join('')}</article>`+
    card('Scenario definitions',table(['Scenario','Study date','Requested departures'],v2.scenarios.map(s=>[esc(s.label),esc(s.dates.join(', ')),esc(s.times.join(', '))])))+
    card('Version and downloads',`<p>Run <code>${v2.run_id}</code> · export <code>${v2.schema_version}</code></p><p>Rule <code>${v2.rule_version}</code></p><p><a href="./data/v2_1/index.json">Summary and sample metrics (JSON)</a> · <a href="./data/v2_1/manifest.json">File hashes</a> · <a href="./data/v2_1/selected_geometries.geojson">Complete selected geometry (GeoJSON, approximately 33 MB)</a> · <a href="./data/V2_1_NOTICES.md">Sources, licences and derivation</a></p><details><summary>Input provenance hashes</summary>${table(['Input','SHA-256'],v2.provenance.inputs.map(x=>[esc(x.name),`<code>${x.sha256}</code>`]))}<p>Source manifest SHA-256: <code>${v2.provenance.manifest_sha256}</code></p></details>`);
}
export const renderV2={dashboard:overview,map:mapPage,matrix:matrixPage,explorer:renderExplorer,centres:centresPage,statistics,compare,planning:renderPlanning,spatial:renderSpatial,methodology};
