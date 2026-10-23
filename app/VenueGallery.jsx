'use client';
import {useEffect,useState} from 'react';
import {Camera,ExternalLink,Images} from 'lucide-react';
function commonsTitle(p){const v=(p.wikimedia_commons||'').trim();return /^File:/i.test(v)?v:null}
function safePhoto(p){const image=(p.image||'').trim();if(/^https:\/\//i.test(image)&&!/(google\.com|googleusercontent\.com|tripadvisor\.)/i.test(image))return image;const title=commonsTitle(p)||(/^File:/i.test(image)?image:null);return title?'https://commons.wikimedia.org/wiki/Special:FilePath/'+encodeURIComponent(title.replace(/^File:/i,''))+'?width=900':null}
export function VenueCover({place,onClick}){
 const [failed,setFailed]=useState(false);
 const url=safePhoto(place);
 useEffect(()=>setFailed(false),[url]);
 return <div className={'venue-cover '+(!url||failed?'venue-cover-empty':'')} onClick={onClick} role={onClick?'button':undefined} tabIndex={onClick?0:undefined} onKeyDown={e=>{if(onClick&&e.key==='Enter')onClick()}}>
 {url&&!failed?<img src={url} alt={'Φωτογραφία καταχώρισης '+place.name} loading="lazy" onError={()=>setFailed(true)}/>:<div className="venue-cover-placeholder"><Camera size={30}/><span>Δεν υπάρχει επιβεβαιωμένη φωτογραφία</span></div>}
 <span className="venue-photo-label"><Camera size={12}/>{url&&!failed?'Φωτογραφία καταχώρισης':'Δείτε φωτογραφίες'}</span>
 </div>
}
export default function VenueGallery({place}){
 const [images,setImages]=useState([]);const [busy,setBusy]=useState(false);
 useEffect(()=>{
  let active=true;setImages([]);const direct=safePhoto(place);
  if(direct)setImages([{url:direct,description:'Φωτογραφία από την καταχώριση OpenStreetMap',source:place.wikimedia_commons?'https://commons.wikimedia.org/wiki/'+encodeURIComponent(place.wikimedia_commons):place.osm}]);
  const category=(place.wikimedia_commons||'').trim();
  if(!/^Category:/i.test(category))return()=>{active=false};
  setBusy(true);
  const params=new URLSearchParams({action:'query',generator:'categorymembers',gcmtitle:category,gcmtype:'file',gcmlimit:'12',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'900',format:'json',origin:'*'});
  fetch('https://commons.wikimedia.org/w/api.php?'+params).then(r=>r.json()).then(data=>{
   if(!active)return;
   const found=Object.values(data.query?.pages||{}).filter(x=>x.imageinfo?.[0]?.thumburl).map(x=>({url:x.imageinfo[0].thumburl,description:x.title,source:x.imageinfo[0].descriptionurl})).slice(0,10);
   setImages(found);
  }).catch(()=>{}).finally(()=>{if(active)setBusy(false)});
  return()=>{active=false};
 },[place.id,place.image,place.wikimedia_commons]);
 return <section className="venue-gallery"><div className="venue-gallery-title"><Images size={18}/><strong>Φωτογραφίες</strong><span>{images.length?images.length+' διαθέσιμες':'Χωρίς επιβεβαιωμένες εικόνες'}</span></div>
 {images.length>0?<div className="venue-gallery-grid">{images.map((img,i)=><a key={i} href={img.source||img.url} target="_blank" rel="noreferrer" title="Πηγή και δικαιώματα φωτογραφίας"><img src={img.url} alt={img.description||place.name} loading="lazy"/><span>Πηγή <ExternalLink size={11}/></span></a>)}</div>:<div className="venue-gallery-empty"><Camera size={22}/><span>{busy?'Φόρτωση φωτογραφιών Wikimedia Commons…':'Δεν βρέθηκαν φωτογραφίες με τεκμηριωμένη πηγή για αυτό το μαγαζί.'}</span></div>}
 <div className="venue-photo-actions"><a target="_blank" rel="noreferrer" href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(place.name+' '+(place.address||''))}>Φωτογραφίες Google Maps <ExternalLink size={12}/></a><a target="_blank" rel="noreferrer" href={'https://www.tripadvisor.com/Search?q='+encodeURIComponent(place.name+' '+(place.address||''))}>Tripadvisor <ExternalLink size={12}/></a></div>
 </section>
}
