// Preserve the cover or the last painted room until the next one is playable.
// A compact recovery prompt is only needed if neither texture version arrives.
export function createSceneTransition({notice, hold, overlay, canvas, slowAfter = 10000}) {
  const label = notice.querySelector('[data-loading-label]');
  const retryButton = notice.querySelector('[data-loading-retry]');
  const backButton = notice.querySelector('[data-loading-back]');
  let pending = false, revision = 0, timer;

  function clearNotice() {
    clearTimeout(timer);
    notice.hidden = true;
    retryButton.onclick = backButton.onclick = null;
  }

  function begin() {
    revision++;
    pending = true;
    clearNotice();
    const cover = overlay.querySelector('.title-cover, .confirm-modal');
    if (cover && !hold.firstChild) hold.append(cover);
    hold.hidden = false;
    canvas.setAttribute('aria-busy', 'true');
  }

  function cancel() {
    revision++;
    pending = false;
    clearNotice();
    hold.hidden = true;
    hold.replaceChildren();
    canvas.removeAttribute('aria-busy');
  }

  function present(ready, {paint, retry, back}) {
    const ticket = ++revision;
    function commit() {
      if (revision !== ticket) return;
      paint();
      if (revision === ticket) cancel();
    }
    if (!ready) { commit(); return; }
    function offer(text) {
      if (revision !== ticket) return;
      clearTimeout(timer);
      label.textContent = text;
      notice.hidden = false;
      retryButton.onclick = retry;
      backButton.onclick = back;
    }
    timer = setTimeout(() => offer('连接较慢，仍在准备这间房。'), slowAfter);
    const failed = () => offer('这间房的贴图暂时无法打开。');
    ready.then(ok => ok ? commit() : failed(), failed);
  }

  return {begin, present, cancel, isBlocking: () => pending};
}
