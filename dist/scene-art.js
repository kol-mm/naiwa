import {artDecoded, preloadArt, retryArt} from './asset-url.js';
import {previewSizes} from './preview-sizes.js';

const previews = new WeakMap();

export const previewPath = file => 'preview/' + file;

function loadPreview(full, state) {
  const image = new Image();
  image.decoding = 'async';
  const [width, height] = previewSizes[full.assetName];
  Object.assign(image, {assetName: full.assetName, atlasWidth: width, atlasHeight: height});
  return new Promise(resolve => {
    image.onload = async () => {
      try { await image.decode?.(); } catch { if (!image.naturalWidth) { resolve(false); return; } }
      if (!artDecoded(full)) state.image = image;
      resolve(true);
    };
    image.onerror = () => resolve(false);
    const url = new URL(previewPath(full.assetName), import.meta.url);
    if (state.attempt) url.searchParams.set('retry', state.attempt);
    image.src = url.href;
  });
}

function prepare(full, attempt) {
  const compact = full && !artDecoded(full) && previewSizes[full.assetName] && typeof Image !== 'undefined';
  if (compact) full.fetchPriority = 'low';
  const high = attempt ? retryArt(full) : preloadArt(full);
  if (!compact) return high;
  const state = {attempt, image: null};
  previews.set(full, state);
  // The first successful decode is playable, including PNG-only WebViews.
  // Keep the compact sheet if the full transfer fails. Release it on upgrade.
  state.ready = new Promise(resolve => {
    let failures = 0;
    const settled = ok => { if (ok || ++failures === 2) resolve(ok); };
    high.then(ok => { if (ok) state.image = null; settled(ok); });
    loadPreview(full, state).then(settled);
  });
  return state.ready;
}

export function preloadSceneArt(full) {
  return previews.get(full)?.ready ?? prepare(full, 0);
}

export function sceneArtReady(full) {
  return artDecoded(full) || !!previews.get(full)?.image;
}

export function retrySceneArt(full) {
  if (sceneArtReady(full)) return preloadSceneArt(full);
  return prepare(full, (previews.get(full)?.attempt ?? 0) + 1);
}

export function drawableArt(full) {
  if (!full) return null;
  if (artDecoded(full)) return full;
  const state = previews.get(full);
  if (state) return state.image;
  // Other atlas viewers can supply an already-loaded image directly.
  if (full.complete && full.naturalWidth) return full;
  preloadSceneArt(full);
  return null;
}
