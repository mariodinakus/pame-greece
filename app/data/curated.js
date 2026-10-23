// Small editorial emergency catalog. Names and addresses are sourced from public guides.
// No coordinates or distance estimates are invented. Not a substitute for a live POI database.
const catalog=[
 ['Θεσσαλονίκη','PULP Bar','Αλεξάνδρου Σβώλου 8','pub','https://www.thessalonikiguide.gr/place/pulp-bar/'],
 ['Θεσσαλονίκη','The Hoppy Pub','Νικηφόρου Φωκά 6','pub','https://www.beer.gr/beerhouse/the-hoppy-pub'],
 ['Θεσσαλονίκη','Pastaflora Darling','Ζεύξιδος 6','cafe','https://www.bestofthessaloniki.gr/guide/bar-club/category/caf%C3%A9bar?page=1'],
 ['Θεσσαλονίκη','Partizan','Βαλαωρίτου 29','bar','https://www.bestofthessaloniki.gr/guide/bar-club/category/caf%C3%A9bar?page=1'],
 ['Θεσσαλονίκη','The Residents','Στρατηγού Καλλάρη 4','bar','https://www.bestofthessaloniki.gr/guide/bar-club/category/caf%C3%A9bar?page=1'],
 ['Θεσσαλονίκη','Thermaikos','Λεωφόρος Νίκης 21','bar','https://www.bestofthessaloniki.gr/guide/bar-club/category/caf%C3%A9bar?page=1'],
 ['Θεσσαλονίκη','The Bristol Pub','Γεωργίου Παπανδρέου 24','pub','https://www.bestofthessaloniki.gr/guide/bar-club/category/caf%C3%A9bar?page=1'],
 ['Θεσσαλονίκη','Local Espresso Bar','Π. Π. Γερμανού 17','cafe','https://www.bestofthessaloniki.gr/guide/bar-club/category/caf%C3%A9bar?page=1'],
 ['Αθήνα','six d.o.g.s','Αβραμιώτου 6-8','bar','https://www.thisisathens.org/nightlife/six-dogs'],
 ['Αθήνα','Baba au Rum','Κλειτίου 6','bar','https://www.babaaurum.com/el/']
];
export function fallbackPlaces(lat,lon){
 const city=Math.abs(lat-40.6401)<0.12&&Math.abs(lon-22.9444)<0.15?'Θεσσαλονίκη':Math.abs(lat-37.9838)<0.13&&Math.abs(lon-23.7275)<0.15?'Αθήνα':null;
 if(!city)return [];
 return catalog.filter(p=>p[0]===city).map((p,i)=>({id:'curated-'+city+'-'+i,name:p[1],address:p[2]+', '+city,type:p[3],lat:null,lon:null,style:'',website:'',hours:'',osm:'',sourceUrl:p[4],editorial:true}));
}
