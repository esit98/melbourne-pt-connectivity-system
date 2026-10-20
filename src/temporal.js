import { summary } from './analysis.js';

export const temporalKeys = ['travel_time_min','request_to_arrival_min','pre_departure_wait_min','transfers','walking_distance_m','detour_ratio'];
export const median = values => summary(values.map(value=>({value})),'value').median;
export function scenarioRows(data, scenario) {
  const pairs=new Map(data.pairs.map(p=>[p.route_id,p]));
  return data.aggregates.filter(a=>a.scenario_id===scenario).map(a=>{
    const pair=pairs.get(a.route_id), samples=data.samples.filter(s=>s.route_id===a.route_id&&s.scenario_id===scenario);
    const metrics=Object.fromEntries(temporalKeys.map(k=>[k,a['median_'+k]]));
    const direct=samples[0].metrics.direct_distance_m;
    return {...pair,...a,...metrics,direct_distance_m:direct,
      route_distance_m:median(samples.map(s=>s.metrics.route_distance_m)),
      transit_distance_m:median(samples.map(s=>s.metrics.transit_distance_m)),
      minutes_per_direct_km:metrics.travel_time_min/(direct/1000),
      direct_od_coordinates:[[+pair.origin_lon,+pair.origin_lat],[+pair.destination_lon,+pair.destination_lat]],
      geometry_warnings:samples.flatMap(s=>s.geometry_warnings.map(w=>({...w,request_key:s.request_key,requested_departure:s.requested_departure}))) };
  });
}
export function matchedChanges(a,b,cohort) {
  const other=new Map(b.filter(r=>r.analysis_type===cohort).map(r=>[r.route_id,r]));
  return a.filter(r=>r.analysis_type===cohort&&other.has(r.route_id)).map(r=>({a:r,b:other.get(r.route_id),
    delta:Object.fromEntries(temporalKeys.map(k=>[k,other.get(r.route_id)[k]-r[k]]))}));
}
export function ranked(rows,key) {
  const sorted=[...rows].sort((a,b)=>b[key]-a[key]||a.route_id.localeCompare(b.route_id));
  return sorted.map(r=>({...r,rank:1+sorted.filter(x=>x[key]>r[key]).length}));
}
export function validateIndex(d) {
  if(d.run_id!=='v2_1_full_1600'||d.samples.length!==1600||d.aggregates.length!==400||d.pairs.length!==100||d.scenarios.length!==4)throw Error('Incomplete V2.1 export');
  if(new Set(d.samples.map(s=>s.request_key)).size!==1600)throw Error('Duplicate request');
  if(d.aggregates.some(a=>a.valid_samples!==4||a.unsuccessful_samples!==0||!a.complete))throw Error('Incomplete aggregate');
  return d;
}
export function geometryCollection(collection,rows) {
  const lookup=new Map(rows.map(r=>[r.route_id,r]));
  if(collection.features.length!==100)throw Error('Incomplete scenario geometry');
  if(new Set(collection.features.map(f=>f.properties.route_id)).size!==100)throw Error('Duplicate geometry route');
  return {...collection,features:collection.features.map(f=>{
    if(f.geometry?.type!=='MultiLineString'||!f.geometry.coordinates.length||f.geometry.coordinates.some(line=>line.length<2||line.some(p=>p.length!==2||!p.every(Number.isFinite)||p[0]<144||p[0]>146||p[1]<-39||p[1]>-37)))throw Error('Missing or invalid route geometry');
    if(!lookup.has(f.properties.route_id))throw Error('Unknown geometry route');
    return {...f,properties:{...lookup.get(f.properties.route_id),...f.properties}};
  })};
}
export function melbourneTime(iso) {
  return new Date(iso).toLocaleString('en-AU',{timeZone:'Australia/Melbourne',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
}
