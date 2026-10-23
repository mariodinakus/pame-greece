#!/usr/bin/env python3
"""Build a nationwide, attributable OSM POI snapshot from Geofabrik's Greece PBF."""
import json, os, pathlib, sys
import osmium

OUT=pathlib.Path('public/data')
OUT.mkdir(parents=True,exist_ok=True)
CATEGORIES={'cafe','bar','pub','biergarten','restaurant','fast_food','ice_cream'}
class Places(osmium.SimpleHandler):
 def __init__(self):
  super().__init__()
  self.items=[]
 def add(self,obj,kind):
  t=obj.tags
  if t.get('amenity') not in CATEGORIES or not t.get('name'): return
  try:
   if kind=='node': lat,lon=obj.location.lat,obj.location.lon
   else:
    points=[(n.location.lat,n.location.lon) for n in obj.nodes if n.location.valid()]
    if not points:return
    lat=sum(x for x,y in points)/len(points)
    lon=sum(y for x,y in points)/len(points)
  except Exception:return
  if not (34.5<lat<42.2 and 19.0<lon<30.2):return
  self.items.append({'id':kind+'-'+str(obj.id),'name':t['name'],'lat':round(lat,6),'lon':round(lon,6),'type':t['amenity'],'style':t.get('cuisine',''),'website':t.get('website',t.get('contact:website','')),'hours':t.get('opening_hours',''),'address':' '.join(filter(None,[t.get('addr:street',''),t.get('addr:housenumber','')])),'osm':'https://www.openstreetmap.org/'+kind+'/'+str(obj.id)})
 def node(self,n):self.add(n,'node')
 def way(self,w):self.add(w,'way')
 # Relation geometries are omitted until a reliable multipolygon centroid is available.

if len(sys.argv)!=2:sys.exit('Usage: build-places.py greece-latest.osm.pbf')
h=Places()
h.apply_file(sys.argv[1],locations=True,idx='flex_mem')
# Partition in 0.1-degree grid cells to support fast, low-bandwidth nearest-place queries.
cells={}
for p in h.items:
 key=f"{int(p['lat']*10)}_{int(p['lon']*10)}"
 cells.setdefault(key,[]).append(p)
for key,rows in cells.items():
 (OUT/(key+'.json')).write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':')))
(OUT/'manifest.json').write_text(json.dumps({'source':'OpenStreetMap contributors / Geofabrik Greece','license':'ODbL','places':len(h.items),'cells':list(cells),'updated':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()},ensure_ascii=False,separators=(',',':')))
print('Exported',len(h.items),'venues in',len(cells),'cells')
