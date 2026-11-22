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
const imageResults=new WeakMap();
const preloads=new WeakMap(),decoded=new WeakSet();
function holding(){
 if(held===null)held=typeof document!=='undefined'&&!!document.documentElement?.hasAttribute?.('data-art-hold');
 return held;
}
// Starts (or queues) an image download. The name is kept for atlas lookups, since the URL may be .webp.
export function loadArt(image,file){
 image.assetName=file;
 const url=assetUrl(file);
 const source=WEBP.has(file)?new URL('./assets/'+file,import.meta.url).href:null;
 imageResults.set(image,new Promise(resolve=>{
  let canFallback=source!==null;
  function finish(ok){image.onload=null;image.onerror=null;resolve(ok)}
  image.onload=()=>finish(true);
  image.onerror=()=>{
   if(!canFallback){finish(false);return}
   canFallback=false;
   image.src=source;
  };
  const start=()=>{image.src=url};
  if(holding())queue.set(image,start);else start();
 }));
 return image;
}
// Callers waiting for the sprite see the final result of both formats.
export function artLoaded(image){return imageResults.get(image)??Promise.resolve(false)}
// The title and the renderer share the Image object, including its PNG retry.
export function preloadArt(image){
 if(!image||!imageResults.has(image))return Promise.resolve(false);
 if(preloads.has(image))return preloads.get(image);
 const start=queue.get(image);
 if(start){queue.delete(image);start()}
 const result=artLoaded(image).then(async loaded=>{
  if(!loaded)return false;
  try{await image.decode?.()}catch{if(!image.naturalWidth)return false}
  decoded.add(image);
  return true;
 });
 preloads.set(image,result);
 return result;
}
export function artDecoded(image){return decoded.has(image)}
export function artReady(){return holding()?ready:Promise.resolve()}
export function artHeld(){return holding()}
export function releaseArt(){
 if(!holding())return;
 held=false;document.documentElement.removeAttribute('data-art-hold');
 for(const start of queue.values())start();
 queue.clear();
 release();
}
