// Browser regression for a running game. Requires Playwright with Chromium installed.
// Run: node scripts/check-entry-frames.cjs http://localhost:4173/
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

function recordFrames() {
  const canvas = CanvasRenderingContext2D.prototype;
  const clear = canvas.clearRect;
  const draw = canvas.drawImage;
  let room = false, hero = false, started = false;
  const counts = window.entryFrames = {visible: 0, withoutRoom: 0, withoutHero: 0};
  canvas.clearRect = function (...args) {
    if (this.canvas.id === 'game') room = hero = false;
    return clear.apply(this, args);
  };
  canvas.drawImage = function (image, ...args) {
    const result = draw.call(this, image, ...args);
    if (this.canvas.id === 'game' && image instanceof HTMLImageElement) {
      if (image.currentSrc.includes('/rooms-bright-v1.')) room = true;
      if (image.currentSrc.includes('/naiwa-pixel-v2.')) hero = true;
    }
    return result;
  };
  document.addEventListener('click', event => {
    if (event.target.closest('#start')) started = true;
  }, true);
  function sample() {
    const veil = document.getElementById('loadingVeil');
    if (started && veil) {
      const style = getComputedStyle(veil);
      if (veil.hidden || style.visibility === 'hidden' || Number(style.opacity) < 0.99) {
        counts.visible++;
        if (!room) counts.withoutRoom++;
        if (!hero) counts.withoutHero++;
      }
    }
    requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
}

async function check(browser, url, cold) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let release;
  const held = new Promise(resolve => { release = resolve; });
  try {
    if (cold) await page.route(/\/(rooms-bright-v1|naiwa-pixel-v2)\.(webp|png)(\?|$)/, async route => {
      await held;
      await route.continue();
    });
    await page.addInitScript(recordFrames);
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.locator('#start').waitFor();
    if (!cold) await page.evaluate(async () => {
      const {preloadArt} = await import('./asset-url.js');
      const {spriteImage} = await import('./sprite-art.js');
      const {costumeImage} = await import('./costumes.js');
      const ready = await Promise.all([spriteImage('rooms-bright-v1.png'), costumeImage('original')].map(preloadArt));
      if (!ready.every(Boolean)) throw Error('Failed to warm the room and hero');
    });
    await page.locator('#start').click();
    if (cold) await page.waitForTimeout(750);
    release();
    await page.locator('#loadingVeil').waitFor({state: 'hidden'});
    await page.evaluate(async () => {
      const {game} = await import(document.querySelector('script[type="module"][src*="game.js"]').src);
      window.entryGame = game;
    });
    await page.waitForFunction(() => window.entryGame.elapsed >= 2.05 && window.entryFrames.visible >= 20);
    const counts = await page.evaluate(() => window.entryFrames);
    assert.deepEqual(errors, []);
    assert.ok(counts.visible > 0);
    assert.equal(counts.withoutRoom, 0, 'visible frame without the room atlas');
    assert.equal(counts.withoutHero, 0, 'visible frame without the hero atlas');
    console.log(cold ? 'Delayed atlases' : 'Warm atlases', counts);
  } finally {
    release();
    await page.close();
  }
}

async function main() {
  const url = process.argv[2];
  if (!url) throw Error('Pass the URL of the running game.');
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH, chromiumSandbox: true});
  try {
    await check(browser, url, false);
    await check(browser, url, true);
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
