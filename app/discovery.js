// Conservative time-aware discovery: infer only from explicit, parseable OSM hours.
const DAYS=['Su','Mo','Tu','We','Th','Fr','Sa'];
const DAY_NUM={Su:0,Mo:1,Tu:2,We:3,Th:4,Fr:5,Sa:6};
export function athensClock(){
 const fmt=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Athens',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const parts=Object.fromEntries(fmt.formatToParts(new Date()).map(x=>[x.type,x.value]));
 return {day:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday),minutes:Number(parts.hour)*60+Number(parts.minute),hour:Number(parts.hour)};
}
function daysFrom(text){
 if(!text)return new Set([0,1,2,3,4,5,6]);
 const days=new Set();
 for(const segment of text.split(',')){
  const v=segment.trim(),parts=v.split('-');
  if(parts.length===1){if(DAY_NUM[v]===undefined)return null;days.add(DAY_NUM[v]);continue;}
  if(parts.length!==2||DAY_NUM[parts[0]]===undefined||DAY_NUM[parts[1]]===undefined)return null;
  let d=DAY_NUM[parts[0]];for(let i=0;i<7;i++){days.add(d);if(d===DAY_NUM[parts[1]])break;d=(d+1)%7}
 }
 return days;
}
export function openingStatus(raw,clock){
 if(!clock)return {kind:'unknown',label:'Ωράριο μη επαληθευμένο'};
 const h=(raw||'').trim();
 if(!h)return {kind:'unknown',label:'Δεν υπάρχει δηλωμένο ωράριο'};
 if(/^24\/7$/i.test(h))return {kind:'open',label:'24ωρο · δηλωμένο ωράριο'};
 const segments=h.split(';').map(s=>s.trim()).filter(Boolean);
 let parsed=[];
 for(const seg of segments){
  if(/\b(PH|SH|sunrise|sunset|unknown|open|closed|appointment)\b/i.test(seg))return {kind:'unknown',label:'Σύνθετο δηλωμένο ωράριο'};
  const m=/^(?:((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\s+)?(.+)$/.exec(seg);
  if(!m)return {kind:'unknown',label:'Σύνθετο δηλωμένο ωράριο'};
  const days=daysFrom(m[1]||'');
  if(!days)return {kind:'unknown',label:'Σύνθετο δηλωμένο ωράριο'};
  if(m[2]==='off'){parsed.push({days,ranges:[]});continue}
  const ranges=[];
  for(const pair of m[2].split(',').map(x=>x.trim())){
   const t=/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(pair);
   if(!t)return {kind:'unknown',label:'Σύνθετο δηλωμένο ωράριο'};
   const sh=+t[1],sm=+t[2],eh=+t[3],em=+t[4];
   if(sh>23||eh>24||sm>59||em>59||(eh===24&&em!==0))return {kind:'unknown',label:'Σύνθετο δηλωμένο ωράριο'};
   ranges.push([sh*60+sm,eh*60+em]);
  }
  parsed.push({days,ranges});
 }
 const previous=(clock.day+6)%7;
 const open=parsed.some(({days,ranges})=>ranges.some(([from,to])=>
  to>from?(days.has(clock.day)&&clock.minutes>=from&&clock.minutes<to):
   ((days.has(clock.day)&&clock.minutes>=from)||(days.has(previous)&&clock.minutes<to))));
 return open?{kind:'open',label:'Σύμφωνα με το δηλωμένο ωράριο'}:{kind:'closed',label:'Εκτός δηλωμένου ωραρίου'};
}
export function recommendPlace(p,clock,rating){
 if(!clock)return {score:0,label:'Πρόταση βάσει κατηγορίας',reason:'Δεν υπάρχουν διαθέσιμα δεδομένα ώρας',status:openingStatus(p.hours,null)};
 const hr=clock.hour,type=p.type;
 let score=0,reason='';
 if(hr>=7&&hr<12){score=type==='cafe'?7:type==='restaurant'?1:0;reason='Πρωινός καφές'}
 else if(hr>=12&&hr<17){score=type==='restaurant'?7:type==='cafe'?6:type==='bar'?2:1;reason='Μεσημέρι & χαλαρή έξοδος'}
 else if(hr>=17&&hr<20){score=type==='cafe'?7:type==='bar'?6:type==='restaurant'?5:3;reason='Απογευματινή έξοδος'}
 else {score=['bar','pub','biergarten'].includes(type)?8:type==='restaurant'?4:type==='cafe'?2:0;reason='Βραδινή έξοδος'}
 const status=openingStatus(p.hours,clock);
 if(status.kind==='open')score+=4;
 if(status.kind==='closed')score-=10;
 if(p.outdoor_seating==='yes'&&hr>=16&&hr<24)score+=0.3;
 if(p.image||p.wikimedia_commons)score+=0.2;
 if(rating)score+=(rating.avg-3)*0.3;
 return {score,label:reason,reason:status.kind==='open'?'Ταιριάζει στην ώρα και έχει δηλωμένο ωράριο':status.kind==='closed'?'Εκτός δηλωμένου ωραρίου': 'Ταιριάζει στην ώρα και στην κατηγορία',status};
}
