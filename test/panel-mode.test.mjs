import test from 'node:test';
import assert from 'node:assert/strict';
import {createPanelResumeState} from '../dist/panel-mode.js';
import {recoverableSaveMode} from '../dist/run-mode.js';
import {Game} from '../dist/campaign.js';
import {startRescue} from '../dist/rescue.js';
import {deserializeRun,serializeRun} from '../dist/run-save.js';

test('closing a panel clears its return mode before a later rescue save', () => {
  const panel = createPanelResumeState();
  assert.equal(panel.suspend('play'), true, 'a map opened during play suspends it');
  assert.equal(panel.pending, 'play');
  assert.equal(panel.restore('paused'), 'play');
  assert.equal(panel.pending, null, 'closing the map must not leave play behind');

  // The next phase is rescue. A background save pauses it first; the stale
  // panel mode used to win over pauseMode and overwrite rescue with play.
  assert.equal(
    recoverableSaveMode({mode: 'paused', pauseMode: 'rescue', panelResumeMode: panel.pending}),
    'rescue',
  );
});

test('the cross-stage save keeps rescue progress after a map was closed with Start', () => {
  const panel = createPanelResumeState();
  panel.suspend('play');
  assert.equal(panel.restore('paused'), 'play');
  assert.equal(panel.pending, null);

  const game = new Game();
  game.start();
  game.floor = 5;
  startRescue(game);
  game.rescue.presses = 2;
  const mode = recoverableSaveMode({
    mode: 'paused',
    pauseMode: 'rescue',
    panelResumeMode: panel.pending,
  });
  const saved = deserializeRun(serializeRun(game, {mode})).game;
  assert.equal(saved.mode, 'rescue');
  assert.equal(saved.rescue.presses, 2);
});

test('panel suspension only accepts active modes and only restores from paused', () => {
  const panel = createPanelResumeState();
  assert.equal(panel.suspend('rescue'), true);
  assert.equal(panel.restore('play'), null, 'not paused: do not consume the return mode');
  assert.equal(panel.pending, 'rescue');
  assert.equal(panel.restore('paused'), 'rescue');
  assert.equal(panel.pending, null);
  assert.equal(panel.suspend('settings'), false);
  assert.equal(panel.suspend('paused'), false);
  panel.suspend('play');
  panel.clear();
  assert.equal(panel.pending, null);
});
