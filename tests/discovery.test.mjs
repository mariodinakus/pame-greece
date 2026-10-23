import test from 'node:test';
import assert from 'node:assert/strict';
import {openingStatus,recommendPlace} from '../app/discovery.js';
const clock=(day,hour,minute=0)=>({day,hour,minutes:hour*60+minute});
test('all-week hours recognize open and closed',()=>{
 assert.equal(openingStatus('Mo-Su 09:00-23:00',clock(5,15)).kind,'open');
 assert.equal(openingStatus('Mo-Su 09:00-23:00',clock(5,3)).kind,'closed');
});
test('weekday ranges are respected',()=>{
 assert.equal(openingStatus('Mo-Fr 09:00-18:00; Sa 10:00-13:00; Su off',clock(1,11)).kind,'open');
 assert.equal(openingStatus('Mo-Fr 09:00-18:00; Sa 10:00-13:00; Su off',clock(0,11)).kind,'closed');
 assert.equal(openingStatus('Mo-Fr 09:00-18:00; Sa 10:00-13:00; Su off',clock(6,11)).kind,'open');
});
test('overnight hours include the next day',()=>{
 assert.equal(openingStatus('Fr-Sa 19:00-02:00',clock(6,1)).kind,'open');
 assert.equal(openingStatus('Fr-Sa 19:00-02:00',clock(0,1)).kind,'open');
 assert.equal(openingStatus('Fr-Sa 19:00-02:00',clock(1,1)).kind,'closed');
});
test('complex opening hours are not guessed',()=>{
 assert.equal(openingStatus('PH off; Mo-Fr 09:00-16:00',clock(1,11)).kind,'unknown');
 assert.equal(openingStatus('',clock(1,11)).kind,'unknown');
});
test('time-based recommendations prioritize relevant venues',()=>{
 const night=clock(5,23);
 const bar=recommendPlace({type:'bar',hours:'18:00-03:00'},night);
 const cafe=recommendPlace({type:'cafe',hours:'08:00-18:00'},night);
 assert.ok(bar.score>cafe.score);
});
