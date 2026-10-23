'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,ExternalLink,Images} from 'lucide-react';

export default function CityPhotoStrip({center}){
 const [photos,setPhotos]=useState([]),[busy,setBusy]=useState(true),scroller=useRef(null);
 useEffect(()=>{
  let alive=true;setBusy(true);setPhotos([]);
  fetch('/api/city-photos?lat='+center[1]+'&lon='+center[2]).then(r=>r.json()).then(d=>{if(alive)setPhotos(d.photos||[])}).catch(()=>{}).finally(()=>{if(alive)setBusy(false)});
  return()=>{alive=false};
 },[center[1],center[2]]);
 if(!busy&&!photos.length)return null;
 return <section className="city-photo-section" aria-label="Φωτογραφίες από τη γύρω περιοχή">
  <div className="city-photo-heading"><div><div className="eyebrow"><Images size={14}/> THE CITY IN PICTURES</div><h2>Μια ματιά <em>στη γειτονιά.</em></h2><p>Αληθινές εικόνες από την ευρύτερη περιοχή, όχι απαραίτητα από τα συγκεκριμένα μαγαζιά.</p></div><div className="city-photo-controls"><button onClick={()=>scroller.current?.scrollBy({left:-600,behavior:'smooth'})} aria-label="Προηγούμενες εικόνες"><ArrowLeft size={17}/></button><button onClick={()=>scroller.current?.scrollBy({left:600,behavior:'smooth'})} aria-label="Επόμενες εικόνες"><ArrowRight size={17}/></button></div></div>
  {busy?<div className="city-photo-loading">Αναζητούμε φωτογραφίες με γεωγραφική σήμανση…</div>:<div className="city-photo-row" ref={scroller}>{photos.map((p,i)=><a className="city-photo-tile" key={p.url} href={p.source} target="_blank" rel="noreferrer" title={'Άνοιξε την πηγή και τα δικαιώματα χρήσης · '+p.title}><img src={p.url} alt={p.title} loading={i<3?'eager':'lazy'}/><div className="city-photo-info"><span>{p.title.slice(0,62)}</span><span><ExternalLink size={12}/> Wikimedia Commons</span></div></a>)}</div>}
 </section>;
}
