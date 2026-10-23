// Keep franchise convenience/coffee chains out of the independent-spots directory.
// Matching is anchored at the beginning, never substring matching like "Mikelidis".
function normalized(text=''){
 return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLocaleLowerCase('el').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
}
const CHAINS=[
 '4all','4 all','four all','mikel','μικελ',
 'coffee island','coffeeisland','coffee lab','coffeelab',
 'coffee berry','coffeeberry','gregorys','gregory s','γρηγορης',
 'bruno','bruno coffee','everest','starbucks','flocafe','flocafe espresso room',
 'todaylicious','today stores','yes stores','yes store','coffee brands',
 'coffee house','coffeeway','coffee way','coffee break franchise',
 'presso','ok anytime markets','24 shopen'
].map(normalized);
const CHAIN_HOSTS=[
 '4all.gr','mikelcoffee.com','mikelcoffee.gr','coffeeisland.gr',
 'coffeelab.gr','coffeeberry.coffee','coffeeberry.gr','brunocoffee.gr',
 'gregorys.gr','everest.gr','starbucks.com','flocafe.gr','todaylicious.gr',
 'yesstores.gr'
];
export function isChain(place){
 const name=normalized(place?.name||'');
 if(name&&CHAINS.some(label=>name===label||name.startsWith(label+' ')))return true;
 const brand=normalized(place?.brand||'');
 if(brand&&CHAINS.some(label=>brand===label||brand.startsWith(label+' ')))return true;
 try{
  const host=new URL(place?.website||'').hostname.toLowerCase().replace(/^www\./,'');
  if(CHAIN_HOSTS.some(domain=>host===domain||host.endsWith('.'+domain)))return true;
 }catch{}
 return false;
}
