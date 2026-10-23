'use client';
import {useEffect,useRef} from 'react';
export default function PlacesMap({places,center,onSelect}){
 const node=useRef(null),map=useRef(null),layer=useRef(null),callback=useRef(onSelect);
 useEffect(()=>{callback.current=onSelect},[onSelect]);
 useEffect(()=>{
  let alive=true;
  import('leaflet').then(L=>{
   if(!alive||!node.current||map.current)return;
   const m=L.map(node.current,{zoomControl:false,scrollWheelZoom:false}).setView([center[1],center[2]],13);
   L.control.zoom({position:'bottomright'}).addTo(m);
   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',maxZoom:19}).addTo(m);
   map.current=m;layer.current=L.layerGroup().addTo(m);
   setTimeout(()=>m.invalidateSize(),200);
  }).catch(()=>{});
  return()=>{alive=false;if(map.current){map.current.remove();map.current=null;layer.current=null}}
 },[]);
 useEffect(()=>{
  if(!map.current)return;
  map.current.setView([center[1],center[2]],map.current.getZoom(),{animate:true});
 },[center]);
 useEffect(()=>{
  let cancelled=false;
  import('leaflet').then(L=>{
   if(cancelled||!layer.current)return;
   layer.current.clearLayers();
   places.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)).slice(0,600).forEach(p=>{
    const marker=L.circleMarker([p.lat,p.lon],{radius:7,weight:2,color:'#fff',fillColor:p.type==='cafe'?'#a56b4c':'#526b60',fillOpacity:.96});
    marker.bindTooltip(p.name,{direction:'top',offset:[0,-8]});
    marker.on('click',()=>callback.current?.(p));
    marker.addTo(layer.current);
   });
  }).catch(()=>{});
  return()=>{cancelled=true};
 },[places]);
 return <div className="pame-map" ref={node} role="region" aria-label="Διαδραστικός χάρτης καταστημάτων"/>;
}
