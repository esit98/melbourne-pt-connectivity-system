import './style.css';
import './v2.css';
import { renderV2 } from './pages-v2.js';
import { validatePlanning, profiles as planningProfiles } from './planning.js';
import { validateSpatial } from './spatial.js';
import { validateIndex, scenarioRows, geometryCollection } from './temporal.js';
import { selectControl } from './ui.js';
import { OUTER, CBD, routeIndex, reverseRoute, centreProfiles, csvMatrix, searchStudy, orderedRoutes, matchesFilters } from './analysis.js';
import { loadStudy } from './data.js';
import { icon, esc, routeName } from './ui.js';
import { renderPage, pageInfo } from './pages.js';
import { setMapData, setMapSelection, updateMap, mountMap, resizeMap, fitSelected, fitStudy, fitCentre } from './map.js';

const $=id=>document.getElementById(id);
const state={page:'dashboard',selectedId:null,centreId:'AC02',metric:'travel_time_min',scope:OUTER,
  showValues:true,showCentres:true,explorerTab:'journey',statsTab:'overview',compareOrigin:'',routeList:false,
  actualRoute:true,directRoute:false,filters:{origin:'',thresholds:{},match:'all'},
  filtersOpen:false,legendOpen:false,routeDetailsOpen:false,mapExpanded:false,
  dataset:'v2_1',scenario:'weekday_am',compareScenario:'weekday_interpeak',matrixMode:'absolute',centreDirection:'outbound',sampleKey:null,spatialKey:null,presentation:false,planningProfile:'connectivity_burden'};
let study,rows=[],centres=[],byId=new Map(),byPair=new Map(),legsByRoute=new Map(),profiles=[];
let baseline,v2,routeData,planningData,spatialData,loadSequence=0;
const scenarioCache=new Map();
function focusToken(){const el=document.activeElement;return el?.id?`#${CSS.escape(el.id)}`:el?.dataset.sample?`[data-sample="${CSS.escape(el.dataset.sample)}"]`:null;}
function restoreFocus(token){if(token)document.querySelector(token)?.focus({preventScroll:true});}
const cache=new Map();
async function asset(path){if(!cache.has(path))cache.set(path,fetch(`${import.meta.env.BASE_URL}data/v2_1/${path}`).then(r=>{if(!r.ok)throw Error(`Data unavailable: ${path}`);return r.json();}).catch(e=>{cache.delete(path);throw e;}));return cache.get(path);}
function controls(){
  const s=v2.scenarios.find(s=>s.id===state.scenario);
  $('dataset-controls').innerHTML=selectControl('dataset-select',[['v2_1','V2.1 — 4 periods'],['v1','V1 — 1 departure']],state.dataset,'Study version')+
    (state.dataset==='v2_1'?selectControl('scenario-select',v2.scenarios.map(s=>[s.id,s.label]),state.scenario,'Departure period'):'')+
    `<p>${state.dataset==='v2_1'?`${s.dates[0]==='2026-10-13'?'13':'17'} October 2026 · ${s.times.join(', ')}`:'13 October 2026 · 08:00'}<br>Australia/Melbourne · Historical timetable</p>`;
}
function urlState(){const p=new URLSearchParams({dataset:state.dataset,scenario:state.scenario});if(state.selectedId)p.set('route',state.selectedId);if(state.sampleKey)p.set('sample',state.sampleKey);if(state.page==='spatial'&&state.spatialKey)p.set('spatial',state.spatialKey);if(state.presentation)p.set('present','1');if(state.page==='planning')p.set('profile',state.planningProfile);history.replaceState(null,'',`#${state.page}?${p}`);}
function applyPresentationState(){
  document.body.classList.toggle('presentation-mode',state.presentation);
  const toggle=$('presentation-toggle');
  toggle.textContent=state.presentation?'Exit presentation':'Present';
  toggle.setAttribute('aria-pressed',String(state.presentation));
  requestAnimationFrame(resizeMap);
}
async function setPresentation(enabled,requestFullscreen=false){
  state.presentation=enabled;applyPresentationState();urlState();render();
  if(requestFullscreen&&enabled&&!document.fullscreenElement){try{await document.documentElement.requestFullscreen();}catch{}}
  if(!enabled&&document.fullscreenElement){try{await document.exitFullscreen();}catch{}}
}
async function activate(){
  const sequence=++loadSequence;
  const focus=focusToken();$('content').setAttribute('aria-busy','true');
  $('notice').hidden=false;$('notice').textContent='Loading saved study data…';
  try {
    routeData=null;
    if(state.dataset==='v2_1'){
      if(state.metric==='minutes_per_direct_km')state.metric='travel_time_min';if(state.scope==='compare')state.scope=OUTER;
      if(!scenarioCache.has(state.scenario))scenarioCache.set(state.scenario,scenarioRows(v2,state.scenario));
      rows=scenarioCache.get(state.scenario);
      study={...baseline,source:'Validated V2.1 static export'};
      if(state.page==='planning'&&!planningData){
        const response=await fetch(`${import.meta.env.BASE_URL}data/experimental/planning_context_v2.json`);
        if(!response.ok)throw Error('Experimental planning context unavailable');
        planningData=validatePlanning(await response.json());
      }
      if(state.page==='spatial'&&!spatialData){
        const response=await fetch(`${import.meta.env.BASE_URL}data/experimental/v2_2_spatial_pilot.json`);
        if(!response.ok)throw Error('Validated spatial pilot export unavailable');
        spatialData=validateSpatial(await response.json());
      }
      if(['map','explorer'].includes(state.page)){
        const geometry=await asset(`scenarios/${state.scenario}.geojson`);if(sequence!==loadSequence)return;
        study={...study,routes:geometryCollection(geometry,rows)};
      }
      if(state.page==='explorer'){
        state.selectedId=rows.some(r=>r.route_id===state.selectedId)?state.selectedId:'OD_AC02_AC06';
        const chunk=await asset(`routes/${state.selectedId}.json`);if(sequence!==loadSequence)return;routeData=chunk;
        const samples=chunk.samples.filter(s=>s.scenario_id===state.scenario),s=samples.find(s=>s.request_key===state.sampleKey)||samples[0];state.sampleKey=s.request_key;
        study={...study,routes:{...study.routes,features:study.routes.features.map(f=>f.properties.route_id===state.selectedId?{...f,geometry:s.geometry,properties:{...f.properties,...s.metrics,geometry_warnings:s.geometry_warnings}}:f)}};
      }
    }else{study=baseline;rows=study.routes.features.map(f=>f.properties);if(['request_to_arrival_min','pre_departure_wait_min'].includes(state.metric))state.metric='travel_time_min';}
    byId=new Map(rows.map(r=>[r.route_id,r]));byPair=routeIndex(rows);profiles=centreProfiles(rows,centres);
    if(['map','explorer'].includes(state.page)||(state.dataset==='v1'&&state.page==='centres'))setMapData(study.routes,study.centres);
    document.documentElement.dataset.studySource=study.source;controls();urlState();render(true);restoreFocus(focus);$('notice').hidden=true;$('notice').classList.remove('error');
  }catch(e){if(sequence!==loadSequence)return;$('content').innerHTML='';$('map-shell').hidden=true;$('notice').hidden=false;$('notice').textContent=e.message;$('notice').classList.add('error');}
  finally{if(sequence===loadSequence)$('content').setAttribute('aria-busy','false');}
}
const mobileMapQuery=window.matchMedia('(max-width:640px)');
function positionMapLegend(){
  const stage=document.querySelector('.map-stage'),slot=$('map-legend-mobile-slot'),legend=document.querySelector('.network-layout .map-legend');
  if(!stage||!slot||!legend)return;
  const parent=mobileMapQuery.matches&&!state.mapExpanded?slot:stage;
  if(legend.parentElement!==parent)parent.append(legend);
}
function render(fit=false) {
  if(!study)return;
  const focus=focusToken();
  const shell=$('map-shell');shell.hidden=true;document.body.append(shell);$('map-overlap').hidden=true;
  document.querySelectorAll('#navigation button').forEach(b=>{b.hidden=['planning','spatial'].includes(b.dataset.page)&&state.dataset!=='v2_1';const active=b.dataset.page===state.page;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false');});
  const [title,subtitle]=pageInfo[state.page];
  $('page-title').textContent=state.page==='explorer'?routeName(byId.get(state.selectedId)||rows[0]):title;
  $('page-subtitle').textContent=subtitle;
  $('dashboard-title').hidden=state.page!=='dashboard';
  if(state.dataset==='v2_1')$('page-subtitle').textContent=state.page==='compare'?'Matched directed pairs across scheduled periods.':'Historical multi-period scheduled connectivity · V2.1';
  if(state.dataset==='v2_1'&&state.page==='compare')$('page-title').textContent='Scenario comparison';
  if(state.page==='spatial')$('page-subtitle').textContent='One directed Melton → Ringwood research-proxy pilot · experimental';
  $('content').innerHTML=(state.dataset==='v2_1'?renderV2:renderPage)[state.page]({state,rows,centres,byId,byPair,legsByRoute,profiles,study,v2,routeData,planning:planningData,spatial:spatialData});
  $('content').dataset.page=state.page;
  document.body.dataset.page=state.page;document.body.dataset.dataset=state.dataset;
  document.body.classList.toggle('map-fullscreen-active',state.page==='map'&&state.mapExpanded);
  document.querySelector('.map-stage')?.classList.toggle('expanded',state.mapExpanded);
  positionMapLegend();
  const slot=$('map-slot');
  if(slot){
    mountMap(slot);
    const route=byId.get(state.selectedId);
    const visibleSelection=state.page==='map'&&(!route||!matchesFilters(route,{...state.filters,scope:state.scope}))?null:state.selectedId;
    updateMap({selected:state.page==='centres'?null:visibleSelection,metric:state.metric,
      filters:state.page==='map'?{...state.filters,scope:state.scope}:state.page==='centres'?{scope:OUTER,origin:state.centreId,thresholds:{},match:'all'}:{scope:'compare',origin:'',thresholds:{},match:'all'},
      showRoutes:state.page==='explorer'?state.actualRoute:true,showDirect:state.page==='explorer'&&state.directRoute,
      showCentres:state.page==='map'?state.showCentres:true,onlySelected:state.page==='explorer',hideCBD:state.page==='centres',centreFocus:state.page==='centres'?state.centreId:''});
    if(fit)requestAnimationFrame(()=>state.page==='explorer'?fitSelected():state.page==='centres'?fitCentre(state.centreId):fitStudy());
    if(state.page==='map'&&state.mapExpanded)requestAnimationFrame(()=>$('expand-map')?.focus({preventScroll:true}));
  }
  restoreFocus(focus);
}
function navigate(page){if(!(state.dataset==='v2_1'?renderV2:renderPage)[page])return;if(page!=='map')state.mapExpanded=false;state.page=page;if(page==='explorer'&&!byId.has(state.selectedId))state.selectedId='OD_AC02_AC06';state.routeList=false;$('sidebar').classList.remove('open');$('menu-toggle').setAttribute('aria-expanded','false');activate().then(()=>$('content').focus({preventScroll:true}));}
function selectRoute(id,page='explorer'){if(!byId.has(id))return;state.selectedId=id;state.centreId=byId.get(id).origin_id;state.routeDetailsOpen=false;if(page==='explorer')state.actualRoute=true;if(page==='map'&&state.page==='map'){urlState();render();return;}navigate(page);}
function setMapExpanded(expanded){
  const stage=document.querySelector('.map-stage');if(!stage)return;
  state.mapExpanded=expanded;stage.classList.toggle('expanded',expanded);
  document.body.classList.toggle('map-fullscreen-active',expanded);
  positionMapLegend();
  if(expanded){stage.setAttribute('role','dialog');stage.setAttribute('aria-modal','true');stage.setAttribute('aria-label','Expanded network map');}
  else{stage.removeAttribute('role');stage.removeAttribute('aria-modal');stage.removeAttribute('aria-label');}
  const toggle=$('expand-map');toggle.textContent=expanded?'Close map':'Expand map';toggle.setAttribute('aria-label',expanded?'Close expanded map':'Expand map');toggle.setAttribute('aria-expanded',String(expanded));
  toggle.focus({preventScroll:true});resizeMap();
}
function readFilters(){const thresholds={};document.querySelectorAll('[data-threshold]').forEach(input=>{if(input.value!==''&&Number.isFinite(input.valueAsNumber)&&input.valueAsNumber>=0)thresholds[input.dataset.threshold]=input.valueAsNumber;});state.filters={thresholds,origin:$('filter-origin')?.value||'',destination:$('filter-destination')?.value||'',match:$('filter-match')?.value||'all'};}
function search(){
  const results=searchStudy(rows,centres,$('global-search').value);
  $('search-results').innerHTML=['Centre','Route'].map(type=>{
    const group=results.filter(r=>r.type===type);
    return group.length?`<section class="search-group" aria-label="${type==='Centre'?'Centres':'Routes'}"><h3>${type==='Centre'?'Centres':'Routes'}</h3>${group.map(r=>`<button type="button" data-${type==='Route'?'route':'centre'}="${r.id}">${icon(type==='Centre'?'centres':'explorer')}<span>${esc(r.label)}</span></button>`).join('')}</section>`:'';
  }).join('')||'<p>No matching centres or routes.</p>';
  $('search-results').hidden=!$('global-search').value.trim();
  $('global-search').setAttribute('aria-expanded',String(!$('search-results').hidden));
}
function closeSearch(){ $('search-results').hidden=true; $('global-search').setAttribute('aria-expanded','false'); }


document.addEventListener('click',event=>{
  const target=event.target.closest('button,[data-route]');if(!target)return;
  if(target.dataset.scenario){state.scenario=target.dataset.scenario;activate();return;}
  if(target.dataset.sample){state.sampleKey=target.dataset.sample;activate();return;}
  if(target.dataset.spatialKey){state.spatialKey=target.dataset.spatialKey;urlState();render();return;}
  if(target.dataset.page){navigate(target.dataset.page);return;}
  if(target.dataset.route){closeSearch();$('global-search').value='';selectRoute(target.dataset.route,target.dataset.mapSelect?'map':'explorer');return;}
  if(target.dataset.centre){state.centreId=target.dataset.centre;closeSearch();$('global-search').value='';navigate('centres');return;}
  if(target.dataset.explorerTab){state.explorerTab=target.dataset.explorerTab;render();return;}
  if(target.dataset.statsTab){state.statsTab=target.dataset.statsTab;render();return;}
  switch(target.id){
    case 'presentation-toggle':setPresentation(!state.presentation,true);break;
    case 'menu-toggle':{const open=$('sidebar').classList.toggle('open');target.setAttribute('aria-expanded',String(open));break;}
    case 'reverse-route':{const reverse=reverseRoute(byId.get(state.selectedId),byPair);if(reverse)selectRoute(reverse.route_id);break;}
    case 'previous-route':case 'next-route':{const routes=orderedRoutes(rows),index=routes.findIndex(r=>r.route_id===state.selectedId);selectRoute(routes[(index+(target.id==='next-route'?1:-1)+routes.length)%routes.length].route_id);break;}
    case 'apply-filters':readFilters();render();break;
    case 'reset-filters':state.filters={origin:'',thresholds:{},match:'all'};render();break;
    case 'clear-selection':state.selectedId=null;urlState();render();break;
    case 'fit-map':state.page==='explorer'?fitSelected():state.page==='centres'?fitCentre(state.centreId):fitStudy();break;
    case 'fit-map-mobile':fitStudy();break;
    case 'expand-map':setMapExpanded(!state.mapExpanded);break;
    case 'toggle-map-filters':{state.filtersOpen=!state.filtersOpen;target.closest('.map-filters').dataset.open=String(state.filtersOpen);target.setAttribute('aria-expanded',String(state.filtersOpen));target.lastElementChild.textContent=state.filtersOpen?'−':'+';break;}
    case 'toggle-map-legend':{state.legendOpen=!state.legendOpen;target.closest('.map-legend').dataset.expanded=String(state.legendOpen);target.setAttribute('aria-expanded',String(state.legendOpen));target.lastElementChild.textContent=state.legendOpen?'−':'+';break;}
    case 'toggle-route-details':{state.routeDetailsOpen=!state.routeDetailsOpen;$('map-route-details').hidden=!state.routeDetailsOpen;target.setAttribute('aria-expanded',String(state.routeDetailsOpen));target.textContent=state.routeDetailsOpen?'Less detail':'Details';break;}
    case 'open-route-list':state.routeList=true;render();$('close-route-list')?.focus();break;
    case 'close-route-list':state.routeList=false;render();$('open-route-list')?.focus();break;
    case 'download-matrix':{let exported=rows;if(state.dataset==='v2_1'&&state.matrixMode==='difference'){const b=new Map(scenarioRows(v2,state.compareScenario).map(r=>[r.route_id,r]));exported=rows.map(r=>({...r,[state.metric]:b.get(r.route_id)[state.metric]-r[state.metric]}));}const blob=new Blob(['\uFEFF'+csvMatrix(exported,centres,state.metric)],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`melbourne-${state.dataset}-${state.scenario}-${state.matrixMode==='difference'?state.compareScenario+'-minus-A':'absolute'}-${state.metric}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);break;}
  }
});
document.addEventListener('change',event=>{
  const input=event.target;
  switch(input.id){
    case 'dataset-select':state.dataset=input.value;if(state.dataset==='v1'&&['planning','spatial'].includes(state.page))state.page='dashboard';activate();break;
    case 'planning-profile':state.planningProfile=input.value;urlState();render();break;
    case 'scenario-select':state.scenario=input.value;state.sampleKey=null;activate();break;
    case 'comparison-scenario':state.compareScenario=input.value;render();break;
    case 'matrix-mode':state.matrixMode=input.value;render();break;
    case 'centre-direction':state.centreDirection=input.value;render();break;
    case 'metric-select':state.metric=input.value;render();break;
    case 'scope-select':if(state.page==='map')readFilters();state.scope=input.value;render();break;
    case 'show-values':state.showValues=input.checked;render();break;
    case 'show-centres':state.showCentres=input.checked;render();break;
    case 'actual-route':state.actualRoute=input.checked;render();break;
    case 'direct-route':state.directRoute=input.checked;render();break;
    case 'centre-select':state.centreId=input.value;render(true);break;
    case 'compare-origin':state.compareOrigin=input.value;render();break;
    case 'explorer-origin':selectRoute(rows.find(r=>r.origin_id===input.value).route_id);break;
    case 'explorer-destination':selectRoute(input.value);break;
  }
});
document.addEventListener('keydown',event=>{
  if(state.mapExpanded&&event.key==='Tab'){
    const stage=document.querySelector('.map-stage');
    const focusable=[...stage.querySelectorAll('button:not([disabled]),[href],[tabindex="0"]')].filter(node=>node.getClientRects().length);
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&(document.activeElement===first||!stage.contains(document.activeElement))){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&(document.activeElement===last||!stage.contains(document.activeElement))){event.preventDefault();first?.focus();}
  }
  if(event.key==='Escape'){if(state.mapExpanded){setMapExpanded(false);event.preventDefault();return;}closeSearch();state.routeList=false;$('sidebar').classList.remove('open');$('menu-toggle').setAttribute('aria-expanded','false');if($('close-route-list')){render();$('open-route-list')?.focus();}}
  if(event.target.matches('circle[data-route]')&&['Enter',' '].includes(event.key)){event.preventDefault();selectRoute(event.target.dataset.route);}
});
$('search-results').addEventListener('keydown',event=>{
  const items=[...$('search-results').querySelectorAll('button')],index=items.indexOf(document.activeElement);
  if(event.key==='ArrowDown'){event.preventDefault();items[(index+1)%items.length]?.focus();}
  if(event.key==='ArrowUp'){event.preventDefault();if(index<=0)$('global-search').focus();else items[index-1].focus();}
  if(event.key==='Escape')$('global-search').focus();
});
$('global-search').addEventListener('input',search);
$('global-search').addEventListener('keydown',event=>{if(event.key==='ArrowDown'){$('search-results').querySelector('button')?.focus();event.preventDefault();}if(event.key==='Enter')$('search-results').querySelector('button')?.click();});
document.addEventListener('click',event=>{if(!event.target.closest('.search-wrap'))closeSearch();});
function readUrl(){const [page,query]=location.hash.slice(1).split('?'),p=new URLSearchParams(query||location.search);state.dataset=p.get('dataset')==='v1'?'v1':'v2_1';state.page=(state.dataset==='v2_1'?renderV2:renderPage)[page]?page:'dashboard';if(v2.scenarios.some(s=>s.id===p.get('scenario')))state.scenario=p.get('scenario');if(planningProfiles.some(([key])=>key===p.get('profile')))state.planningProfile=p.get('profile');state.selectedId=p.get('route')||state.selectedId;state.sampleKey=p.get('sample');state.spatialKey=p.get('spatial');state.presentation=p.get('present')==='1';applyPresentationState();}
window.addEventListener('hashchange',()=>{readUrl();activate();});
mobileMapQuery.addEventListener('change',event=>{if(!event.matches&&state.mapExpanded)setMapExpanded(false);else positionMapLegend();});
setMapSelection(ids=>{
  if(ids.length===1){selectRoute(ids[0],state.page==='map'?'map':'explorer');return;}
  const chooser=$('map-overlap');chooser.innerHTML=`<strong>Choose a journey (${ids.length})</strong>`+ids.map(id=>`<button type="button" data-route="${id}" ${state.page==='map'?'data-map-select="true"':''}>${esc(routeName(byId.get(id)))}</button>`).join('');chooser.hidden=false;
},id=>{if(id==='CBD01'){state.scope=CBD;navigate('map');}else{state.centreId=id;navigate('centres');}});

async function start(){
  try{
    [baseline,v2]=await Promise.all([loadStudy(),asset('index.json').then(validateIndex)]);study=baseline;rows=study.routes.features.map(f=>f.properties);
    centres=study.centres.features.map(f=>f.properties).filter(c=>c.centre_id!=='CBD01').sort((a,b)=>a.centre_id.localeCompare(b.centre_id));
    if(rows.filter(r=>r.analysis_type===OUTER).length!==90||rows.filter(r=>r.analysis_type===CBD).length!==10)throw new Error('Unexpected route groups.');
    byId=new Map(rows.map(r=>[r.route_id,r]));byPair=routeIndex(rows);
    study.legs.forEach(leg=>{if(!legsByRoute.has(leg.route_id))legsByRoute.set(leg.route_id,[]);legsByRoute.get(leg.route_id).push(leg);});
    legsByRoute.forEach(legs=>legs.sort((a,b)=>a.leg_number-b.leg_number));profiles=centreProfiles(rows,centres);
    document.documentElement.dataset.studySource=study.source;$('notice').hidden=true;
    document.querySelectorAll('#navigation button').forEach(b=>b.innerHTML=icon(b.dataset.page)+`<span>${b.textContent.trim()}</span>`);
    readUrl();await activate();
  }catch(error){$('notice').hidden=false;$('notice').textContent=`Study data unavailable: ${error.message}`;$('notice').classList.add('error');}
}
start();
