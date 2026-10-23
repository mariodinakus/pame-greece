import fs from 'node:fs/promises';
import path from 'node:path';
async function staticPlaces(lat,lon,radius){
 try{
  const manifest=JSON.parse(await fs.readFile(path.join(process.cwd(),'public/data/manifest.json'),'utf8'));
  const deg=radius/111000;
  const x0=Math.floor((lat-deg)*10),x1=Math.floor((lat+deg)*10);
  const y0=Math.floor((lon-deg/Math.max(0.25,Math.cos(lat*Math.PI/180)))*10);
  const y1=Math.floor((lon+deg/Math.max(0.25,Math.cos(lat*Math.PI/180)))*10);
  const keys=[];
  for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)keys.push(x+'_'+y);
  const batches=await Promise.all(keys.map(async k=>{try{return JSON.parse(await fs.readFile(path.join(process.cwd(),'public/data',k+'.json'),'utf8'))}catch{return []}}));
  const places=batches.flat().filter(p=>{
   const a=(p.lat-lat)*Math.PI/180,b=(p.lon-lon)*Math.PI/180;
   const h=Math.sin(a/2)**2+Math.cos(lat*Math.PI/180)*Math.cos(p.lat*Math.PI/180)*Math.sin(b/2)**2;
   return 6371000*2*Math.asin(Math.min(1,Math.sqrt(h)))<=radius;
  });
  return {places,source:manifest.source,updated:manifest.updated,offlineCatalog:true};
 }catch{return null}
}
import {fallbackPlaces} from '../../data/curated';
import {NextResponse} from 'next/server';
export const runtime='nodejs';
const cache=new Map();
const endpoints=['https://overpass.private.coffee/api/interpreter','https://overpass.nchc.org.tw/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass-api.de/api/interpreter'];
const TTL=30*60*1000;
const redisUrl=process.env.KV_REST_API_URL||process.env.UPSTASH_REDIS_REST_URL;
const redisToken=process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN;
async function redis(command){
 if(!redisUrl||!redisToken)return null;
 try{
  const r=await fetch(redisUrl.replace(/\/$/,'')+'/'+command.map(encodeURIComponent).join('/'),{headers:{Authorization:'Bearer '+redisToken},signal:AbortSignal.timeout(3000),cache:'no-store'});
  if(!r.ok)return null;
  return (await r.json()).result;
 }catch{return null}
}
export async function GET(request){
 const q=new URL(request.url).searchParams;
 const lat=Number(q.get('lat')),lon=Number(q.get('lon'));
 const radius=Math.min(35000,Math.max(500,Number(q.get('radius')||3000)));
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return NextResponse.json({error:'Μη έγκυρες συντεταγμένες.'},{status:400});
 const offline=await staticPlaces(lat,lon,radius);
 if(offline&&offline.places.length)return NextResponse.json(offline,{headers:{'Cache-Control':'public, s-maxage=3600, stale-while-revalidate=86400'}});
 const key=[lat.toFixed(3),lon.toFixed(3),radius].join(':');
 const persistentKey='pame:places:v1:'+key;
 let saved=cache.get(key);
 if(!saved){const stored=await redis(['GET',persistentKey]);if(stored){try{saved={data:JSON.parse(stored),time:Date.now()};cache.set(key,saved)}catch{}}}
 if(saved&&Date.now()-saved.time<TTL)return NextResponse.json({...saved.data,cached:true});
 const query='[out:json][timeout:15];(nwr["amenity"~"^(cafe|bar|pub|biergarten|restaurant)$"](around:'+radius+','+lat+','+lon+'););out center 300;';
 const attempts=endpoints.map(async endpoint=>{
  const response=await fetch(endpoint+'?data='+encodeURIComponent(query),{method:'GET',headers:{'Accept':'application/json'},signal:AbortSignal.timeout(17000),cache:'no-store'});
  if(!response.ok)throw new Error('Upstream '+response.status);
  const raw=await response.json();
  if(!Array.isArray(raw.elements))throw new Error('Invalid OSM response');
  return raw.elements;
 });
 try{
  const elements=await Promise.any(attempts);
  const places=elements.filter(x=>x.tags?.name).map(x=>({id:x.type+'-'+x.id,name:x.tags.name,lat:x.lat??x.center?.lat,lon:x.lon??x.center?.lon,type:x.tags.amenity,style:x.tags.cuisine||'',website:x.tags.website||x.tags['contact:website']||'',hours:x.tags.opening_hours||'',address:[x.tags['addr:street'],x.tags['addr:housenumber']].filter(Boolean).join(' '),osm:'https://www.openstreetmap.org/'+x.type+'/'+x.id})).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon));
  const data={places,source:'© OpenStreetMap contributors',updated:new Date().toISOString()};
  cache.set(key,{time:Date.now(),data});
  await redis(['SET',persistentKey,JSON.stringify(data),'EX','86400']);
  if(cache.size>120)cache.delete(cache.keys().next().value);
  return NextResponse.json(data,{headers:{'Cache-Control':'public, s-maxage=600, stale-while-revalidate=3600'}});
 }catch(e){console.error('All Overpass sources unavailable',String(e))}

 if(saved)return NextResponse.json({...saved.data,cached:true,stale:true});
 const editorial=fallbackPlaces(lat,lon);
 if(editorial.length)return NextResponse.json({places:editorial,fallback:true,source:'Επιλεγμένες δημόσιες πηγές',updated:null},{headers:{'Cache-Control':'public, s-maxage=300'}});
 return NextResponse.json({error:'Δεν υπάρχουν διαθέσιμα δεδομένα για αυτή την περιοχή. Δοκίμασε άλλη πόλη.'},{status:503,headers:{'Cache-Control':'no-store'}});
}