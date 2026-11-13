/* общее объединение сырья в «Базе сырья»: выбор оставляемого и дублей, цена «большая / средняя / как у оставляемого»,
   перенос КБЖУ, синонимы, история цен, публикация для всех */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert'), vm = require('vm');
const { startGas } = require('./sync/gasserver');
const PH = require('./phread');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SRC = process.argv[2] || 'kbzhu.html';
const errs = [];
const ref = { label: '', p: null, f: null, c: null, kcal: null, tol: 10, basis: '100' };
const T_ = (name, p, f, c, extra) => Object.assign({ name, p, f, c, kind: 'table', source: '' }, extra || {});
const row = (rid, ing, net, tname) => ({ rid, ing, net, share: 100, tname });
const seed = () => ({
  ings: {
    k1: T_('Мука пшеничная в/с', 10.3, 1.1, 68, { price: 50, px: { msk: { price: 70 } } }),
    d1: T_('Мука пшеничная высшего сорта', 10.3, 1.1, 68, { price: 60, px: { msk: { price: 80 } } }),
    d2: T_('Мука пшеничная 1 сорт', 10.6, 1.3, 67, { price: 40, loss: { cold: 2 } }),
    z1: T_('Дрожжи', 0, 0, 0), z2: T_('Дрожжи прессованные', 12, 2, 8, { price: 200 }),
    s1: T_('Сливки 10%', 3, 10, 4), s2: T_('Сливки 20%', 3, 20, 4),
    w1: T_('Вода питьевая', 0, 0, 0),
  },
  recipes: {
    r1: { name: 'Тесто', output: 100, rows: [row('a', 'k1', 100, 'Мука'), row('b', 'z1', 5, 'Дрожжи')], ref },
    r2: { name: 'Булочка', output: 100, rows: [row('a', 'd1', 200, 'Мука высшего сорта'), row('b', 'd2', 50, 'Мука 1 сорт'), row('c', 'z2', 3, 'Дрожжи прессованные')], ref },
    r3: { name: 'Блин', output: 100, rows: [row('a', 'd1', 10, 'Мука высшего сорта'), row('b', 's1', 30, 'Сливки 10%')], ref },
  },
  cfg: {
    ph_main_20260901_20260930: { region: 'main', from: '2026-09-01', to: '2026-09-30', at: 1000, file: 'сентябрь.xlsx', wh: '', rule: 'avg', sup: ['ООО Мука'], it: [
      { ing: 'k1', nm: 'Мука в/с', pr: 50, ln: [['2026-09-10', 0, 50, 100]] }, { ing: 'd1', nm: 'Мука высшего', pr: 60, ln: [['2026-09-12', 0, 60, 200]] }, { ing: 'd2', nm: 'Мука 1 сорт', pr: 40, ln: [['2026-09-15', 0, 40, 100]] }] },
    ph_main_20261001_20261031: { region: 'main', from: '2026-10-01', to: '2026-10-31', at: 2000, file: 'октябрь.xlsx', wh: '', rule: 'avg', sup: ['ООО Мука'], it: [
      { ing: 'd1', nm: 'Мука высшего', pr: 65, ln: [['2026-10-05', 0, 65, 100]] }] },
  },
});
(async () => {
  const gs = await startGas();
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve(SRC), A = 'adm-5678';
  const srv = (a, extra) => gs.gas.parseOut(gs.gas.get(Object.assign({ a, code: A }, extra || {}))).data;
  const live = () => { const it = srv('pull', { since: '0' }).items; return { ing: it.filter(x => x.kind === 'ing' && !(x.json && x.json._del)), rec: it.filter(x => x.kind === 'rec' && !(x.json && x.json._del)), del: it.filter(x => (x.json && x.json._del)) }; };
  const mk = async name => {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 1100 } }); const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(name + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|net::ERR|Refused to execute/.test(m.text())) errs.push(name + ' console: ' + m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(url);
    await page.evaluate(d => { localStorage.clear(); localStorage.setItem('kbzhu:tab', 'base'); localStorage.setItem('kbzhu:bsub', 'kbzhu'); localStorage.setItem('kbzhu:sync', JSON.stringify({ cfg: { pubDocs: false } })); localStorage.setItem('kbzhu:v1', JSON.stringify(d)); }, seed());
    await page.reload(); await page.waitForSelector('#view > *');
    return page;
  };
  const txt = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; }, sel);
  const until = async (fn, t = 40000, what = '') => { const t0 = Date.now(); let v; while (Date.now() - t0 < t) { v = await fn(); if (v) return v; await sleep(300); } throw new Error('не дождались: ' + what); };
  const DB = page => page.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:v1')));
  const pick = async (page, act, text) => { const el = page.locator('#mxBox [data-act="' + act + '"]').first(); await el.fill(text); await el.dispatchEvent('change'); await sleep(150); };
  const open = async page => { if (await page.locator('#mxBox[open]').count() === 0) await page.click('#mxBox > summary'); await page.waitForSelector('#mxBox [data-act="mxKeep"]'); };
  const doMerge = async (page, keep, dups, price) => {
    await open(page);
    await pick(page, 'mxKeep', keep);
    for (const d of dups) await pick(page, 'mxAdd', d);
    if (price) await page.selectOption('#mxBox [data-act="mxPrice"]', price);
    const n = dups.length;
    assert.ok(new RegExp('Объединить: ' + n).test(await txt(page, '#mxBox [data-act="mxGo"]')), await txt(page, '#mxBox [data-act="mxGo"]'));
    await page.click('#mxBox [data-act="mxGo"]');
    assert.ok(/Нажмите ещё раз: объединить/.test(await txt(page, '#mxBox [data-act="mxGo"]')));
    await page.click('#mxBox [data-act="mxGo"]');
  };
  const names = db => Object.values(db.ings).map(x => x.name).sort();
  vm.runInContext('setup()', gs.gas.ctx);

  // ===== 1. «Большая» цена (по умолчанию), три позиции в одну, всё переносится
  const P = await mk('P');
  await P.waitForSelector('#mxBox'); await open(P);
  assert.strictEqual(await P.locator('#mxDl option').count(), 8, 'в подсказках вся база');
  await pick(P, 'mxKeep', 'Мука пшеничная в/с'); await pick(P, 'mxAdd', 'Мука пшеничная высшего сорта'); await pick(P, 'mxAdd', 'мука пшеничная 1 сорт');
  const prev = await txt(P, '#mxBox'); console.log('предпросмотр:', prev.slice(0, 700));
  assert.ok(/Мука пшеничная в\/с останется/.test(prev) && /объединится и исчезнет/.test(prev));
  assert.ok(/Цена после объединения: Волгоград — 60,00 ₽\/кг \(из 50,00, 60,00, 40,00\); Москва — 80,00 ₽\/кг/.test(prev), 'по умолчанию большая цена по регионам');
  await P.selectOption('#mxBox [data-act="mxPrice"]', 'avg');
  assert.ok(/Волгоград — 50,00 ₽\/кг/.test(await txt(P, '#mxBox')) && /Москва — 75,00 ₽\/кг/.test(await txt(P, '#mxBox')), 'средняя: ' + await txt(P, '#mxBox'));
  await P.selectOption('#mxBox [data-act="mxPrice"]', 'max');
  if (process.env.SHOT) await P.locator('#mxBox').screenshot({ path: 'out/shot_mx.png' });
  await P.click('#mxBox [data-act="mxGo"]'); await P.click('#mxBox [data-act="mxGo"]');
  await until(async () => /Объединено: 2\. Карт обновлено: 2/.test(await txt(P, '#toast')), 15000, 'объединение');
  await sleep(1500); let db = await DB(P);
  assert.deepStrictEqual(names(db), ['Вода питьевая', 'Дрожжи', 'Дрожжи прессованные', 'Мука пшеничная в/с', 'Сливки 10%', 'Сливки 20%']);
  const k1 = db.ings.k1;
  assert.strictEqual(k1.price, 60, 'главный регион: большая цена'); assert.strictEqual(k1.px.msk.price, 80, 'Москва: большая цена');
  assert.ok(/Объединение сырья \(большая цена\)/.test(k1.priceSrc), k1.priceSrc);
  assert.ok(['мука пшеничная высшего сорта', 'мука пшеничная 1 сорт'].every(a => k1.aliases.includes(a)), JSON.stringify(k1.aliases));
  assert.strictEqual(k1.loss && k1.loss.cold, 2, 'потери перенеслись, раз у оставляемого их не было');
  assert.deepStrictEqual(db.recipes.r2.rows.map(r => r.ing), ['k1', 'k1', 'z2']); assert.deepStrictEqual(db.recipes.r3.rows.map(r => r.ing), ['k1', 's1']);
  assert.strictEqual(db.recipes.r2.rows[0].tname, 'Мука высшего сорта', 'название в карте осталось');
  const ph = await PH.wait(P, m => m.ph_main_20261001_20261031 && m.ph_main_20261001_20261031.it[0].ing === 'k1' && m.ph_main_20260901_20260930.it.length === 1);
  const b1 = ph.ph_main_20260901_20260930, b2 = ph.ph_main_20261001_20261031;
  console.log('история:', JSON.stringify(b1.it.map(x => [x.ing, x.pr, x.ln.length])), JSON.stringify(b2.it.map(x => [x.ing, x.pr])));
  assert.deepStrictEqual(b1.it.map(x => x.ing), ['k1']); assert.strictEqual(b1.it[0].ln.length, 3, 'строки закупок сложены'); assert.strictEqual(b1.it[0].pr, 52.5, 'цена периода пересчитана по правилу записи');
  assert.deepStrictEqual(b2.it.map(x => x.ing), ['k1'], 'запись с одним сливаемым сырьём просто переехала');
  assert.ok(b1.at > 1000 && b2.at > 2000, 'записи помечены как изменённые');
  console.log('1 OK: большая цена, синонимы, потери, карты, история');

  // ===== 2. «Средняя» цена
  const Q = await mk('Q');
  await doMerge(Q, 'Мука пшеничная в/с', ['Мука пшеничная высшего сорта', 'Мука пшеничная 1 сорт'], 'avg');
  await until(async () => /Объединено: 2/.test(await txt(Q, '#toast')), 15000, 'avg'); await sleep(1500);
  db = await DB(Q); assert.strictEqual(db.ings.k1.price, 50, 'средняя (50+60+40)/3'); assert.strictEqual(db.ings.k1.px.msk.price, 75, 'Москва (70+80)/2');
  assert.ok(/средняя цена/.test(db.ings.k1.priceSrc));
  console.log('2 OK: средняя цена');

  // ===== 3. «Как у оставляемого»: цены оставляемого не меняются; если у него цены нет, берётся у дубля
  const R = await mk('R');
  await doMerge(R, 'Мука пшеничная в/с', ['Мука пшеничная высшего сорта'], 'keep');
  await until(async () => /Объединено: 1/.test(await txt(R, '#toast')), 15000, 'keep'); await sleep(1500);
  db = await DB(R); assert.strictEqual(db.ings.k1.price, 50); assert.strictEqual(db.ings.k1.px.msk.price, 70);
  console.log('3 OK: цена как у оставляемого');

  // ===== 4. КБЖУ: у оставляемого нет — переходит от дубля; при заметной разнице — предупреждение
  const S4 = await mk('S4'); await open(S4);
  await pick(S4, 'mxKeep', 'Сливки 10%'); await pick(S4, 'mxAdd', 'Сливки 20%');
  assert.ok(/заметно отличается/.test(await txt(S4, '#mxBox')), 'предупреждение о разных ККАЛ: ' + await txt(S4, '#mxBox'));
  await S4.click('#mxBox [data-act="mxClear"]');
  assert.ok(/Объединить: 0/.test(await txt(S4, '#mxBox [data-act="mxGo"]')));
  await pick(S4, 'mxKeep', 'Дрожжи'); await pick(S4, 'mxAdd', 'Дрожжи прессованные');
  assert.ok(/У «Дрожжи» нет КБЖУ, у «Дрожжи прессованные» есть/.test(await txt(S4, '#mxBox')));
  await S4.click('#mxBox [data-act="mxGo"]'); await S4.click('#mxBox [data-act="mxGo"]');
  await until(async () => /Объединено: 1/.test(await txt(S4, '#toast')), 15000, 'кбжу'); await sleep(1500);
  db = await DB(S4); const dr = db.ings.z1;
  assert.deepStrictEqual([dr.p, dr.f, dr.c], [12, 2, 8], 'КБЖУ перешло'); assert.strictEqual(dr.price, 200, 'и цена, раз у оставляемого её не было');
  // «Оставить это» меняет местами
  const W = await mk('W'); await open(W);
  await pick(W, 'mxKeep', 'Дрожжи'); await pick(W, 'mxAdd', 'Дрожжи прессованные');
  await W.click('#mxBox [data-act="mxSwap"]');
  assert.ok(/Дрожжи прессованные\s*останется/.test(await txt(W, '#mxBox')), await txt(W, '#mxBox'));
  await pick(W, 'mxAdd', 'вообще нет такого'); assert.ok(/Объединить: 1/.test(await txt(W, '#mxBox [data-act="mxGo"]')), 'неизвестное название не добавляется');
  await W.click('#mxBox [data-act="mxRm"]'); assert.ok(/Объединить: 0/.test(await txt(W, '#mxBox [data-act="mxGo"]')));
  console.log('4 OK: КБЖУ, предупреждения, «Оставить это», убрать из списка');

  // ===== 5. общая база: публикация для всех, карты и история уходят
  const T = await mk('T');
  await T.evaluate(() => localStorage.setItem('kbzhu:tab', 'sync')); await T.reload(); await T.waitForSelector('#syConn');
  await T.fill('#sy-url', gs.url); await T.fill('#sy-name', 'Технолог'); await T.fill('#sy-code', A); await T.click('[data-act="syConnect"]');
  await T.waitForFunction(() => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && !/Проверяю|Читаю/.test(e.textContent); }, null, { timeout: 30000 }); await sleep(1500);
  await T.click('#sy-pub'); await until(async () => /Опубликовано: /.test(await txt(T, '#sym-send')), 40000, 'публикация исходного');
  await sleep(1500);
  assert.strictEqual(live().ing.length, 8); assert.strictEqual(live().rec.length, 3);
  await T.click('#tabBase'); await T.waitForSelector('#mxBox');
  await doMerge(T, 'Мука пшеничная в/с', ['Мука пшеничная высшего сорта', 'Мука пшеничная 1 сорт'], 'max');
  await until(async () => /Объединено: 2/.test(await txt(T, '#sym-mx')), 40000, 'публикация объединения').catch(async e => { console.log('MX:', await txt(T, '#mxBox')); throw e; });
  console.log('итог:', await txt(T, '#sym-mx'));
  await sleep(2000);
  const L = live(); assert.strictEqual(L.ing.length, 6, 'в общей базе осталось 6 позиций'); assert.strictEqual(L.del.length, 2);
  const sidName = {}; L.ing.forEach(x => { sidName[x.sid] = x.name; });
  const r2 = L.rec.find(x => x.name === 'Булочка').json;
  assert.ok(r2.rows.every(r => sidName[r.ing]), 'карта ссылается на существующее сырьё'); assert.deepStrictEqual(r2.rows.map(r => sidName[r.ing]), ['Мука пшеничная в/с', 'Мука пшеничная в/с', 'Дрожжи прессованные']);
  const mk1 = L.ing.find(x => x.name === 'Мука пшеничная в/с').json; assert.strictEqual(mk1.price, 60); assert.ok(mk1.aliases.includes('мука пшеничная высшего сорта'));
  const sb = srv('phget', { id: 'ph_main_20260901_20260930' }).rec;
  console.log('история на сервере:', JSON.stringify(sb.it.map(x => [x.ing, x.pr, x.ln.length])));
  assert.strictEqual(sb.it.length, 1); assert.strictEqual(sb.it[0].pr, 52.5); assert.strictEqual(sb.it[0].ln.length, 3);
  assert.strictEqual(await txt(T, '#syStrip'), '');
  console.log('5 OK: общая база');

  assert.deepStrictEqual(errs, [], errs.join('\n'));
  console.log('PWMERGE4 OK');
  await browser.close(); process.exit(0);
})().catch(e => { console.log('FAIL', e); process.exit(1); });
