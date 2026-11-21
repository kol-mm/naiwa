// The game can be paused on a UI screen whose mode cannot be serialized.
// Resolve the mode that was active before that screen, not the screen itself.
export function recoverableSaveMode({
  mode,
  settingsReturn = null,
  oldMode = 'play',
  wardrobeMode = 'play',
  panelResumeMode = null,
  pauseMode = 'play',
} = {}) {
  let result = mode;
  if (result === 'settings') result = settingsReturn?.mode ?? result;
  if (result === 'help') result = oldMode;
  if (result === 'wardrobe') result = wardrobeMode;
  if (result === 'paused') result = panelResumeMode || pauseMode;
  return result;
}
