// Asset URLs and load order.
// Art keeps its .png name as the identifier everywhere; the URL builder serves the WebP twin
// listed in asset-webp.js. The title can promote its first-room images through the
// cover hold. Other callers wait for releaseArt, or start immediately on other pages.
import {WEBP} from './asset-webp.js';
export function assetFile(file){return WEBP.has(file)?file.replace(/\.png$/,'.webp'):file}
export function assetUrl(file){return new URL('./assets/'+assetFile(file),import.meta.url).href}
// For HTML and inline-style strings, which resolve against index.html.
export function assetPath(file){return 'assets/'+assetFile(file)}
let held=null,release=null;
const queue=new Map(),ready=new Promise(resolve=>{release=resolve});
const requests=new WeakMap();
let frameImages;
// During a room change the renderer itself identifies any extra art in the saved scene.
export function collectFrameArt(paint){
 const previous=frameImages,images=new Set();
 frameImages=images;
 try{paint()}finally{frameImages=previous}
 return images;
}
export function frameArt(image){
 if(frameImages&&image)frameImages.add(image);
 return image;
}
function holding(){
 if(held===null)held=typeof document!=='undefined'&&!!document.documentElement?.hasAttribute?.('data-art-hold');
 return held;
}
// Starts (or queues) an image download. The name is kept for atlas lookups, since the URL may be .webp.
export function loadArt(image,file,retry=0){
 image.assetName=file;
 const suffix=retry?'?retry='+retry:'';
 const state={retry,decoded:false};
 requests.get(image)?.settle(false);
 requests.set(image,state);
 state.loaded=new Promise(resolve=>{state.settle=resolve});
 let fallback=WEBP.has(file);
 function finish(ok){
  if(requests.get(image)!==state)return;
  image.onload=image.onerror=null;
  state.settle(ok);
 }
 image.onload=()=>finish(true);
 image.onerror=()=>{
  if(requests.get(image)!==state)return;
  if(!fallback){finish(false);return}
  fallback=false;
  image.src=new URL('./assets/'+file,import.meta.url).href+suffix;
 };
 const start=()=>{image.src=assetUrl(file)+suffix};
 if(holding())queue.set(image,start);else start();
 return image;
}
// Callers waiting for the sprite see the final result of both formats.
export function artLoaded(image){return requests.get(image)?.loaded??Promise.resolve(false)}
// The title and the renderer share the Image object, including its PNG retry.
export function preloadArt(image){
 const state=requests.get(image);
 if(!state)return Promise.resolve(false);
 if(state.preload)return state.preload;
 const start=queue.get(image);
 if(start){queue.delete(image);start()}
 state.preload=state.loaded.then(async loaded=>{
  if(!loaded)return false;
  try{await image.decode?.()}catch{if(!image.naturalWidth)return false}
  if(requests.get(image)!==state)return false;
  state.decoded=true;
  return true;
 });
 return state.preload;
}
export function retryArt(image){
 const state=requests.get(image);
 if(state&&!state.decoded){
  loadArt(image,image.assetName,state.retry+1);
  return preloadArt(image);
 }
 return preloadArt(image);
}
export function artDecoded(image){return requests.get(image)?.decoded===true}
export function artReady(){return holding()?ready:Promise.resolve()}
export function artHeld(){return holding()}
export function releaseArt(){
 if(!holding())return;
 held=false;document.documentElement.removeAttribute('data-art-hold');
 for(const start of queue.values())start();
 queue.clear();
 release();
}
