// The settings sheet. Kept out of game.js so the wiring stays readable and the
// markup can be tested by importing the string builder.
import {QUALITY_LEVELS,normalizePreferences} from './preferences.js';

const QUALITY_LABELS={
 battery:'省电 · 最轻的画面',
 standard:'标准 · 清晰与性能兼顾',
 sharp:'清晰 · 原生分辨率'
};
const percent=value=>Math.round(value*100);

export function settingsHTML(prefs){
 const quality=Object.entries(QUALITY_LABELS).map(([key,label])=>`<option value="${key}"${prefs.quality===key?' selected':''}>${label}</option>`).join('');
 return `<div class="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settingsTitle"><div class="mini">SETTINGS</div><h2 id="settingsTitle">游戏设置</h2>
 <div class="settings-row"><label for="setVolume">音量</label><input id="setVolume" type="range" min="0" max="100" step="1" value="${percent(prefs.volume)}" aria-label="音量"><output id="setVolumeOut">${percent(prefs.volume)}%</output></div>
 <div class="settings-row"><label for="setShake">震屏</label><input id="setShake" type="range" min="0" max="100" step="5" value="${percent(prefs.shake)}" aria-label="震屏强度"><output id="setShakeOut">${percent(prefs.shake)}%</output></div>
 <div class="settings-row"><label for="setQuality">画面</label><select id="setQuality" aria-label="画面质量">${quality}</select></div>
 <div class="settings-row settings-toggle"><label for="setGamepad">手柄</label><input id="setGamepad" type="checkbox"${prefs.gamepad?' checked':''}></div>
 <p class="settings-note">手柄：左摇杆移动，右摇杆瞄准并射击；A 蛙跳 / B 炸弹 / X 互动 / Y 大爆笑 / Start 暂停。设置会记在这台设备上。</p>
 <button class="primary" id="settingsClose">回到游戏 →</button></div>`;
}

// Writes into the same prefs object the game loop reads, so changes apply next frame.
export function bindSettings(root,prefs,onChange){
 const find=selector=>root.querySelector(selector);
 const commit=patch=>{Object.assign(prefs,normalizePreferences({...prefs,...patch}));onChange(prefs)};
 const volume=find('#setVolume'),volumeOut=find('#setVolumeOut');
 volume.oninput=()=>{const value=Number(volume.value)/100;volumeOut.textContent=percent(value)+'%';commit({volume:value})};
 const shake=find('#setShake'),shakeOut=find('#setShakeOut');
 shake.oninput=()=>{const value=Number(shake.value)/100;shakeOut.textContent=percent(value)+'%';commit({shake:value})};
 const quality=find('#setQuality');
 quality.onchange=()=>commit({quality:quality.value});
 const gamepad=find('#setGamepad');
 gamepad.onchange=()=>commit({gamepad:!!gamepad.checked});
 return {close:find('#settingsClose')};
}

export {QUALITY_LEVELS};
