export { renderSpatial } from './spatial-view.js';

export function validateSpatial(data) {
  if(data?.schema_version!=='v2.2-local-spatial-pilot-1'||data.samples?.length!==96||data.points?.length!==5||data.point_pair_periods?.length!==24||data.centre_periods?.length!==4) throw Error('Incomplete V2.2 spatial pilot export');
  const keys=new Set(data.samples.map(s=>s.request_key));
  if(keys.size!==96||data.samples.some(s=>!s.legs?.length||!s.metrics?.actual_arrival||s.candidate_count<1)) throw Error('Invalid V2.2 spatial pilot samples');
  return data;
}
