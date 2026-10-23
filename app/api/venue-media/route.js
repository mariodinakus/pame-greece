import fs from 'node:fs/promises';
import path from 'node:path';
import dns from 'node:dns/promises';
import https from 'node:https';
import {NextResponse} from 'next/server';
import {isChain} from '../../chainFilter';

export const runtime='nodejs';
const resultCache=new Map();
const cellCache=new Map();
const TTL=8*60*60*1000;
const NEGATIVE_TTL=65*60*1000;
const HEADERS={Accept:'application/json','User-Agent':'PAME-Greece/1.0 (https://pame-greece.onrender.com; Wikimedia/Openverse discovery)'};

const normalized=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('el').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function safeImage(value,base){
 try{
  const url=new URL(value,base);
  if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443')return null;
  const host=url.hostname.toLowerCase();
  if(!host.includes('.')||host==='localhost'||host.endsWith('.local')||host.endsWith('.internal'))return null;
  if(/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)||host.startsWith('['))return null;
  if(/(?:favicon|sprite|placeholder|loading|spacer|blank\.|\/icon[-_.\/]|\/logo[-_.\/]|\/avatar[-_.\/]|no[-_]?image)/i.test(url.pathname))return null;
  return url.href;
 }catch{return null}
}
function publicIPv4(address){
 const p=address.split('.').map(Number);
 if(p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255))return false;
 const [a,b,c]=p;
 if(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===198&&b>=18&&b<=19)return false;
 if(a===192&&b===0||a===192&&b===88&&c===99||a===192&&b===0&&c===0||a===198&&b===51||a===203&&b===0&&c===113)return false;
 return true;
}
function safeSite(value){
 try{
  const u=new URL(String(value||'').trim());
  if(u.protocol!=='http:'&&u.protocol!=='https:')return null;
  if(u.username||u.password||u.port&&u.port!=='80'&&u.port!=='443')return null;
  if(u.hostname.length>240||!u.hostname.includes('.')||/^(?:\d{1,3}\.){3}\d{1,3}$/.test(u.hostname)||u.hostname.startsWith('['))return null;
  if(/\.(?:local|internal|localhost|test|invalid|onion)$/i.test(u.hostname))return null;
  u.protocol='https:';u.port='';u.hash='';
  return u;
 }catch{return null}
}
async function requestHtml(raw,redirects=0){
 const url=raw instanceof URL?raw:safeSite(raw);
 if(!url||redirects>1)return null;
 let addresses;
 try{addresses=await dns.resolve4(url.hostname)}catch{return null}
 if(!addresses.length||addresses.some(x=>!publicIPv4(x)))return null;
 const pinned=addresses[0];
 return new Promise(resolve=>{
  let settled=false;
  const finish=value=>{if(!settled){settled=true;resolve(value)}};
  const req=https.request(url,{
   method:'GET',timeout:4800,
   lookup:(_host,_opts,cb)=>cb(null,pinned,4),
   headers:{'User-Agent':'PAME-Greece/1.0 (+https://pame-greece.onrender.com)','Accept':'text/html,application/xhtml+xml','Accept-Encoding':'identity'}
  },response=>{
   if([301,302,303,307,308].includes(response.statusCode)&&response.headers.location){
    response.resume();
    try{
     const dest=new URL(response.headers.location,url);
     const from=url.hostname.replace(/^www\./,'');
     const to=dest.hostname.replace(/^www\./,'');
     if(to===from&&dest.protocol==='https:'){
      requestHtml(dest,redirects+1).then(finish).catch(()=>finish(null));
      return;
     }
    }catch{}
    finish(null);return;
   }
   if(response.statusCode!==200||!String(response.headers['content-type']||'').includes('text/html')){
    response.resume();finish(null);return;
   }
   const buffers=[];let size=0;
   response.on('data',part=>{
    if(settled)return;
    size+=part.length;
    if(size<=220000)buffers.push(part);
    else{finish(Buffer.concat(buffers).toString('utf8'));response.destroy()}
   });
   response.on('end',()=>finish(Buffer.concat(buffers).toString('utf8')));
   response.on('error',()=>finish(null));
  });
  req.on('timeout',()=>req.destroy(new Error('timeout')));
  req.on('error',()=>finish(null));
  req.end();
 });
}
function htmlUnescape(s){
 return String(s||'').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
   .replace(/&#(\d+);/g,(_m,n)=>String.fromCodePoint(Math.min(1114111,+n)))
   .replace(/&#x([0-9a-f]+);/gi,(_m,n)=>String.fromCodePoint(Math.min(1114111,parseInt(n,16))));
}
function previewImages(html,website){
 if(!html)return [];
 const images=[];
 for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){
  const attrs={};
  const rx=/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for(const hit of tag.matchAll(rx))attrs[hit[1].toLowerCase()]=htmlUnescape(hit[2]??hit[3]??hit[4]??'');
  const prop=(attrs.property||attrs.name||attrs.itemprop||'').toLowerCase();
  if(!['og:image','og:image:url','twitter:image','twitter:image:src','image'].includes(prop))continue;
  const url=safeImage(attrs.content,website);
  if(url&&!images.some(p=>p.url===url))images.push({url,source:website.href,kind:'website',label:'Εικόνα από τη δηλωμένη ιστοσελίδα',attribution:'Προεπισκόπηση ιστοσελίδας · δικαιώματα στον δημιουργό'});
  if(images.length>=3)break;
 }
 return images;
}
async function websiteMedia(place){
 if(!place.website)return [];
 const url=safeSite(place.website);
 if(!url)return [];
 const html=await requestHtml(url);
 return previewImages(html,url);
}
function placeCity(place){
 if(place.lat>40.40&&place.lat<40.90&&place.lon>22.65&&place.lon<23.35)return {search:'Thessaloniki',words:['thessaloniki','θεσσαλονικη','salonika','salonica']};
 if(place.lat>37.7&&place.lat<38.25&&place.lon>23.45&&place.lon<24.1)return {search:'Athens',words:['athens','αθηνα','athina']};
 return {search:'Greece',words:['greece','ελλαδα','hellas']};
}
function strongName(name){
 const stop=new Set(['the','bar','cafe','café','coffee','pub','restaurant','food','club','καφε','καφετερια','εστιατοριο','μπαρ','το','η','ο','τα','της','στη','στο','του','and','και']);
 return normalized(name).split(' ').filter(word=>word.length>=3&&!stop.has(word)).slice(0,5);
}
function matchesVenueTitle(title,name,city){
 const candidate=normalized(title);
 const tokens=strongName(name);
 if(!tokens.length||tokens.every(t=>t.length<4))return false;
 const present=tokens.every(token=>candidate.split(' ').includes(token));
 if(!present)return false;
 const cityHit=city.words.some(word=>candidate.includes(normalized(word)));
 return cityHit||tokens.length>=2&&tokens.join('').length>=11;
}
async function commonsMedia(place){
 const city=placeCity(place),name=String(place.name||'').trim();
 if(!strongName(name).length)return [];
 const params=new URLSearchParams({action:'query',generator:'search',gsrsearch:'"'+name.replace(/"/g,'')+'" '+city.search,gsrnamespace:'6',gsrlimit:'15',prop:'imageinfo',iiprop:'url|mime|extmetadata',iiurlwidth:'900',format:'json'});
 try{
  const r=await fetch('https://commons.wikimedia.org/w/api.php?'+params,{headers:HEADERS,signal:AbortSignal.timeout(6200),cache:'no-store'});
  if(!r.ok)return [];
  const d=await r.json();
  return Object.values(d.query?.pages||{}).filter(row=>{
   const i=row.imageinfo?.[0];
   return i?.thumburl&&/^image\/(?:jpeg|png|webp)$/.test(i.mime||'')&&matchesVenueTitle(row.title,name,city);
  }).slice(0,4).map(row=>{
   const i=row.imageinfo[0];
   return {url:i.thumburl,source:i.descriptionurl,kind:'commons',label:'Wikimedia Commons',attribution:i.extmetadata?.LicenseShortName?.value||'Δες δημιουργό και άδεια στην πηγή'};
  }).filter(p=>safeImage(p.url));
 }catch{return []}
}
async function openverseMedia(place){
 const city=placeCity(place),name=String(place.name||'').trim();
 if(!strongName(name).length)return [];
 const params=new URLSearchParams({q:name+' '+city.search,page_size:'15'});
 try{
  const r=await fetch('https://api.openverse.org/v1/images/?'+params,{headers:HEADERS,signal:AbortSignal.timeout(6200),cache:'no-store'});
  if(!r.ok)return [];
  const d=await r.json(),allowed=new Set(['cc0','by','by-sa','pdm']);
  return (d.results||[]).filter(p=>{
   if(!allowed.has(String(p.license||'').toLowerCase()))return false;
   const title=String(p.title||'')+' '+String(p.description||'');
   return matchesVenueTitle(title,name,city);
  }).slice(0,3).map(p=>({
   url:safeImage(p.thumbnail)||safeImage(p.url),
   source:safeImage(p.foreign_landing_url)||safeImage(p.url),
   kind:'openverse',
   label:'Openverse · ανοικτή άδεια',
   attribution:[p.creator,p.license,p.license_version].filter(Boolean).join(' · ')
  })).filter(p=>p.url&&p.source);
 }catch{return []}
}
async function canonicalPlace({id,lat,lon}){
 if(typeof id!=='string'||! /^(node|way)-\d{2,18}$/.test(id)||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<34||lat>43||lon<19||lon>30)return null;
 const key=Math.floor(lat*10)+'_'+Math.floor(lon*10);
 let rows=cellCache.get(key);
 if(!rows){
  try{rows=JSON.parse(await fs.readFile(path.join(process.cwd(),'public/data',key+'.json'),'utf8'))}catch{rows=[]}
  cellCache.set(key,rows);
  if(cellCache.size>75)cellCache.delete(cellCache.keys().next().value);
 }
 const place=rows.find(p=>p.id===id&&Math.abs(p.lat-lat)<0.0002&&Math.abs(p.lon-lon)<0.0002);
 return place&&!isChain(place)?place:null;
}
async function discover(place){
 // Sources queried concurrently so a slow website does not delay the entire gallery.
 // Google Maps content is deliberately not scraped or stored.
 const [website,commons,openverse]=await Promise.all([
  websiteMedia(place).catch(()=>[]),commonsMedia(place).catch(()=>[]),openverseMedia(place).catch(()=>[])
 ]);
 const found=[...website,...commons,...openverse];
 const seen=new Set();
 const photos=found.filter(p=>{
  if(!p.url||seen.has(p.url))return false;
  seen.add(p.url);return true;
 }).slice(0,9);
 return photos.length?{image:photos[0].url,imageSource:photos[0].source,sourceLabel:photos[0].label,attribution:photos[0].attribution,photos}:null;
}
async function cachedDiscovery(place){
 const cached=resultCache.get(place.id),now=Date.now();
 if(cached&&now-cached.at<(cached.result?TTL:NEGATIVE_TTL))return cached.result;
 const result=await discover(place).catch(()=>null);
 resultCache.set(place.id,{result,at:now});
 if(resultCache.size>3500)resultCache.delete(resultCache.keys().next().value);
 return result;
}
export async function POST(request){
 try{
  const length=Number(request.headers.get('content-length')||0);
  if(length>10000)return NextResponse.json({error:'Payload too large'},{status:413});
  const body=await request.json();
  const list=Array.isArray(body.places)?body.places.slice(0,8):[];
  if(!list.length)return NextResponse.json({photos:{}});
  const verified=await Promise.all(list.map(canonicalPlace));
  const good=verified.filter(Boolean),photos={};
  for(let i=0;i<good.length;i+=3){
   const found=await Promise.all(good.slice(i,i+3).map(async place=>[place.id,await cachedDiscovery(place)]));
   for(const [id,result] of found)photos[id]=result;
  }
  return NextResponse.json({photos,source:'Επίσημη ιστοσελίδα καταχώρισης, Wikimedia Commons, Openverse',note:'Οι φωτογραφίες από ιστοσελίδες είναι προεπισκοπήσεις. Δεν τεκμηριώνουν υποχρεωτικά τον συγκεκριμένο εσωτερικό χώρο.'},{headers:{'Cache-Control':'private, max-age=300'}});
 }catch(error){
  console.warn('Venue photo discovery error',String(error));
  return NextResponse.json({photos:{},error:'photo_search_unavailable'},{status:503});
 }
}
