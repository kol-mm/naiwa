// One loading veil for every jump: boot, new run, continue, and chapter changes.
// The veil is already visible in index.html, so it covers the first paint before
// the module graph has finished loading. This controller only owns its lifecycle.
const MIN_SHOW = 620;
const FADE = 320;

export function createLoadingVeil(node, options = {}) {
  if (!node) return {show() {}, hide() {}, bootDone() {}, isVisible: () => false, isBlocking: () => false};
  const minShow = options.minShow || MIN_SHOW;
  const fade = options.fade || FADE;
  const now = options.now || (() => performance.now());
  const label = node.querySelector('[data-loading-label]');
  let shownAt = now();
  let visible = true;
  let blocking = true;
  let hideTimer = 0;
  let fadeTimer = 0;

  function setLabel(text) {
    if (text && label) label.textContent = text;
  }

  function show(text, {min = minShow} = {}) {
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
    document.documentElement?.setAttribute?.('data-loading', 'true');
  }

  function finish() {
    if (!visible) return;
    visible = false;
    node.classList.remove('is-visible');
    node.classList.add('is-hiding');
    node.setAttribute('aria-busy', 'false');
    fadeTimer = setTimeout(() => {
      node.hidden = true;
      blocking = false;
      node.classList.remove('is-hiding');
      document.documentElement?.removeAttribute?.('data-loading');
    }, fade);
  }

  function hide(text) {
    if (!visible) return;
    setLabel(text);
    clearTimeout(hideTimer);
    clearTimeout(fadeTimer);
    const wait = Math.max(0, minShow - (now() - shownAt));
    hideTimer = setTimeout(finish, wait);
  }

  function bootDone(text = '池塘已就绪') {
    setLabel(text);
    hide();
  }

  return {show, hide, bootDone, isVisible: () => visible, isBlocking: () => blocking};
}
