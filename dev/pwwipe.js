/* «Начать заново»: копия скачивается до очистки, без копии и слова кнопка недоступна; удаляются ТТК, цены с историей и отчёты фудкоста, база сырья остаётся */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert'), fs = require('fs');
const SRC = process.argv[2] || 'kbzhu.html';
const errs = [];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + path.resolve(SRC));
  const d = { ings: { i1: { name: 'Лук', p: 1, f: 0, c: 8, kind: 'table', source: 'справочник', price: 40, priceSrc: '1С', px: { msk: { price: 50 } }, aliases: ['лук репчатый свеж'] }, i2: { name: 'Соль', p: 0, f: 0, c: 0, kind: 'table', source: 'справочник' } },
    recipes: { r1: { name: 'Суп', output: 250, rows: [{ rid: 'a', ing: 'i1', net: 20, share: 100 }], sell: { main: 120 } }, r2: { name: 'Салат', output: 150, rows: [] } },
    cfg: { ph_main_20260901_20260930: { region: 'main', from: '2026-09-01', to: '2026-09-30', at: 1, rule: 'avg', sup: ['x'], it: [{ ing: 'i1', nm: 'Лук', pr: 40, ln: [['2026-09-04', 0, 40, 10]] }] } } };
  await page.evaluate(d => { localStorage.clear(); localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:tab', 'sync'); localStorage.setItem('kbzhu:whatsnew', '999'); }, d);
  await page.reload();
  // отчёт фудкоста
  await page.waitForFunction(() => window.kbzhuFc && window.kbzhuFc.load);
  await page.evaluate(() => kbzhuFc.load().then(() => { const S = kbzhuFc.S; S.fc.batches.b1 = { id: 'b1', type: 'receipts', obj: 'o1', objName: 'Т', from: '2026-09-01', to: '2026-09-30', file: 'т' }; S.fc.ops.receipts = { k1: { b: 'b1', obj: 'o1', nm: 'Лук', q: 1, s: 40, d: '2026-09-04' } }; kbzhuFc.put('ops'); kbzhuFc.put('batches'); }));
  await page.waitForSelector('#wipeCard');
  await page.click('[data-act="wpOpen"]');
  await page.waitForFunction(() => /Отчёты фудкоста: 1 загр/.test(document.querySelector('#wipeCard').innerText));
  const t = await page.innerText('#wipeCard');
  assert.ok(/ТТК и блюда меню: 2/.test(t) && /Закупочные цены сырья: 1 поз., история цен: 1/.test(t), t);
  assert.ok(await page.$eval('[data-act="wpGo"]', b => b.disabled), 'без копии кнопка недоступна');
  assert.ok(await page.$eval('[data-act="wpWord"]', b => b.disabled), 'слово вводится после копии');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="wpSave"]')]);
  const bk = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  assert.ok(bk.recipes.r1 && bk.ings.i1.price === 40 && bk.cfg.ph_main_20260901_20260930 && bk.fc.batches.b1, 'в копии всё, что удаляется');
  await page.fill('[data-act="wpWord"]', 'очистит');
  assert.ok(await page.$eval('[data-act="wpGo"]', b => b.disabled), 'неверное слово');
  await page.fill('[data-act="wpWord"]', 'очистить');
  assert.ok(!(await page.$eval('[data-act="wpGo"]', b => b.disabled)));
  await page.click('[data-act="wpGo"]');
  await page.waitForFunction(() => !document.querySelector('#wipeCard .wsteps'));
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForFunction(() => window.kbzhuFc && window.kbzhuFc.load);
  const r = await page.evaluate(() => kbzhuFc.load().then(() => { const S = kbzhuWipe.S; return { rec: Object.keys(S.recipes).length, ings: Object.keys(S.ings).length, pr: S.ings.i1.price, px: !!S.ings.i1.px, al: S.ings.i1.aliases, ph: Object.keys(S.cfg).filter(k => /^ph_/.test(k)).length, fc: Object.keys(kbzhuFc.S.fc.batches).length, ops: Object.keys(kbzhuFc.S.fc.ops.receipts || {}).length }; }));
  assert.deepStrictEqual(r, { rec: 0, ings: 2, pr: undefined, px: false, al: ['лук репчатый свеж'], ph: 0, fc: 0, ops: 0 }, JSON.stringify(r));
  console.log('OK wipe');
  if (errs.length) { console.log(errs); process.exit(1); }
  await browser.close();
})();
