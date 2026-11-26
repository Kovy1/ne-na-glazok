/* «Начать заново» в общей базе: технолог очищает ТТК и цены -> у редактора они исчезают; база сырья остаётся. Было в pwdel: технолог удаляет сырьё и ТТК и публикует -> у редактора и шеф-повара они исчезают; у технолога не возвращаются;
   редактор предлагает удаление -> технолог принимает -> исчезает у всех; возврат через журнал */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const TT = require('./tt');
const path = require('path'), assert = require('assert');
const { startGas } = require('./sync/gasserver');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SRC = process.argv[2] || 'kbzhu.html';
const errs = [];
const REF = { label: '', p: null, f: null, c: null, kcal: null, tol: 10, basis: '100' };
const rowOk = (rid, ing, net) => ({ rid, ing, net, share: 100 });
const seed = () => ({
  ings: {
    i2: { name: 'Говядина облачная', p: 18, f: 12, c: 0, kind: 'table', source: '', price: 500 },
    i3: { name: 'Картофель', p: 2, f: 0.4, c: 16, kind: 'table', source: '', price: 30 },
    i5: { name: 'Свёкла', p: 1.5, f: 0.1, c: 8.8, kind: 'table', source: '' },
    i6: { name: 'Лук репчатый', p: 1.4, f: 0, c: 10, kind: 'table', source: '' },
    i7: { name: 'Соль', p: 0, f: 0, c: 0, kind: 'table', source: '' },
  },
  recipes: {
    r1: { name: 'Котлета тест', output: 150, rows: [rowOk('a', 'i2', 100), rowOk('b', 'i3', 50)], ref: REF, ttk: {}, sell: { main: 120 } },
    r2: { name: 'Пюре тест', output: 200, rows: [rowOk('c', 'i3', 180)], ref: REF, ttk: {}, sell: { main: 60 } },
    r3: { name: 'Щи тест', output: 300, rows: [rowOk('d', 'i6', 80)], ref: REF, ttk: {}, sell: { main: 90 } },
  },
  cfg: {},
});
(async () => {
  const gs = await startGas();
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve(SRC);
  const mk = async (name, data, tab = 'sync') => {
    const ctx = await browser.newContext({ viewport: { width: 1250, height: 1000 }, acceptDownloads: true }); const page = await ctx.newPage();
    page.on('pageerror', e => { if (!/Unexpected token '<'/.test(e.message)) errs.push(name + ': ' + e.message); });
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|net::ERR|Refused to execute/.test(m.text())) errs.push(name + ' console: ' + m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(url);
    await page.evaluate(([d, tab]) => { localStorage.clear(); if (d) localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:tab', tab); }, [data, tab]);
    await page.reload(); await page.waitForSelector('#view > *');
    return page;
  };
  const connect = async (page, name, code) => {
    await page.click('#tabSync'); await page.waitForSelector('#syConn');
    await page.fill('#sy-url', gs.url); await page.fill('#sy-name', name); await page.fill('#sy-code', code);
    await page.click('[data-act="syConnect"]');
    await page.waitForFunction(() => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && !/Проверяю|Читаю/.test(e.textContent); }, null, { timeout: 30000 });
  };
  const msg = async (page, key, re, t = 40000) => page.waitForFunction(([k, s]) => { const e = document.querySelector('#sym-' + k); return e && !e.hidden && new RegExp(s).test(e.textContent); }, [key, re.source], { timeout: t });
  const pullAll = async page => { await msg(page, 'pull', /Всё актуально|Получено|Применено|Нашёл изменения/); if (await page.locator('[data-act="syApply"]').count()) { await page.click('[data-act="syApply"]'); await sleep(600); } };
  const DB = async page => { await sleep(800); return page.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:v1'))); };
  const names = d => [Object.values(d.ings).map(x => x.name).sort(), Object.values(d.recipes).map(x => x.name).sort()];
  const dead = () => gs.gas.rows('Общая база').filter(r => String(r[6]) === '{"_del":1}').map(r => String(r[2])).sort();

  // ===== 1. технолог публикует, редактор получает
  const T = await mk('T', seed());
  await connect(T, 'Технолог', 'adm-5678'); await msg(T, 'pull', /Всё актуально|Получено/);
  await T.click('#sy-pub'); await msg(T, 'send', /Опубликовано: 8/); await sleep(1000);
  const E = await mk('E', { ings: {}, recipes: {}, cfg: {} });
  await connect(E, 'Мария', 'ed-1234'); await pullAll(E);
  assert.strictEqual(Object.keys((await DB(E)).recipes).length, 3);
  // редактору очистка недоступна
  await E.click('[data-act="cabSeg"][data-s="sys"]').catch(() => {});
  assert.strictEqual(await E.locator('#wipeCard').count(), 0, 'у редактора нет «Начать заново»');
  // ===== 2. технолог очищает ТТК и цены
  await T.click('[data-act="cabSeg"][data-s="sys"]'); await T.waitForSelector('#wipeCard');
  await T.click('[data-act="wpOpen"]');
  assert.ok(/из общей базы у всех/.test(await T.innerText('#wipeCard')));
  await T.click('[data-act="wpSel"][data-k="fc"]');
  const [dl] = await Promise.all([T.waitForEvent('download'), T.click('[data-act="wpSave"]')]);
  await T.fill('[data-act="wpWord"]', 'ОЧИСТИТЬ'); await T.click('[data-act="wpGo"]'); await sleep(1200);
  let dt = await DB(T); assert.strictEqual(Object.keys(dt.recipes).length, 0); assert.ok(!Object.values(dt.ings).some(x => x.price != null));
  await T.click('[data-act="cabSeg"][data-s="tasks"]'); await T.waitForSelector('#syMine'); await sleep(600);
  console.log(await T.textContent('#syMine h2'));
  await T.click('#sy-pub'); await msg(T, 'send', /Опубликовано/); await sleep(1500);
  console.log('метки в базе:', dead().join(', '));
  assert.deepStrictEqual(dead(), ['Котлета тест', 'Пюре тест', 'Щи тест']);
  // ===== 3. у редактора ТТК и цены исчезли, сырьё осталось
  await E.click('[data-act="cabSeg"][data-s="tasks"]').catch(() => {});
  await E.click('[data-act="syPull"]'); await sleep(2500); await pullAll(E);
  const de = await DB(E);
  console.log('E:', JSON.stringify(names(de)));
  assert.strictEqual(Object.keys(de.recipes).length, 0, 'ТТК удалены у редактора');
  assert.strictEqual(Object.keys(de.ings).length, 5, 'сырьё осталось');
  assert.ok(!Object.values(de.ings).some(x => x.price != null), 'цен нет у редактора');
  console.log('OK wipe2');
  if (errs.length) { console.log(errs); process.exit(1); }
  await browser.close(); gs.close && gs.close(); process.exit(0);
})();
