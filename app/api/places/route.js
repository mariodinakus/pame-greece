import {NextResponse} from 'next/server';
export const runtime='nodejs';
const cache=new Map();
const endpoints=['https://overpass.private.coffee/api/interpreter','https://overpass.nchc.org.tw/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
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
 const radius=Math.min(12000,Math.max(500,Number(q.get('radius')||3000)));
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return NextResponse.json({error:'Μη έγκυρες συντεταγμένες.'},{status:400});
 const key=[lat.toFixed(3),lon.toFixed(3),radius].join(':');
 const persistentKey='pame:places:v1:'+key;
 let saved=cache.get(key);
 if(!saved){const stored=await redis(['GET',persistentKey]);if(stored){try{saved={data:JSON.parse(stored),time:Date.now()};cache.set(key,saved)}catch{}}}
 if(saved&&Date.now()-saved.time<TTL)return NextResponse.json({...saved.data,cached:true});
 const query='[out:json][timeout:14];(nwr["amenity"~"^(cafe|bar|pub|biergarten|restaurant)$"](around:'+radius+','+lat+','+lon+'););out center 300;';
 let lastError='';
 for(const endpoint of endpoints){
  try{
   const response=await fetch(endpoint,{method:'POST',body:new URLSearchParams({data:query}),headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},signal:AbortSignal.timeout(17000),cache:'no-store'});
   if(!response.ok)throw new Error('HTTP '+response.status);
   const raw=await response.json();
   if(!Array.isArray(raw.elements))throw new Error('Invalid response');
   const places=raw.elements.filter(x=>x.tags?.name).map(x=>({id:x.type+'-'+x.id,name:x.tags.name,lat:x.lat??x.center?.lat,lon:x.lon??x.center?.lon,type:x.tags.amenity,style:x.tags.cuisine||'',website:x.tags.website||x.tags['contact:website']||'',hours:x.tags.opening_hours||'',address:[x.tags['addr:street'],x.tags['addr:housenumber']].filter(Boolean).join(' '),osm:'https://www.openstreetmap.org/'+x.type+'/'+x.id})).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon));
   const data={places,source:'© OpenStreetMap contributors',updated:new Date().toISOString()};
   cache.set(key,{time:Date.now(),data});await redis(['SET',persistentKey,JSON.stringify(data),'EX',String(86400)]);if(cache.size>120)cache.delete(cache.keys().next().value);
   return NextResponse.json(data,{headers:{'Cache-Control':'public, s-maxage=600, stale-while-revalidate=3600'}});
  }catch(e){lastError=String(e);console.warn('Overpass endpoint failed:',new URL(endpoint).hostname,lastError)}
 }
 if(saved)return NextResponse.json({...saved.data,cached:true,stale:true});
 return NextResponse.json({error:'Οι δημόσιες πηγές OpenStreetMap είναι προσωρινά μη διαθέσιμες. Δοκίμασε ξανά σε λίγο.'},{status:503,headers:{'Cache-Control':'no-store'}});
}