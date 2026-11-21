import test from 'node:test';
import assert from 'node:assert/strict';
import {bossArtDue} from '../dist/sprite-art.js';

const rooms=(bossId)=>Array.from({length:25},(_,i)=>({id:i,exists:true,type:i===bossId?'boss':'fight'}));

test('the boss sheet waits until the boss room is two tiles away',()=>{
 const map=rooms(4); // row 0, column 4
 assert.equal(bossArtDue(map,12,'start'),false,'start room is four tiles away');
 assert.equal(bossArtDue(map,1,'fight'),false,'three tiles away still waits');
 assert.equal(bossArtDue(map,8,'fight'),true,'two tiles away starts the download');
 assert.equal(bossArtDue(map,3,'fight'),true,'one tile away starts the download');
 assert.equal(bossArtDue(map,4,'boss'),true,'entering the boss room always loads');
});

test('missing maps or a map without a boss never request the sheet',()=>{
 assert.equal(bossArtDue(undefined,12,'fight'),false);
 assert.equal(bossArtDue([],12,'fight'),false);
 const noBoss=Array.from({length:25},(_,i)=>({id:i,exists:true,type:i===12?'start':'fight'}));
 assert.equal(bossArtDue(noBoss,12,'fight'),false);
});
