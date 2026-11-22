// One loading veil for every jump: boot, new run, continue, and chapter changes.
// The static cover shows progress during boot. The veil covers live room changes.
const MIN_SHOW = 620;
const FADE = 320;

export function createLoadingVeil(node, options = {}) {
  if (!node) return {show() {}, hide() {}, bootDone() {}, isVisible: () => false, isBlocking: () => false};
  const minShow = options.minShow ?? MIN_SHOW;
  const fade = options.fade ?? FADE;
  const maxWait = options.maxWait ?? 6000;
  const now = options.now || (() => performance.now());
  const label = node.querySelector('[data-loading-label]');
  const recovery = node.querySelector('[data-loading-recovery]');
  const retryButton = node.querySelector('[data-loading-retry]');
  const backButton = node.querySelector('[data-loading-back]');
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

  function clearRecovery() {
    if (recovery) recovery.hidden = true;
    if (retryButton) retryButton.onclick = null;
    if (backButton) backButton.onclick = null;
  }

  function show(text, {min = minShow} = {}) {
    revision++;
    clearTimeout(hideTimer);
    clearTimeout(fadeTimer);
    hideTimer = fadeTimer = 0;
    clearRecovery();
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
    clearRecovery();
    node.classList.remove('is-visible');
    node.classList.add('is-hiding');
    node.setAttribute('aria-busy', 'false');
    if (immediate) dismiss();
    else fadeTimer = setTimeout(dismiss, fade);
  }

  function hide(text, ready, {immediate = false, beforeReveal, retry, back} = {}) {
    if (!visible) return;
    const ticket = ++revision;
    clearTimeout(hideTimer);
    clearTimeout(fadeTimer);
    clearRecovery();
    function reveal() {
      if (revision !== ticket) return;
      clearTimeout(hideTimer);
      setLabel(text);
      clearRecovery();
      function uncover() {
        if (revision !== ticket) return;
        beforeReveal?.();
        finish(immediate);
      }
      const wait = immediate ? 0 : Math.max(0, minimum - (now() - shownAt));
      if (wait) hideTimer = setTimeout(uncover, wait);
      else uncover();
    }
    function offerRecovery(message) {
      if (revision !== ticket) return;
      clearTimeout(hideTimer);
      setLabel(message);
      if (recovery) recovery.hidden = !(retry || back);
      if (retryButton) retryButton.onclick = retry;
      if (backButton) backButton.onclick = back;
    }
    if (ready && !immediate) {
      hideTimer = setTimeout(() => offerRecovery('贴图还在加载…'), maxWait);
      const failed = () => offerRecovery('这间房的贴图加载失败');
      Promise.resolve(ready).then(ok => ok === false ? failed() : reveal(), failed);
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
