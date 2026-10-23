import test from 'node:test';
import assert from 'node:assert/strict';
import {isChain} from '../app/chainFilter.js';

test('Excludes 4all and Mikel plus common franchises',()=>{
 for(const name of ['4All','4all Κέντρο','4 ALL','Mikel','MIKEL Αγίου Δημητρίου','Coffee Island','Γρηγόρης','Coffee Lab','Everest','Bruno','Starbucks','Coffee Berry']){
  assert.equal(isChain({name}),true,name);
 }
});
test('Does not over-filter independent cafes containing similar fragments',()=>{
 for(const name of ['Μικέλης Καφέ','The Mikelidis Bakery','Barolino','Coffee Collective','The Brunoise']){
  assert.equal(isChain({name}),false,name);
 }
});
test('Excludes franchise domains when business name is ambiguous',()=>{
 assert.equal(isChain({name:'My Coffee Spot',website:'https://mikelcoffee.gr/shops'}),true);
 assert.equal(isChain({name:'My Coffee Spot',website:'https://example.gr'}),false);
});
