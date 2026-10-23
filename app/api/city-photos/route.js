import {NextResponse} from 'next/server';
export const runtime='nodejs';
const cache=new Map();
export async function GET(request){
 const q=new URL(request.url).searchParams;
 const lat=Number(q.get('lat')),lon=Number(q.get('lon'));
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return NextResponse.json({photos:[]},{status:400});
 const key=lat.toFixed(2)+'_'+lon.toFixed(2),saved=cache.get(key);
 if(saved&&Date.now()-saved.time<6*60*60*1000)return NextResponse.json({photos:saved.photos,cached:true});
 try{
  const args=new URLSearchParams({action:'query',generator:'geosearch',ggsprimary:'all',ggsnamespace:'6',ggsradius:'6000',ggscoord:lat+'|'+lon,ggslimit:'32',prop:'imageinfo',iiprop:'url|mime|extmetadata',iiurlwidth:'850',format:'json'});
  const r=await fetch('https://commons.wikimedia.org/w/api.php?'+args,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000),cache:'no-store'});
  if(!r.ok)throw new Error('Wikimedia Commons '+r.status);
  const data=await r.json();
  const photos=Object.values(data.query?.pages||{}).filter(p=>{
   const info=p.imageinfo?.[0];return info?.thumburl&&/^image\/(jpeg|png|webp)$/.test(info.mime||'')&&/^https:\/\//.test(info.descriptionurl||'');
  }).slice(0,14).map(p=>({url:p.imageinfo[0].thumburl,source:p.imageinfo[0].descriptionurl,title:p.title.replace(/^File:/,'').replace(/\.[^.]+$/,'').replaceAll('_',' '),license:p.imageinfo[0].extmetadata?.LicenseShortName?.value||''}));
  cache.set(key,{time:Date.now(),photos});if(cache.size>200)cache.clear();
  return NextResponse.json({photos,source:'Wikimedia Commons, γεωγραφικά σημειωμένα αρχεία',nearbyNotVenue:true},{headers:{'Cache-Control':'public, s-maxage=3600, stale-while-revalidate=43200'}});
 }catch(error){console.warn('Nearby Wikimedia image search unavailable',String(error));return NextResponse.json({photos:[],nearbyNotVenue:true})}
}
