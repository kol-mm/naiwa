import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PREFERENCES,normalizePreferences,readPreferences,writePreferences,renderCap,safeStorage,STORAGE_KEY} from '../dist/preferences.js';

test('preferences clamp out-of-range values and fall back to defaults',()=>{
 assert.deepEqual(normalizePreferences(undefined),{...DEFAULT_PREFERENCES});
 assert.deepEqual(normalizePreferences(null),{...DEFAULT_PREFERENCES});
 assert.deepEqual(normalizePreferences({volume:2,shake:-3}).volume,1);
 assert.deepEqual(normalizePreferences({volume:2,shake:-3}).shake,0);
 assert.equal(normalizePreferences({volume:'loud'}).volume,DEFAULT_PREFERENCES.volume);
 assert.equal(normalizePreferences({quality:'ultra'}).quality,DEFAULT_PREFERENCES.quality);
 assert.equal(normalizePreferences({quality:'battery'}).quality,'battery');
 assert.equal(normalizePreferences({gamepad:false}).gamepad,false);
 assert.equal(normalizePreferences({gamepad:'no'}).gamepad,true);
});

test('quality tiers cap the render scale between 1x and 2x',()=>{
 assert.equal(renderCap('battery'),1);
 assert.equal(renderCap('standard'),1.5);
 assert.equal(renderCap('sharp'),2);
 assert.equal(renderCap('unknown'),2);
});

test('preferences survive a round trip and broken storage never throws',()=>{
 const store=new Map(),storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
 const prefs={volume:.42,shake:.5,quality:'battery',gamepad:false};
 writePreferences(prefs,storage);
 assert.deepEqual(readPreferences(storage),prefs);
 assert.ok(store.get(STORAGE_KEY).includes('battery'));
 store.set(STORAGE_KEY,'{not json');
 assert.deepEqual(readPreferences(storage),{...DEFAULT_PREFERENCES});
 assert.deepEqual(readPreferences(undefined),{...DEFAULT_PREFERENCES});
 const throwing={getItem(){throw new Error('blocked')},setItem(){throw new Error('blocked')}};
 assert.doesNotThrow(()=>writePreferences(prefs,throwing));
 assert.deepEqual(readPreferences(throwing),{...DEFAULT_PREFERENCES});
});


test('a restricted host may throw while handing over localStorage; reading and writing still fall back',()=>{
 const view={};Object.defineProperty(view,'localStorage',{get(){throw new Error('SecurityError')}});
 assert.equal(safeStorage(view),null);
 assert.deepEqual(readPreferences(safeStorage(view)),{...DEFAULT_PREFERENCES});
 assert.doesNotThrow(()=>writePreferences({volume:.5},safeStorage(view)));
});
