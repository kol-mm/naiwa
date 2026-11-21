// A mobile panel temporarily borrows the game's paused mode. Keep the return
// mode until the panel is actually closed, then clear it before the next save.
const RESUMABLE = new Set(['play', 'rescue']);

export function createPanelResumeState() {
  let pending = null;
  return {
    get pending() { return pending; },
    suspend(mode) {
      if (!RESUMABLE.has(mode)) return false;
      pending = mode;
      return true;
    },
    restore(mode) {
      if (mode !== 'paused' || !pending) return null;
      const resumeMode = pending;
      pending = null;
      return resumeMode;
    },
    clear() { pending = null; },
  };
}
