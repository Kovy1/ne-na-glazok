/* полуфабрикаты в общей базе: ссылка на карту-полуфабрикат уходит как sid и находится на другом устройстве (в том числе когда карта пришла позже) */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert');
const { startGas } = require('./sync/gasserver');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SRC = process.argv[2] || 'kbzhu.html';
const errs = [];
const ings = () => ({
  i2: { name: 'Майонез облачный', p: 2, f: 67, c: 3, kind: 'table', source: '', price: 300 },
  i3: { name: 'Горчица облачная', p: 5, f: 6, c: 4, kind: 'table', source: '', price: 200 },
  i5: { name: 'Помидор облачный', p: 1, f: 0.2, c: 4, kind: 'table', source: '', price: 150 },
});
const ref = { label: '', p: null, f: null, c: null, kcal: null, tol: 10, basis: '100' };
const full = () => ({
  ings: ings(),
  recipes: {
    rP: { name: 'Соус облачный', output: 100, pf: true, rows: [{ rid: 'a', ing: 'i2', net: 80, share: 100 }, { rid: 'b', ing: 'i3', net: 20, share: 100 }], ref, ttk: { num: '1458' } },
    rH: { name: 'Салат облачный', output: 200, rows: [{ rid: 'c', ing: 'i5', net: 40, share: 100 }, { rid: 'p1', ing: '', pf: 'rP', net: 50, share: 100 }], ref, ttk: {} },
  },
  menu: { cats: [] },
});
(async () => {
  const gs = await startGas();
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve(SRC);
  const mk = async (name, data) => {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } }); const page = await ctx.newPage();
    page.on('pageerror', e => { if (!/Unexpected token '<'/.test(e.message)) errs.push(name + ': ' + e.message); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(url);
    await page.evaluate(([d]) => { localStorage.clear(); localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:tab', 'sync'); }, [data]);
    await page.reload(); await page.waitForSelector('#syConn');
    return page;
  };
  const connect = async (page, { name, code }) => {
    await page.fill('#sy-url', gs.url); await page.fill('#sy-name', name); await page.fill('#sy-code', code || '');
    await page.click('[data-act="syConnect"]');
    await page.waitForFunction(() => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && !/Проверяю/.test(e.textContent); }, null, { timeout: 20000 });
    return page.textContent('#sym-conn');
  };
  const msg = async (page, key, re, t = 25000) => { await page.waitForFunction(([k, s]) => { const e = document.querySelector('#sym-' + k); return e && !e.hidden && new RegExp(s).test(e.textContent); }, [key, re.source], { timeout: t }); };
  const DB = async page => { await sleep(900); return page.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:v1'))); };
  const A = 'adm-5678';

  /* 1. технолог публикует карту и полуфабрикат */
  const B = await mk('B', full());
  let t = await connect(B, { name: 'Технолог', code: A }); assert.ok(/Подключено: технолог/.test(t), t);
  await B.waitForSelector('#syMine'); await msg(B, 'pull', /Всё актуально/);
  await B.fill('#sy-note', 'ПФ'); await B.click('#sy-pub'); await msg(B, 'send', /Опубликовано: 5/); await sleep(1200);
  const shared = gs.gas.rows('Общая база');
  assert.strictEqual(shared.length, 5, 'сырьё 3 + 2 ТТК');
  const js = shared.map(r => { try { return JSON.parse(r[6]); } catch (e) { return null; } }).filter(Boolean);
  const host = js.filter(j => j.name === 'Салат облачный')[0], pf = js.filter(j => j.name === 'Соус облачный')[0];
  assert.ok(host && pf, 'обе ТТК в общей базе');
  assert.strictEqual(pf.pf, true, 'признак полуфабриката уходит в общую базу');
  const prow = host.rows.filter(x => x.pf)[0];
  assert.ok(prow && /^r/.test(prow.pf) && prow.pfn === 'Соус облачный' && !prow.ing, 'строка-полуфабрикат ссылается на sid карты: ' + JSON.stringify(prow));
  const pfSid = shared.filter(r => r[2] === 'Соус облачный')[0][0];
  assert.strictEqual(prow.pf, pfSid, 'ссылка = sid карты-полуфабриката');
  console.log('1 OK');

  /* 2. другое устройство получает обе карты: ссылка находится даже при любом порядке применения */
  const C = await mk('C', { ings: ings(), recipes: {}, menu: { cats: [] } });
  t = await connect(C, { name: 'Технолог 2', code: A }); assert.ok(/Подключено/.test(t), t);
  await msg(C, 'pull', /Всё актуально|Получено|Применено|Новое|Можно/).catch(() => {});
  if (await C.locator('[data-act="syPull"]').count()) { await C.click('[data-act="syPull"]'); await sleep(800); }
  if (await C.locator('[data-act="syApply"]').count()) { await C.click('[data-act="syApply"]'); await sleep(1200); }
  const dbC = await DB(C);
  const rc = Object.keys(dbC.recipes).map(k => ({ id: k, r: dbC.recipes[k] }));
  const h2 = rc.filter(x => x.r.name === 'Салат облачный')[0], p2 = rc.filter(x => x.r.name === 'Соус облачный')[0];
  assert.ok(h2 && p2, 'на втором устройстве есть обе ТТК: ' + rc.map(x => x.r.name).join(', '));
  const r2 = h2.r.rows.filter(x => x.pf || x.pfs)[0];
  assert.ok(r2 && r2.pf === p2.id && !r2.pfs, 'строка-полуфабрикат привязана к локальной карте: ' + JSON.stringify(r2));
  assert.strictEqual(p2.r.pf, true);
  /* карта считается: открываем и смотрим раскрытие */
  await C.evaluate(id => { localStorage.setItem('kbzhu:active', id); localStorage.setItem('kbzhu:tab', 'calc'); }, h2.id);
  await C.reload(); await C.waitForSelector('.pfsub');
  assert.ok(/Состав из Соус облачный ТТК№1458/.test(await C.textContent('.pfsub')), 'на втором устройстве состав раскрывается');
  assert.ok(await C.locator('.pfsub.bad').count() === 0, 'ссылка не битая');
  console.log('2 OK');
  assert.deepStrictEqual(errs, []);
  console.log('PWPFSYNC OK');
  await browser.close(); gs.close && gs.close();
})().catch(e => { console.error(e); process.exit(1); });
