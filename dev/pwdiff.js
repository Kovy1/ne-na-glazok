/* страница изменений для технолога: «было → стало» с подсветкой, переход с плашки, подсветка строк в карте */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const TT = require('./tt');
const path = require('path'), assert = require('assert'), vm = require('vm');
const { startGas } = require('./sync/gasserver');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SRC = process.argv[2] || 'kbzhu.html';
const errs = [];
const ref = { label: '', p: null, f: null, c: null, kcal: null, tol: 10, basis: '100' };
const rowOk = (rid, ing, net) => ({ rid, ing, net, share: 100 });
const seed = () => ({
  ings: {
    i2: { name: 'Говядина облачная', p: 18, f: 12, c: 0, kind: 'table', source: '', price: 500 },
    i3: { name: 'Картофель', p: 2, f: 0.4, c: 16, kind: 'table', source: '', price: 30 },
  },
  recipes: {
    r1: { name: 'Пюре готовое', output: 200, rows: [rowOk('a', 'i3', 200)], ref, ttk: { num: '8' }, sell: { main: 120 } },
    r2: { name: 'Котлета тестовая', output: 100, rows: [rowOk('b', 'i2', 100)], ref, ttk: { num: '9' }, sell: { main: 200 } },
  },
  cfg: {},
});
(async () => {
  const gs = await startGas();
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve(SRC);
  const E = 'ed-1234', A = 'adm-5678';
  const mk = async (name, data, o = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 1100 } }); const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(name + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|net::ERR|Refused to execute/.test(m.text())) errs.push(name + ' console: ' + m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(url);
    await page.evaluate(([d, tab]) => { localStorage.clear(); if (d) localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:tab', tab); }, [data, o.tab || 'sync']);
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
  const msg = async (page, key, re, t = 40000) => page.waitForFunction(([k, s]) => { const e = document.querySelector('#sym-' + k); return e && !e.hidden && new RegExp(s).test(e.textContent); }, [key, re.source], { timeout: t });
  const tab = async (page, id) => { if (id === 'tabCalc') await TT.openCalc(page); else await page.click('#' + id); await sleep(300); };
  const txt = async (page, sel) => (await page.evaluate(s => { const e = document.querySelector(s); return e && !e.hidden ? e.textContent.replace(/\s+/g, ' ').trim() : ''; }, sel));
  const waitTxt = async (page, sel, re, t = 25000) => { const t0 = Date.now(); let b = ''; while (Date.now() - t0 < t) { b = await txt(page, sel); if (re.test(b)) return b; await sleep(400); } throw new Error('нет ' + re + ' в ' + sel + ': «' + b + '»'); };
  const db = async page => { await sleep(900); return page.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:v1'))); };
  const pickRec = async (page, re) => { await TT.pickRecipe(page, re.source); };
  const pullAll = async page => { await page.click('[data-act="syPull"]'); await msg(page, 'pull', /Всё актуально|Получено|Применено|Нашёл изменения/); if (await page.locator('[data-act="syApply"]').count()) { await page.click('[data-act="syApply"]'); await sleep(500); } };
  const srv = (a, extra) => gs.gas.parseOut(gs.gas.get(Object.assign({ a, code: A }, extra || {}))).data;
  const editNet = async (page, v) => { await page.fill('.nt input[data-act="rowNet"] >> nth=0', String(v)); await page.dispatchEvent('.nt input[data-act="rowNet"] >> nth=0', 'change'); await sleep(900); };

  vm.runInContext('setup()', gs.gas.ctx);


  // ===== 1. технолог публикует обе ТТК, редактор получает и правит «Пюре»: цена продажи, количество, новая строка, текст, выход
  const T = await mk('T', seed(), { tab: 'calc' });
  console.log('T:', await connect(T, { name: 'Технолог', code: A }));
  await sleep(1500);
  await tab(T, 'tabSync'); await T.waitForSelector('#syMine');
  for (const nm of ['Пюре готовое', 'Котлета тестовая']) {
    await T.locator('#syMine .syrow', { hasText: nm }).locator('[data-act="syOne"]').click();
    await msg(T, 'send', /Опубликовано: /, 30000); await sleep(1500);
  }
  assert.strictEqual(srv('pull', { since: '0' }).items.filter(x => x.kind === 'rec').length, 2, 'обе ТТК в базе');

  const Ed = await mk('E', { ings: {}, recipes: {}, cfg: {} });
  console.log('E:', await connect(Ed, { name: 'Кузя', code: E }));
  await pullAll(Ed); await sleep(800);
  await Ed.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('kbzhu:v1'));
    const id = Object.keys(d.recipes).find(k => /Пюре/.test(d.recipes[k].name)), r = d.recipes[id];
    const beef = Object.keys(d.ings).find(k => /Говядина/.test(d.ings[k].name));
    r.rows[0].net = 250; r.rows.push({ rid: 'zz', ing: beef, net: 50, share: 100 }); r.rows.push({ rid: 'sk', ing: '', skip: true, net: 5, share: 100, tname: 'Соль' });
    r.sell = Object.assign({}, r.sell, { main: 150 }); r.output = 300;
    r.ttk = Object.assign({}, r.ttk, { t42: 'Отварить картофель\nПротереть\nДобавить масло' });
    localStorage.setItem('kbzhu:v1', JSON.stringify(d));
  });
  await Ed.reload(); await Ed.waitForSelector('#view > *'); await sleep(2500);
  await tab(Ed, 'tabSync'); await Ed.waitForSelector('#syMine');
  const mineTxt = await txt(Ed, '#syMine'); console.log('E мои:', mineTxt.slice(0, 500));
  assert.ok(/цена продажи/.test(mineTxt) && /150 ₽/.test(mineTxt), 'у автора тоже видно, что меняется');
  await Ed.locator('#syMine .syrow', { hasText: 'Пюре готовое' }).locator('[data-act="syOne"]').click();
  await msg(Ed, 'send', /Отправлено на проверку технологу: 1/, 30000); await sleep(1500);

  // ===== 2. технолог: плашка → страница изменений с подсветкой «было → стало»
  await T.reload(); await T.waitForSelector('#view > *');
  await waitTxt(T, '#upBar', /Ждут проверки: 1/, 25000);
  await T.click('#upBar [data-act="upReview"]');
  await T.waitForSelector('#syPend .sybatch.hl', { timeout: 20000 });
  assert.ok(await T.evaluate(() => document.querySelector('#tabSync').getAttribute('aria-selected') === 'true'), 'открылась страница изменений, а не карта');
  assert.strictEqual(await T.locator('#rvBar:not([hidden]) .rvbar').count(), 0, 'карта не открывалась');
  const item = T.locator('#syPend .syrow', { hasText: 'Пюре готовое' });
  const li = async re => (await item.locator('.sydf li').allTextContents()).map(x => x.replace(/\s+/g, ' ').trim()).filter(x => re.test(x));
  const all = (await item.locator('.sydf li').allTextContents()).map(x => x.replace(/\s+/g, ' ').trim());
  console.log('диф:\n  ' + all.join('\n  '));
  assert.ok((await li(/^цена продажи .*120 ₽ → 150 ₽/)).length === 1, 'цена продажи: было → стало');
  assert.ok((await li(/^выход 200 г → 300 г/)).length === 1, 'выход');
  assert.ok((await li(/^состав: Картофель 200 г → 250 г/)).length === 1, 'количество');
  assert.ok((await li(/^состав: добавлено Говядина облачная — 50 г/)).length === 1, 'новая строка');
  assert.ok((await li(/4\.2\. Технология приготовления/)).length === 1, 'текстовое поле');
  assert.ok((await li(/^состав: добавлено Соль — 5 г, не учитывается/)).length === 1, 'пропущенная строка: ' + all.join(' | '));
  assert.strictEqual(await item.locator('.sydf del').count() >= 3, true, 'старое зачёркнуто');
  assert.strictEqual(await item.locator('.sydf ins').count() >= 5, true, 'новое выделено');
  assert.ok(await item.locator('.sydf .dfx.add').count() >= 3, 'добавленные строки текста');
  if (process.env.SHOT) { await T.locator('#syPend').scrollIntoViewIfNeeded(); await T.screenshot({ path: 'out/diff_page.png' }); }
  console.log('2 OK: страница изменений');

  // ===== 3. открыть карту: сверху «Что изменено», строки состава подсвечены
  await item.locator('[data-act="rvOpen"]').click();
  await waitTxt(T, '#rvBar', /Проверка ТТК/, 20000);
  const bar = await txt(T, '#rvBar'); console.log('bar:', bar.slice(0, 400));
  assert.ok(/Что изменено относительно/.test(bar) && /Картофель 200 г → 250 г/.test(bar), 'панель изменений в карте');
  assert.strictEqual(await T.locator('#rvBar #rvDf').count(), 1);
  await T.waitForSelector('.trw.hl-chg');
  assert.strictEqual(await T.locator('.trw.hl-chg').count(), 1, 'жёлтым — строка с другим количеством');
  assert.strictEqual(await T.locator('.trw.hl-add').count(), 2, 'зелёным — новые строки');
  assert.ok(await T.locator('.row.hl-chg, .row.hl-add').count() >= 2, 'и в таблице КБЖУ');
  // правка технолога сразу отражается в панели
  await T.fill('.trw.hl-add input[data-act="rowNet"] >> nth=0', '60'); await T.dispatchEvent('.trw.hl-add input[data-act="rowNet"] >> nth=0', 'change'); await sleep(900);
  assert.ok(/Говядина облачная — 60 г/.test(await txt(T, '#rvBar')), 'панель обновилась после правки: ' + (await txt(T, '#rvBar')).slice(0, 300));
  if (process.env.SHOT) { await T.evaluate(() => window.scrollTo(0, 0)); await T.screenshot({ path: 'out/diff_card.png' }); await T.locator('.trw.hl-chg').scrollIntoViewIfNeeded(); await T.screenshot({ path: 'out/diff_card2.png' }); }
  console.log('3 OK: карта с подсветкой');

  // ===== 4. «Принять» публикует, у других карта без подсветки
  await T.click('#rvBar [data-act="rvApprove"]'); await sleep(2500);
  await pickRec(T, /Пюре/).catch(() => {});
  assert.strictEqual(await T.locator('.trw.hl-chg, .trw.hl-add').count(), 0, 'после решения подсветки нет');
  const pubd = srv('pull', { since: '0' }).items.find(x => x.name === 'Пюре готовое');
  assert.ok(pubd && pubd.json.sell.main === 150, 'цена продажи опубликована');
  assert.ok(pubd.json.rows.some(x => x.skip === true && !x.ing && x.tname === 'Соль'), 'пропущенная строка ушла в общую базу и не потеряла отметку: ' + JSON.stringify(pubd.json.rows));
  console.log('4 OK');

  if (errs.length) { console.log('ERRORS:\n' + errs.join('\n')); process.exit(1); }
  console.log('PWDIFF OK');
  await browser.close(); process.exit(0);
})().catch(e => { console.error('FAIL', e); console.log(errs.join('\n')); process.exit(1); });
