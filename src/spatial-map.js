import Map from 'ol/Map.js';
import View from 'ol/View.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import LineString from 'ol/geom/LineString.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import XYZ from 'ol/source/XYZ.js';
import VectorSource from 'ol/source/Vector.js';
import { Circle, Fill, Stroke, Style, Text } from 'ol/style.js';
import { defaults as defaultControls, ScaleLine } from 'ol/control.js';
import { fromLonLat } from 'ol/proj.js';
import { createEmpty, extend } from 'ol/extent.js';

let current;
const configured=import.meta.env.VITE_CARTO_BASEMAP_KEY?.trim();
const key=configured&&configured!=='your_carto_basemap_key'?configured:'';

export function mountSpatialMap(element,spatial,sample){
  current?.dispose();
  const base=new XYZ({url:'https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png'+(key?`?key=${encodeURIComponent(key)}`:''),
    attributions:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://carto.com/attribution/">CARTO</a>',maxZoom:20});
  const tile=new TileLayer({source:base,visible:Boolean(key)&&navigator.onLine});
  const routeFeatures=sample.legs.filter(leg=>leg.coordinates?.length>1).map(leg=>{
    const feature=new Feature(new LineString(leg.coordinates.map(coord=>fromLonLat(coord))));
    feature.set('mode',leg.mode);
    return feature;
  });
  const routes=new VectorLayer({source:new VectorSource({features:routeFeatures}),style:feature=>new Style({stroke:new Stroke({
    color:feature.get('mode')==='WALK'?'#d37c29':feature.get('mode')==='RAIL'?'#075cf4':'#754cb0',
    width:feature.get('mode')==='WALK'?3:4,lineDash:feature.get('mode')==='WALK'?[5,5]:undefined,
  })})});
  const pointFeatures=spatial.points.map(point=>{
    const feature=new Feature(new Point(fromLonLat([point.longitude,point.latitude])));
    feature.setProperties({label:`${point.centre_name} ${point.role}`,selected:[sample.origin_point_id,sample.destination_point_id].includes(point.access_point_id),name:point.name});
    return feature;
  });
  const points=new VectorLayer({source:new VectorSource({features:pointFeatures}),declutter:true,style:feature=>new Style({
    image:new Circle({radius:feature.get('selected')?8:6,fill:new Fill({color:feature.get('selected')?'#075cf4':'#226b70'}),stroke:new Stroke({color:'#fff',width:2})}),
    text:new Text({text:feature.get('label'),font:'bold 12px Arial',offsetY:-19,fill:new Fill({color:'#163348'}),stroke:new Stroke({color:'#fff',width:3})}),
  })});
  const map=new Map({target:element,layers:[tile,routes,points],controls:defaultControls({attributionOptions:{collapsible:false}}).extend([new ScaleLine()]),
    view:new View({center:fromLonLat([145.0,-37.8]),zoom:9,minZoom:7,maxZoom:18})});
  current=map;
  const extent=createEmpty();
  if(routeFeatures.length)extend(extent,routes.getSource().getExtent());
  if(pointFeatures.length)extend(extent,points.getSource().getExtent());
  if(extent.every(Number.isFinite))map.getView().fit(extent,{padding:[35,40,35,40],maxZoom:12});
  const status=document.getElementById('spatial-basemap-status');
  const showStatus=unavailable=>{if(status?.isConnected)status.hidden=!unavailable;tile.setVisible(!unavailable);};
  showStatus(!key||!navigator.onLine);
  let failures=0;
  base.on('tileloaderror',()=>{if(++failures>=3)showStatus(true);});
  base.on('tileloadend',()=>{failures=0;showStatus(false);});
  document.getElementById('retry-spatial-basemap')?.addEventListener('click',()=>{
    failures=0;showStatus(!key||!navigator.onLine);
    if(key&&navigator.onLine){base.refresh();map.render();}
  });
  requestAnimationFrame(()=>map.updateSize());
}
