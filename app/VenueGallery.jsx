'use client';
import {useEffect,useRef,useState} from 'react';
import {Camera,ExternalLink,Images,ImagePlus,X} from 'lucide-react';

function commonsTitle(place){
 const value=(place.wikimedia_commons||'').trim();
 return /^File:/i.test(value)?value:null;
}
export function safePhoto(place){
 const image=(place.image||'').trim();
 if(place.localPhoto&&/^data:image\/(jpeg|png|webp);base64,/i.test(place.localPhoto))return place.localPhoto;
 if(/^https:\/\//i.test(image)&&!/(google\.com|googleusercontent\.com|tripadvisor\.)/i.test(image))return image;
 const title=commonsTitle(place)||(/^File:/i.test(image)?image:null);
 return title?'https://commons.wikimedia.org/wiki/Special:FilePath/'+encodeURIComponent(title.replace(/^File:/i,''))+'?width=900':null;
}
function compress(file){
 return new Promise((resolve,reject)=>{
  if(!file.type.startsWith('image/'))return reject(new Error('Επίλεξε αρχείο εικόνας.'));
  if(file.size>8*1024*1024)return reject(new Error('Η φωτογραφία πρέπει να είναι μικρότερη από 8 MB.'));
  const url=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{
   try{
    const ratio=Math.min(1,1100/img.width,1100/img.height);
    const canvas=document.createElement('canvas');
    canvas.width=Math.round(img.width*ratio);canvas.height=Math.round(img.height*ratio);
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/jpeg',0.67);
    URL.revokeObjectURL(url);resolve(data);
   }catch(error){URL.revokeObjectURL(url);reject(error)}
  };
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Δεν ήταν δυνατή η ανάγνωση της εικόνας.'))};
  img.src=url;
 });
}
export function VenueCover({place,onClick}){
 const [failed,setFailed]=useState(false);
 const url=safePhoto(place);
 useEffect(()=>setFailed(false),[url]);
 return <div className={'venue-cover '+(!url||failed?'venue-cover-empty':'')} onClick={onClick} role={onClick?'button':undefined} tabIndex={onClick?0:undefined} onKeyDown={e=>{if(onClick&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onClick()}}}>
 {url&&!failed?<img src={url} alt={'Εικόνα για '+place.name} loading="lazy" onError={()=>setFailed(true)}/>:<div className="venue-cover-placeholder"><Camera size={30}/><span>Δες εικόνες του μαγαζιού</span></div>}
 <span className="venue-photo-label"><Camera size={12}/>{url&&!failed?(place.localPhoto?'Δική σου φωτογραφία':'Φωτογραφία καταχώρισης'):'Δείτε φωτογραφίες'}</span>
 </div>
}
export default function VenueGallery({place,personalPhotos=[],onAddPhotos,onRemovePhoto}){
 const [images,setImages]=useState([]);
 const [busy,setBusy]=useState(false),[uploadError,setUploadError]=useState('');
 const fileInput=useRef(null);
 useEffect(()=>{
  let active=true;setImages([]);setBusy(false);setUploadError('');
  const direct=safePhoto({...place,localPhoto:''});
  if(direct)setImages([{url:direct,description:'Φωτογραφία καταχώρισης',source:place.imageSource||(/^File:/i.test(place.wikimedia_commons||'')?'https://commons.wikimedia.org/wiki/'+encodeURIComponent(place.wikimedia_commons):place.osm)}]);
  const category=(place.wikimedia_commons||'').trim();
  if(!/^Category:/i.test(category))return()=>{active=false};
  setBusy(true);
  const params=new URLSearchParams({action:'query',generator:'categorymembers',gcmtitle:category,gcmtype:'file',gcmlimit:'14',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'900',format:'json',origin:'*'});
  fetch('https://commons.wikimedia.org/w/api.php?'+params).then(r=>r.json()).then(data=>{
   if(!active)return;
   const found=Object.values(data.query?.pages||{}).filter(x=>x.imageinfo?.[0]?.thumburl).map(x=>({url:x.imageinfo[0].thumburl,description:x.title,source:x.imageinfo[0].descriptionurl})).slice(0,12);
   setImages(old=>[...old,...found.filter(p=>!old.some(x=>x.url===p.url))]);
  }).catch(()=>{}).finally(()=>{if(active)setBusy(false)});
  return()=>{active=false};
 },[place.id,place.image,place.imageSource,place.wikimedia_commons]);
 async function upload(files){
  if(!files?.length)return;
  setUploadError('');
  try{const pictures=await Promise.all([...files].slice(0,3).map(compress));onAddPhotos?.(place.id,pictures)}
  catch(error){setUploadError(error.message||'Δεν αποθηκεύτηκε η εικόνα.')}
  finally{if(fileInput.current)fileInput.current.value=''}
 }
 const all=[...personalPhotos.map((url,i)=>({url,personal:true,index:i,description:'Προσωπική φωτογραφία'})),...images];
 return <section className="venue-gallery">
  <div className="venue-gallery-title"><Images size={18}/><strong>Φωτογραφίες</strong><span>{all.length?all.length+' διαθέσιμες':'Χωρίς καταχωρισμένες εικόνες'}</span></div>
  {all.length?<div className="venue-gallery-grid">{all.map((img,i)=><div className="venue-photo-frame" key={i}><img src={img.url} alt={img.description||place.name} loading="lazy"/>{img.personal?<><span className="local-photo-label">Δική σου φωτογραφία</span><button className="remove-local-photo" aria-label="Διαγραφή προσωπικής φωτογραφίας" onClick={()=>onRemovePhoto?.(place.id,img.index)}><X size={14}/></button></>:<a href={img.source||img.url} target="_blank" rel="noreferrer" aria-label="Πηγή και άδεια φωτογραφίας"><ExternalLink size={14}/> Πηγή</a>}</div>)}</div>:<div className="venue-gallery-empty"><Camera size={24}/><span>{busy?'Φόρτωση εικόνων Wikimedia Commons…':'Δεν υπάρχουν επαληθευμένες φωτογραφίες στα διαθέσιμα ανοιχτά δεδομένα.'}</span></div>}
  <div className="venue-photo-actions">
   <button type="button" onClick={()=>fileInput.current?.click()}><ImagePlus size={14}/> Πρόσθεσε δική σου φωτογραφία</button>
   <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={e=>upload(e.target.files)}/>
   <a target="_blank" rel="noreferrer" href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(place.name+' '+(place.address||''))}>Google Maps <ExternalLink size={12}/></a>
   <a target="_blank" rel="noreferrer" href={'https://www.tripadvisor.com/Search?q='+encodeURIComponent(place.name+' '+(place.address||''))}>Tripadvisor <ExternalLink size={12}/></a>
  </div>
  <p className="venue-gallery-disclosure">Οι δικές σου φωτογραφίες αποθηκεύονται μόνο στη συσκευή σου. Οι φωτογραφίες Wikimedia συνδέονται με την πηγή και τους όρους χρήσης τους.</p>
  {uploadError&&<p className="venue-gallery-error" role="alert">{uploadError}</p>}
 </section>;
}
