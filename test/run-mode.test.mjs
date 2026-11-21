import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverableSaveMode} from '../dist/run-mode.js';

test('settings saves through the mode the player can actually resume',()=>{
  assert.equal(recoverableSaveMode({mode: 'play'}), 'play');
  assert.equal(recoverableSaveMode({mode: 'settings',settingsReturn: {mode: 'play'}}), 'play');
  assert.equal(recoverableSaveMode({mode: 'settings',settingsReturn: {mode: 'paused'},pauseMode: 'play'}), 'play');
  assert.equal(recoverableSaveMode({mode: 'settings',settingsReturn: {mode: 'paused'},panelResumeMode: 'rescue',pauseMode: 'play'}), 'rescue');
  assert.equal(recoverableSaveMode({mode: 'paused',panelResumeMode: 'play',pauseMode: 'rescue'}), 'play');
  assert.equal(recoverableSaveMode({mode: 'help',oldMode: 'paused',pauseMode: 'rescue'}), 'rescue');
  assert.equal(recoverableSaveMode({mode: 'wardrobe',wardrobeMode: 'play'}), 'play');
});
