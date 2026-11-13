/* Главная по ролям */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const TT = require('./tt');
const path = require('path'), assert = require('assert'), fs = require('fs'), vm = require('vm');
const { startGas } = require('./sync/gasserver');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SRC = process.argv[2] || 'out/КБЖУ_калькулятор_автономный.html';
const errs = [];
const ref = { label: '', p: null, f: null, c: null, kcal: null, tol: 10, basis: '100' };
const rowOk = (rid, ing, net) => ({ rid, ing, net, share: 100 });
const SEEDREC = 'Котлета мясная 1/100 г (ТТК №14)';      // готовая карта, вшитая в файл
const EMPTY = () => ({ ings: {}, recipes: {}, cfg: {} });
const seed = () => ({
  ings: {
    i2: { name: 'Говядина облачная', p: 18, f: 12, c: 0, kind: 'table', source: '', price: 500 },
    i3: { name: 'Картофель', p: 2, f: 0.4, c: 16, kind: 'table', source: '', price: 30 },
  },
  recipes: {
    r1: { name: 'Котлета готовая', output: 150, rows: [rowOk('a', 'i2', 100), rowOk('b', 'i3', 50)], ref, ttk: { num: '7' }, sell: { main: 700 } },
    r2: { name: 'Пюре готовое', output: 200, rows: [rowOk('a', 'i3', 200)], ref, ttk: { num: '8' }, sell: { main: 120 } },
    r3: { name: 'Борщ не сопоставлен', output: 300, rows: [rowOk('a', 'i3', 100), { rid: 'b', ing: null, in: 'Свёкла', net: 80, share: 100 }], ref, ttk: { num: '9' } },
    r4: { name: 'Гуляш без выхода', output: 0, rows: [rowOk('a', 'i2', 100)], ref, ttk: { num: '10' } },
    r5: { name: 'Пустая карта', output: 100, rows: [], ref, ttk: { num: '11' } },
  },
  cfg: {},
});
(async () => {
  const gs = await startGas();
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve(SRC);
  const E = 'ed-1234', A = 'adm-5678', F = 'fin-9012', V = 'view-3456';
  const mk = async (name, data, o = {}) => {
    const ctx = await browser.newContext({ viewport: o.vp || { width: 1200, height: 1000 }, acceptDownloads: true }); const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(name + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|net::ERR|Refused to execute/.test(m.text())) errs.push(name + ' console: ' + m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(url);
    await page.evaluate(([d, tab]) => { localStorage.clear(); if (d) localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:tab', tab); localStorage.setItem('kbzhu:sync', JSON.stringify({ cfg: { pubDocs: false } })); }, [data, o.tab || 'sync']);
    await page.reload(); await page.waitForSelector('#view > *');
    return page;
  };
  const connect = async (page, { name, code }) => {
    await page.click('#tabSync'); await page.waitForSelector('#syConn');
    await page.fill('#sy-url', gs.url); await page.fill('#sy-name', name); await page.fill('#sy-code', code);
    await page.click('[data-act="syConnect"]');
    await page.waitForFunction(() => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && !/Проверяю|Читаю/.test(e.textContent); }, null, { timeout: 30000 });
    return page.textContent('#sym-conn');
  };
  const msg = async (page, key, re, t = 60000) => page.waitForFunction(([k, s]) => { const e = document.querySelector('#sym-' + k); return e && !e.hidden && new RegExp(s).test(e.textContent); }, [key, re.source], { timeout: t });
  const pullAll = async page => { await msg(page, 'pull', /Всё актуально|Получено|Применено|Нашёл изменения/); if (await page.locator('[data-act="syApply"]').count()) { await page.click('[data-act="syApply"]'); await sleep(500); } };
  const tab = async (page, id) => { if (id === 'tabCloud') { await page.click('#tabCalc'); if (await page.locator('#tabCloud').count()) await page.click('#tabCloud'); } else if (id === 'tabCalc') await TT.openCalc(page); else await page.click('#' + id); await sleep(200); };
  const vis = (page, sel) => page.isVisible(sel);
  const dishes = page => page.$$eval('.mrow[data-rid] .mn b', e => e.map(x => x.textContent));

  const home = async page => { await page.click('#tabHome'); await sleep(300); };
  const tiles = page => page.$$eval('.hmrole .hmtask', e => e.map(x => x.querySelector('span').textContent.trim() + '=' + x.querySelector('b').textContent));
  const nth = async (page, re) => { const l = (await tiles(page)).find(x => re.test(x)); return l ? Number(l.split('=').pop()) : null; };

  const T = await mk('T', seed());
  await connect(T, { name: 'Технолог', code: A }); await msg(T, 'pull', /Всё актуально|Получено/);
  await T.click('#sy-pub'); await msg(T, 'send', /Опубликовано: 7/); await sleep(800);
  await home(T);
  console.log('технолог:', (await tiles(T)).join(' | '));
  assert.ok(await T.isVisible('.hmrole'), 'у технолога блок согласования');
  assert.strictEqual(await nth(T, /Ждут проверки/), 0);

  // редактор приносит новое блюдо с новым сырьём: черновики → отправка → очередь у технолога
  const seedE = seed(); seedE.ings.i9 = { name: 'Редис тестовый', p: 1, f: 0, c: 3, kind: 'table', source: '', price: 90 };
  seedE.recipes.r9 = { name: 'Салат новый', output: 100, rows: [rowOk('a', 'i9', 100)], ref, ttk: { num: '12' } };
  const E1 = await mk('E', seedE);
  await connect(E1, { name: 'Иванов Иван', code: E }); await msg(E1, 'pull', /Всё актуально|Получено|Применено|Нашёл/); await sleep(600);
  await home(E1);
  console.log('редактор до отправки:', (await tiles(E1)).join(' | '));
  assert.ok(await E1.isVisible('.hmrole'), 'у редактора блок «Мои ТТК»'); assert.ok(!/Согласование/.test(await E1.textContent('.hmrole h3')));
  const dr = await nth(E1, /Черновики/); assert.ok(dr >= 1, 'черновики видны на главной: ' + dr);
  await E1.click('.hmrole .hmtask.has button'); await sleep(300);
  assert.strictEqual(await E1.getAttribute('#cab .segb[aria-selected="true"]', 'data-s'), 'tasks', 'кнопка ведёт в «Мои задачи»');
  await E1.fill('#sy-note', 'новый салат'); await E1.click('#sy-send'); await msg(E1, 'send', /Отправлено на проверку технологу/); await sleep(900);
  await home(E1);
  console.log('редактор после отправки:', (await tiles(E1)).join(' | '));
  assert.strictEqual(await nth(E1, /Черновики/), 0, 'черновиков не осталось'); assert.ok((await nth(E1, /Отправлено/)) >= 1, 'отправленное ждёт решения');
  await T.click('#tabSync'); await T.waitForSelector('#cab'); await T.click('[data-act="syRefresh"]'); await sleep(1200);
  await home(T);
  console.log('технолог после отправки:', (await tiles(T)).join(' | '));
  assert.ok((await nth(T, /Ждут проверки/)) >= 1, 'у технолога очередь появилась на главной');
  await T.click('.hmrole .hmtask.has button'); await sleep(300);
  assert.strictEqual(await T.getAttribute('#cab .segb[aria-selected="true"]', 'data-s'), 'review', 'кнопка ведёт в «На проверке»');
  assert.ok(await T.isVisible('#syPend'));
  console.log('1 OK: технолог и редактор, очередь согласования');

  // шеф-повар: меню и ТТК, финансовых показателей нет
  const V1 = await mk('V', EMPTY());
  await connect(V1, { name: 'Шеф', code: V }); await msg(V1, 'pull', /Всё актуально|Получено|Применено|Нашёл/); await sleep(600);
  await home(V1);
  const vt = await tiles(V1); console.log('шеф:', vt.join(' | '));
  assert.ok(/ТТК в меню/.test(vt[0]) && vt.length === 3);
  const body = await V1.textContent('section.hm');
  assert.ok(!/Выручка|Фудкост|ABC|Состав продаж/.test(body), 'шеф не видит финансовые показатели на главной: ' + body.slice(0, 200));
  console.log('2 OK: шеф-повар');

  // телефон
  await T.setViewportSize({ width: 390, height: 844 }); await home(T); await sleep(300);
  const over = await T.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(over <= 1, 'горизонтальная прокрутка: ' + over);
  await T.screenshot({ path: 'out/shot_home_admin_mobile.png' });
  await T.setViewportSize({ width: 1440, height: 900 }); await home(T); await T.screenshot({ path: 'out/shot_home_admin.png' });
  await E1.setViewportSize({ width: 1440, height: 900 }); await home(E1); await E1.screenshot({ path: 'out/shot_home_editor.png' });
  await V1.setViewportSize({ width: 1440, height: 900 }); await home(V1); await V1.screenshot({ path: 'out/shot_home_chef.png' });
  console.log('3 OK: телефон и компьютер');

  assert.deepStrictEqual(errs, [], 'ошибки страниц: ' + errs.join('; '));
  console.log('PWHOMEROLE OK'); await browser.close(); gs.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
