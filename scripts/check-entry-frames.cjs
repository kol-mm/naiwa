// Run against a served copy or the real Pages URL with Playwright and Chromium.
// node scripts/check-entry-frames.cjs http://localhost:4173/
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

function observeRendering() {
  const proto = CanvasRenderingContext2D.prototype;
  const clear = proto.clearRect, draw = proto.drawImage, raf = window.requestAnimationFrame;
  const sheets = window.drawnSheets = new Set();
  window.frameAudit = {visible: 0, missing: 0, notices: 0};
  proto.clearRect = function (...args) {
    if (this.canvas.id === 'game') sheets.clear();
    return clear.apply(this, args);
  };
  proto.drawImage = function (image, ...args) {
    const result = draw.call(this, image, ...args);
    if (this.canvas.id === 'game' && image instanceof HTMLImageElement) {
      sheets.add(new URL(image.currentSrc).pathname.split('/').slice(-2).join('/'));
    }
    return result;
  };
  window.requestAnimationFrame = function (callback) {
    if (callback.name !== 'frame') return raf.call(window, callback);
    return raf.call(window, time => {
      callback(time);
      if (!window.auditSheets || document.querySelector('.title-cover')) return;
      const audit = window.frameAudit;
      audit.visible++;
      if (!document.getElementById('loadingVeil').hidden) audit.notices++;
      if (!window.auditSheets.every(name => [...sheets].some(url => url.includes('/' + name + '.')))) audit.missing++;
    });
  };
}

const room = 'rooms-bright-v1', hero = 'naiwa-pixel-v2', monsters = 'mobs-milk-v1';
async function run(browser, url, scenario) {
  const mobile = scenario === 'continue';
  const page = await browser.newPage(mobile ? {isMobile:true, hasTouch:true, viewport:{width:412,height:915}} : {});
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const quick = scenario !== 'warm';
  const first = mobile ? ['rooms-bright-v1', 'costume-lotusrain-v1', 'followers-family-v2'] : [room, hero];
  const waitForSheets = (names, quality) => page.waitForFunction(({names, quality}) =>
    names.every(name => [...window.drawnSheets].some(file => file.startsWith(quality+'/'+name+'.'))), {names, quality});
  try {
    if (mobile) {
      const {Game} = await import('../dist/campaign.js');
      const {createRunStore} = await import('../dist/run-save.js');
      const game = new Game();
      game.start();
      game.items.push('mouse');
      let save;
      assert.ok(createRunStore({setItem:(k,v)=>{save=[k,v]}}).write(game,{mode:'play',costume:'lotusrain'}));
      await page.addInitScript(([k,v])=>localStorage.setItem(k,v), save);
    }
    await page.addInitScript(observeRendering);
    if (quick) {
      const files = [...new Set([...first, hero, monsters])].join('|');
      await page.route(new RegExp('/assets/('+files+')\\.(webp|png)(?:\\?|$)'), async route => {
        await gate;
        await route.continue();
      });
    }
    await page.goto(url, {waitUntil:'domcontentloaded'});
    const button = page.locator(mobile ? '#continueRun' : scenario === 'combat' ? '#sandboxStart' : '#start');
    await button.waitFor();
    if (!quick) await page.evaluate(async () => {
      const {preloadArt} = await import('./asset-url.js');
      const {spriteImage} = await import('./sprite-art.js');
      const {costumeImage} = await import('./costumes.js');
      const ready = await Promise.all([spriteImage('rooms-bright-v1.png'), costumeImage('original')].map(preloadArt));
      if (!ready.every(Boolean)) throw Error('Failed to warm first room');
    });
    await page.evaluate(names => { window.auditSheets=names; }, first);
    await button.click();
    await page.evaluate(async () => {
      window.entryGame = (await import(document.querySelector('script[type="module"][src*="game.js"]').src)).game;
    });
    await waitForSheets(first, quick ? 'preview' : 'assets');
    let current = first;
    if (scenario === 'combat') {
      await page.locator('#sandboxTools').click();
      await page.locator('button[data-sandbox="room"][data-value="fight"]').first().click();
      current = [...first, monsters];
      await waitForSheets(current, 'preview');
      await page.evaluate(names => {window.auditSheets=names}, current);
    }
    const before = await page.evaluate(() => ({x:entryGame.p.x, id:entryGame.roomId, run:entryGame.codexRunId}));
    await page.keyboard.down('d');
    try { await page.waitForFunction(x => window.entryGame.p.x > x + 6, before.x); }
    finally { await page.keyboard.up('d'); }
    await page.keyboard.down('ArrowRight');
    try { await page.waitForFunction(() => window.entryGame.bullets.length > 0); }
    finally { await page.keyboard.up('ArrowRight'); }
    await page.waitForFunction(() => window.entryGame.elapsed > 2 && window.frameAudit.visible >= 20);
    const lowFrames = await page.evaluate(() => window.frameAudit.visible);
    if (quick) await waitForSheets(current, 'preview');
    release();
    await waitForSheets(current, 'assets');
    await page.waitForFunction(n => window.frameAudit.visible >= n + 12, lowFrames);
    const result = await page.evaluate(() => ({...window.frameAudit, id:entryGame.roomId, run:entryGame.codexRunId}));
    assert.equal(result.id, before.id);
    assert.equal(result.run, before.run);
    assert.equal(result.missing, 0, 'visible frames missing a required original sprite');
    assert.equal(result.notices, 0, 'ordinary loads should stay silent');
    assert.deepEqual(errors, []);
    console.log(scenario, {frames:result.visible, beforeUpgrade:quick?lowFrames:0, missing:result.missing, notices:result.notices});
  } finally {
    release();
    await page.close();
  }
}
async function main() {
  const [url, ...requested] = process.argv.slice(2);
  if (!url) throw Error('Pass the URL of the running game.');
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH, chromiumSandbox:true});
  try {
    for (const name of requested.length ? requested : ['warm','start','combat','continue']) await run(browser,url,name);
  } finally { await browser.close(); }
}
main().catch(error => {console.error(error);process.exitCode=1});
