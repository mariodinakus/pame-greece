import {NextResponse} from 'next/server';
export const runtime='nodejs';
const cache=new Map();
const TTL=12*60*60*1000;
function photoFromClaim(entity){
 const filename=entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
 if(typeof filename!=='string'||!filename.trim())return null;
 const file=filename.trim().replaceAll(' ','_');
 return {
  image:'https://commons.wikimedia.org/wiki/Special:FilePath/'+encodeURIComponent(file)+'?width=1000',
  imageSource:'https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(file),
  attribution:'Φωτογραφία Wikimedia Commons · άνοιξε την πηγή για δημιουργό/άδεια'
 };
}
export async function GET(request){
 const input=new URL(request.url).searchParams.get('ids')||'';
 const ids=[...new Set(input.split(',').map(v=>v.trim()).filter(v=>/^Q[1-9][0-9]*$/.test(v)))].slice(0,40);
 if(!ids.length)return NextResponse.json({photos:{}});
 const now=Date.now(),photos={};let missing=[];
 for(const id of ids){
  const item=cache.get(id);
  if(item&&now-item.at<TTL){if(item.photo)photos[id]=item.photo}
  else missing.push(id);
 }
 if(missing.length){
  try{
   const params=new URLSearchParams({action:'wbgetentities',ids:missing.join('|'),props:'claims',format:'json'});
   const response=await fetch('https://www.wikidata.org/w/api.php?'+params,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000),cache:'no-store'});
   if(!response.ok)throw new Error('Wikidata '+response.status);
   const payload=await response.json();
   for(const id of missing){
    const photo=photoFromClaim(payload.entities?.[id]);
    cache.set(id,{photo,at:now});
    if(photo)photos[id]=photo;
   }
   if(cache.size>2500)cache.clear();
  }catch(error){console.warn('Wikidata photo enrichment unavailable',String(error))}
 }
 return NextResponse.json({photos,source:'Wikidata P18 / Wikimedia Commons'},{headers:{'Cache-Control':'public, s-maxage=21600, stale-while-revalidate=86400'}});
}
