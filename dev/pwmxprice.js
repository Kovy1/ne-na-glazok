/* «Объединить сырьё» доступно и в подменю «Цены и динамика» (сюда ведут «Заполнить цены» и загрузки цен, выбор запоминается),
   у кодов, кроме технолога, вместо блока — пояснение */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert');
const { startGas } = require('./sync/gasserver');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SRC = process.argv[2] || 'kbzhu.html';
const errs = [];
const ref = { label: '', p: null, f: null, c: null, kcal: null, tol: 10, basis: '100' };
const seed = () => ({
  ings: {
    a: { name: 'Мука пшеничная в/с', p: 10, f: 1, c: 68, kind: 'table', source: '', price: 50, px: { msk: { price: 70 } } },
    b: { name: 'Мука пшеничная высшего сорта', p: 10, f: 1, c: 68, kind: 'table', source: '', price: 60 },
    c: { name: 'Соль', p: 0, f: 0, c: 0, kind: 'table', source: '' },
  },
  recipes: { r1: { name: 'Хлеб', output: 100, rows: [{ rid: 'x', ing: 'b', net: 100, share: 100 }, { rid: 'y', ing: 'c', net: 2, share: 100 }], ref } },
  cfg: {}
});
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve(SRC);
  const mk = async (name, ls) => {
    const page = await (await browser.newContext({ viewport: { width: 1200, height: 1000 } })).newPage();
    page.on('pageerror', e => { if (!/Unexpected token '<'/.test(e.message)) errs.push(name + ': ' + e.message); });
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|net::ERR|Refused to execute/.test(m.text())) errs.push(name + ' console: ' + m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(url);
    await page.evaluate(([d, ls]) => { localStorage.clear(); Object.keys(ls).forEach(k => localStorage.setItem(k, ls[k])); localStorage.setItem('kbzhu:v1', JSON.stringify(d)); }, [seed(), ls]);
    await page.reload(); await page.waitForSelector('#view > *');
    return page;
  };
  const txt = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; }, sel);
  const sub = async (page, k) => { await page.click('[data-act="bsub"][data-k="' + k + '"]'); await sleep(300); };

  // 1. без общей базы: блок есть в обоих подменю; объединяем из «Цен и динамики»
  const P = await mk('P', { 'kbzhu:tab': 'base', 'kbzhu:bsub': 'price', 'kbzhu:sync': JSON.stringify({ cfg: { pubDocs: false } }) });
  await P.waitForSelector('.prow[data-iid]');
  assert.strictEqual(await P.locator('#mxBox').count(), 1, 'в «Цены и динамика» есть блок объединения');
  assert.ok(/Объединить сырьё/.test(await txt(P, '#mxBox > summary')));
  assert.strictEqual(await P.locator('#mxNote').count(), 0, 'пояснения нет, раз блок есть');
  await P.click('#mxBox > summary'); await P.waitForSelector('#mxBox [data-act="mxKeep"]');
  const pick = async (act, text) => { const el = P.locator('#mxBox [data-act="' + act + '"]').first(); await el.fill(text); await el.dispatchEvent('change'); await sleep(150); };
  await pick('mxKeep', 'Мука пшеничная в/с'); await pick('mxAdd', 'Мука пшеничная высшего сорта');
  assert.ok(/Волгоград — 60,00/.test(await txt(P, '#mxBox')), 'предпросмотр цены: ' + await txt(P, '#mxBox'));
  await P.click('#mxBox [data-act="mxGo"]'); await P.click('#mxBox [data-act="mxGo"]'); await sleep(1500);
  const db = await P.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:v1')));
  assert.deepStrictEqual(Object.values(db.ings).map(i => i.name).sort(), ['Мука пшеничная в/с', 'Соль']);
  assert.strictEqual(db.ings.a.price, 60); assert.strictEqual(db.ings.a.px.msk.price, 70); assert.strictEqual(db.recipes.r1.rows[0].ing, 'a');
  assert.strictEqual(await P.locator('.prow[data-iid]').count(), 2, 'список цен обновился');
  await sub(P, 'kbzhu'); assert.strictEqual(await P.locator('#mxBox').count(), 1, 'и в «КБЖУ и потери» блок на месте');
  // другие виды подменю «Цены» блок не показывают
  await sub(P, 'price');
  for (const v of ['an', 'obj', 'tbl']) { if (!(await P.locator('[data-act="pview"][data-k="' + v + '"]').count())) continue; await P.click('[data-act="pview"][data-k="' + v + '"]'); await sleep(400); assert.strictEqual(await P.locator('#mxBox').count(), 1, 'блок объединения виден и в виде «' + v + '»'); }
  console.log('1 OK: объединение из подменю «Цены и динамика»');
  await P.context().close();

  // 2. с общей базой: у технолога блок в обоих подменю, у остальных — пояснение
  const gs = await startGas();
  const codes = { admin: 'adm-5678', editor: 'ed-1234', viewer: 'view-3456' };
  for (const role of Object.keys(codes)) {
    const p = await mk(role, { 'kbzhu:tab': 'sync' });
    await p.waitForSelector('#syConn');
    await p.fill('#sy-url', gs.url); await p.fill('#sy-name', 'Тест'); await p.fill('#sy-code', codes[role]);
    await p.click('[data-act="syConnect"]');
    await p.waitForFunction(() => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && !/Проверяю|Читаю/.test(e.textContent); }, null, { timeout: 20000 });
    await sleep(1500); await p.click('#tabBase'); await sleep(400);
    for (const k of ['kbzhu', 'price']) {
      await sub(p, k);
      const has = await p.locator('#mxBox').count(), note = await p.locator('#mxNote').count();
      if (role === 'admin') { assert.strictEqual(has, 1, 'технолог: блок в подменю ' + k); assert.strictEqual(note, 0); }
      else { assert.strictEqual(has, 0, role + ': блока нет в подменю ' + k); assert.strictEqual(note, 1, role + ': есть пояснение в подменю ' + k); assert.ok(/может технолог/.test(await txt(p, '#mxNote'))); }
    }
    await p.context().close();
  }
  console.log('2 OK: технолог — блок, остальные — пояснение');
  console.log('ERR', errs); assert.deepStrictEqual(errs, []);
  await browser.close(); console.log('PWMXPRICE OK'); process.exit(0);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
