'use client';
import {useEffect,useRef,useState} from 'react';

export default function PlacesMap({places=[],center,onSelect}){
 const node=useRef(null);
 const map=useRef(null);
 const layer=useRef(null);
 const onSelectRef=useRef(onSelect);
 const [ready,setReady]=useState(false);
 useEffect(()=>{onSelectRef.current=onSelect},[onSelect]);
 useEffect(()=>{
  let active=true;
  import('leaflet').then(L=>{
   if(!active||!node.current||map.current)return;
   const m=L.map(node.current,{zoomControl:false,scrollWheelZoom:true,preferCanvas:true,minZoom:7}).setView([center[1],center[2]],11);
   const satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'Imagery &copy; Esri, Maxar, Earthstar Geographics, GIS User Community',maxZoom:19});
   const street=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',maxZoom:19});
   const labels=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{attribution:'Labels &copy; Esri',maxZoom:19});
   satellite.addTo(m);
   labels.addTo(m);
   L.control.layers({'Δορυφορικός':satellite,'Οδικός':street},{'Ονόματα περιοχών':labels},{position:'topright',collapsed:true}).addTo(m);
   L.control.zoom({position:'bottomright'}).addTo(m);
   layer.current=L.layerGroup().addTo(m);
   map.current=m;
   setReady(true);
   setTimeout(()=>{if(active)m.invalidateSize()},250);
  }).catch(error=>console.error('Map initialization failed',error));
  return()=>{active=false;if(map.current){map.current.remove();map.current=null;layer.current=null}};
 },[]);
 useEffect(()=>{
  if(!ready||!map.current)return;
  map.current.setView([center[1],center[2]],11,{animate:true});
 },[ready,center[1],center[2]]);
 useEffect(()=>{
  if(!ready||!map.current||!layer.current)return;
  const m=map.current,group=layer.current;
  let alive=true;
  import('leaflet').then(L=>{
   if(!alive||!map.current)return;
   const render=()=>{
    if(!alive||!layer.current)return;
    group.clearLayers();
    const zoom=m.getZoom();
    const bounds=m.getBounds().pad(.22);
    const size=zoom<=11?68:zoom<=13?54:zoom<=15?40:0;
    const buckets=new Map();
    let drawn=0;
    for(const p of places){
     if(!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||!bounds.contains([p.lat,p.lon]))continue;
     const point=m.latLngToContainerPoint([p.lat,p.lon]);
     const key=size?Math.floor(point.x/size)+':'+Math.floor(point.y/size):p.id;
     const cell=buckets.get(key);
     if(cell){cell.items.push(p);cell.lat+=p.lat;cell.lon+=p.lon}
     else buckets.set(key,{items:[p],lat:p.lat,lon:p.lon});
     if(++drawn>=14000)break;
    }
    for(const cell of buckets.values()){
     const count=cell.items.length,p=cell.items[0],lat=cell.lat/count,lon=cell.lon/count;
     const cluster=count>1;
     const marker=L.circleMarker([lat,lon],{
      radius:cluster?Math.min(22,10+Math.log2(count)*2.5):7,
      weight:2.2,color:'#fff',
      fillColor:cluster?'#213e35':p.type==='cafe'?'#d48b5a':p.type==='restaurant'?'#bc735a':'#4b806a',
      fillOpacity:.97
     });
     if(cluster){
      marker.bindTooltip(count+' στέκια',{direction:'top',offset:[0,-8]});
      marker.on('click',()=>m.setView([lat,lon],Math.min(18,zoom+2),{animate:true}));
      const badge=L.marker([lat,lon],{interactive:false,icon:L.divIcon({className:'pame-cluster-count',html:'<span>'+count+'</span>',iconSize:[32,32],iconAnchor:[16,16]})});
      badge.addTo(group);
     }else{
      marker.bindTooltip(p.name,{direction:'top',offset:[0,-9]});
      marker.on('click',()=>onSelectRef.current?.(p));
     }
     marker.addTo(group);
    }
   };
   m.on('moveend zoomend resize',render);
   render();
   layer.current.__cleanup=()=>m.off('moveend zoomend resize',render);
  }).catch(error=>console.error('Map markers failed',error));
  return()=>{alive=false;if(group.__cleanup){group.__cleanup();delete group.__cleanup;}group.clearLayers()};
 },[places,ready]);
 return <div className="pame-map-shell">
  <div className="pame-map" ref={node} role="region" aria-label="Δορυφορικός διαδραστικός χάρτης καταστημάτων"/>
  <div className="pame-map-caption">Δορυφορικός χάρτης · Επίλεξε σημείο ή πλησίασε για να δεις περισσότερα στέκια</div>
 </div>;
}
