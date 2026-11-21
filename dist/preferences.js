// Player-facing options that survive reloads. Kept dependency-free so the game can
// read them before any art or audio starts loading, and so tests can import it in Node.
export const STORAGE_KEY='naiwa-preferences';
// Max canvas scale per quality tier: the renderer multiplies display size by DPR,
// so a weaker phone can pick 1× and give up sharpness instead of frames.
export const QUALITY_LEVELS={battery:1,standard:1.5,sharp:2};
export const DEFAULT_PREFERENCES=Object.freeze({volume:1,shake:1,quality:'sharp',gamepad:true});
// Accessing localStorage can itself throw on opaque/restricted host pages.
export function safeStorage(view=globalThis){try{return view?.localStorage??null}catch{return null}}
const has=key=>Object.prototype.hasOwnProperty.call(QUALITY_LEVELS,key);
export function normalizePreferences(raw){
 const source=raw&&typeof raw==='object'?raw:{};
 const volume=Number(source.volume),shake=Number(source.shake);
 return {
  volume:Number.isFinite(volume)?Math.min(1,Math.max(0,volume)):DEFAULT_PREFERENCES.volume,
  shake:Number.isFinite(shake)?Math.min(1,Math.max(0,shake)):DEFAULT_PREFERENCES.shake,
  quality:has(source.quality)?source.quality:DEFAULT_PREFERENCES.quality,
  gamepad:source.gamepad!==false
 };
}
export function renderCap(quality){return QUALITY_LEVELS[quality]??QUALITY_LEVELS[DEFAULT_PREFERENCES.quality]}
export function readPreferences(storage){
 try{return normalizePreferences(JSON.parse(storage?.getItem?.(STORAGE_KEY)||'{}'))}catch{return {...DEFAULT_PREFERENCES}}
}
export function writePreferences(prefs,storage){
 try{storage?.setItem?.(STORAGE_KEY,JSON.stringify(normalizePreferences(prefs)))}catch{}
}
