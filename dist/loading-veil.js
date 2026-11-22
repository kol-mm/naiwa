// One loading veil for every jump: boot, new run, continue, and chapter changes.
// The static cover shows progress during boot. The veil covers live room changes.
const MIN_SHOW = 620;
const FADE = 320;

export function createLoadingVeil(node, options = {}) {
  if (!node) return {show() {}, hide() {}, bootDone() {}, isVisible: () => false, isBlocking: () => false};
  const minShow = options.minShow || MIN_SHOW;
  const fade = options.fade || FADE;
  const maxWait = options.maxWait ?? 6000;
  const now = options.now || (() => performance.now());
  const label = node.querySelector('[data-loading-label]');
  let shownAt = now();
  let minimum = minShow;
  let visible = !node.hidden;
  let blocking = visible;
  let hideTimer = 0;
  let fadeTimer = 0;
  let revision = 0;

  function setLabel(text) {
    if (text && label) label.textContent = text;
  }

  function show(text, {min = minShow} = {}) {
    revision++;
    clearTimeout(hideTimer);
    clearTimeout(fadeTimer);
    hideTimer = fadeTimer = 0;
    visible = true;
    blocking = true;
    node.hidden = false;
    node.classList.remove('is-hiding');
    node.classList.add('is-visible');
    node.setAttribute('aria-busy', 'true');
    setLabel(text);
    shownAt = now();
    minimum = min;
    document.documentElement?.setAttribute?.('data-loading', 'true');
  }

  function dismiss() {
    node.hidden = true;
    blocking = false;
    node.classList.remove('is-hiding');
    document.documentElement?.removeAttribute?.('data-loading');
  }

  function finish(immediate = false) {
    if (!visible) return;
    visible = false;
    node.classList.remove('is-visible');
    node.classList.add('is-hiding');
    node.setAttribute('aria-busy', 'false');
    if (immediate) dismiss();
    else fadeTimer = setTimeout(dismiss, fade);
  }

  function hide(text, ready, {immediate = false} = {}) {
    if (!visible) return;
    const ticket = ++revision;
    clearTimeout(hideTimer);
    clearTimeout(fadeTimer);
    if (immediate) { setLabel(text); finish(true); return; }
    function reveal() {
      if (revision !== ticket) return;
      revision++;
      clearTimeout(hideTimer);
      setLabel(text);
      const wait = Math.max(0, minimum - (now() - shownAt));
      hideTimer = setTimeout(finish, wait);
    }
    if (ready) {
      // An interrupted image request must not freeze gameplay indefinitely.
      hideTimer = setTimeout(reveal, maxWait);
      Promise.resolve(ready).then(reveal, reveal);
    } else {
      reveal();
    }
  }

  function bootDone(text = '池塘已就绪') {
    minimum = 0;
    setLabel(text);
    hide();
  }

  return {show, hide, bootDone, isVisible: () => visible, isBlocking: () => blocking};
}
