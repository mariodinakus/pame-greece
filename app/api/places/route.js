import {NextResponse} from 'next/server';
export const runtime='nodejs';
const cache=new Map();
export async function GET(request){
 const q=new URL(request.url).searchParams;
 const lat=Number(q.get('lat')),lon=Number(q.get('lon')),radius=Math.min(12000,Math.max(500,Number(q.get('radius')||3000)));
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return NextResponse.json({error:'Invalid coordinates'},{status:400});
 const key=[lat.toFixed(2),lon.toFixed(2),radius].join(':');
 const saved=cache.get(key);if(saved&&Date.now()-saved.time<600000)return NextResponse.json(saved.data);
 const query='[out:json][timeout:20];(nwr["amenity"~"^(cafe|bar|pub|biergarten|restaurant)$"](around:'+radius+','+lat+','+lon+'););out center 180;';
 try{
 const response=await fetch('https://overpass.kumi.systems/api/interpreter',{method:'POST',body:new URLSearchParams({data:query}),headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'PAME-Greece/0.1 (openstreetmap discovery)'},signal:AbortSignal.timeout(23000)});
 if(!response.ok)throw new Error('Data source unavailable');
 const raw=await response.json();
 const places=raw.elements.filter(x=>x.tags?.name).map(x=>({id:x.type+'-'+x.id,name:x.tags.name,lat:x.lat??x.center?.lat,lon:x.lon??x.center?.lon,type:x.tags.amenity,style:x.tags.cuisine||'',website:x.tags.website||x.tags['contact:website']||'',hours:x.tags.opening_hours||'',address:[x.tags['addr:street'],x.tags['addr:housenumber']].filter(Boolean).join(' '),osm:'https://www.openstreetmap.org/'+x.type+'/'+x.id})).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon));
 const data={places,source:'© OpenStreetMap contributors',updated:new Date().toISOString()};cache.set(key,{time:Date.now(),data});if(cache.size>100)cache.delete(cache.keys().next().value);return NextResponse.json(data);
 }catch(e){return NextResponse.json({error:'Η πηγή δεδομένων δεν ανταποκρίνεται. Δοκίμασε ξανά.'},{status:503});}
}