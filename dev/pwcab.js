/* Личный кабинет: разделы по ролям, без дублей, переключение */
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
    const ctx = await browser.newContext({ viewport: o.vp || { width: 1200, height: 1000 }, acceptDownloads: true }); await ctx.addInitScript(() => { window.__noSeg = 1; }); const page = await ctx.newPage();
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

  const segs = page => page.$$eval('#cab .segb', e => e.map(x => x.dataset.s));
  const dupIds = page => page.evaluate(() => { const m = {}; document.querySelectorAll('#view [id]').forEach(e => { m[e.id] = (m[e.id] || 0) + 1; }); return Object.keys(m).filter(k => m[k] > 1); });
  const curSeg = page => page.$$eval('#cab .cabseg:not([hidden])', e => e.map(x => x.dataset.seg));

  // 1. технолог
  const T = await mk('T', seed());
  await connect(T, { name: 'Технолог', code: A }); await msg(T, 'pull', /Всё актуально|Получено/); await sleep(500);
  await T.click('#tabSync'); await T.waitForSelector('#cab');
  const ts = await segs(T); console.log('технолог:', ts.join(','), 'открыт:', (await curSeg(T)).join(','));
  for (const k of ['tasks', 'admin', 'sys', 'prof']) assert.ok(ts.includes(k), 'у технолога есть раздел ' + k);
  assert.strictEqual((await curSeg(T)).length, 1, 'открыт ровно один раздел');
  assert.deepStrictEqual(await dupIds(T), [], 'нет повторяющихся id (блоки не дублируются)');
  await T.click('#cab .segb[data-s="admin"]'); await sleep(200);
  assert.deepStrictEqual(await curSeg(T), ['admin']); assert.ok(await T.isVisible('#syUsr'), 'пользователи в «Администрировании»');
  assert.strictEqual(await T.locator('#us-name').count(), 1);
  await T.click('#cab .segb[data-s="sys"]'); await sleep(200);
  assert.deepStrictEqual(await curSeg(T), ['sys']); assert.ok(!(await T.isVisible('#syUsr')), 'пользователи скрыты в «Настройках»');
  assert.ok(/Выпуск приложения/.test(await T.textContent('#cab .cabseg:not([hidden])')), 'выпуск в настройках системы');
  await T.click('#cab .segb[data-s="prof"]'); await sleep(200);
  assert.ok(/Подключено: технолог/.test(await T.textContent('#cab .cabseg:not([hidden])')), 'подключение и роль в профиле');
  // выбранный раздел помнится после перерисовки и перехода по вкладкам
  await T.click('#tabMenu'); await sleep(200); await T.click('#tabSync'); await sleep(300);
  assert.deepStrictEqual(await curSeg(T), ['prof'], 'раздел запомнен');
  console.log('1 OK: технолог — разделы, без дублей, переключение, запоминание');

  // 2. редактор: без администрирования и системных настроек
  const E1 = await mk('E', EMPTY());
  await connect(E1, { name: 'Редактор', code: E }); await msg(E1, 'pull', /Всё актуально|Получено|Применено|Нашёл/); await sleep(500);
  await E1.click('#tabSync'); await E1.waitForSelector('#cab');
  const es = await segs(E1); console.log('редактор:', es.join(','));
  assert.ok(!es.includes('admin'), 'редактору закрыто администрирование');
  await E1.click('#cab .segb[data-s="sys"]'); await sleep(150);
  assert.ok(!/Выпуск приложения/.test(await E1.textContent('#cab .cabseg:not([hidden])')), 'редактору не видны настройки выпуска'); assert.ok(es.includes('prof'));
  assert.strictEqual(await E1.locator('#us-name').count(), 0); assert.deepStrictEqual(await dupIds(E1), []);
  console.log('2 OK: редактор');

  // 3. шеф-повар
  const V1 = await mk('V', EMPTY());
  await connect(V1, { name: 'Шеф', code: V }); await msg(V1, 'pull', /Всё актуально|Получено|Применено|Нашёл/); await sleep(500);
  await V1.click('#tabSync'); await V1.waitForSelector('#cab');
  const vs = await segs(V1); console.log('шеф:', vs.join(','));
  assert.ok(!vs.includes('admin') && !vs.includes('review'), 'шефу закрыты администрирование и очередь проверки');
  for (const k of vs) { await V1.click('#cab .segb[data-s="'+k+'"]'); await sleep(100); console.log('  шеф', k, '→', (await V1.textContent('#cab .cabseg:not([hidden])')).replace(/\s+/g,' ').slice(0,120)); assert.ok(!/Выпуск приложения|Пользователи и коды/.test(await V1.textContent('#cab .cabseg:not([hidden])')), 'шефу закрыты админ-блоки'); } assert.ok(vs.includes('prof'));
  console.log('3 OK: шеф-повар');

  // 4. телефон: нет горизонтальной прокрутки, кнопки разделов в пределах экрана
  await T.setViewportSize({ width: 390, height: 844 }); await sleep(300);
  await T.evaluate(() => document.getElementById('tabSync').click()); await sleep(300);
  const over = await T.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(over <= 1, 'горизонтальная прокрутка: ' + over);
  await T.screenshot({ path: 'out/shot_cab_mobile.png' });
  await T.setViewportSize({ width: 1440, height: 900 }); await sleep(300); await T.screenshot({ path: 'out/shot_cab_desktop.png' });
  console.log('4 OK: телефон и компьютер');

  assert.deepStrictEqual(errs, [], 'ошибки страниц: ' + errs.join('; '));
  console.log('PWCAB OK'); await browser.close(); gs.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
