const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert');
const { startGas } = require('./sync/gasserver');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SRC = process.argv[2] || 'kbzhu.html';
const errs = [];
const baseSeed = () => ({
  ings: {
    i2: { name: 'Говядина облачная', p: 18, f: 12, c: 0, kind: 'table', source: '', price: 500 },
    i3: { name: 'Картофель', p: 2, f: 0.4, c: 16, kind: 'table', source: '', price: 30 },
    i5: { name: 'Свёкла', p: 1.5, f: 0.1, c: 8.8, kind: 'table', source: '' },
  },
  recipes: { r1: { name: 'Котлета тест', output: 150, rows: [{ rid: 'a', ing: 'i2', net: 100, share: 100 }, { rid: 'b', ing: 'i3', net: 50, share: 100 }], ref: { label: '', p: null, f: null, c: null, kcal: null, tol: 10, basis: '100' }, ttk: { num: '7' }, sell: { main: 120 }, qty: { main: 3 } } }, cfg: {}
});
(async () => {
  const gs = await startGas();
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve(SRC);
  const mk = async (name, data, tab = 'sync') => {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } }); const page = await ctx.newPage();
    page.on('pageerror', e => { if (!/Unexpected token '<'/.test(e.message)) errs.push(name + ': ' + e.message); });
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|net::ERR|Refused to execute/.test(m.text())) errs.push(name + ' console: ' + m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(url);
    await page.evaluate(([d, tab]) => { localStorage.clear(); localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:tab', tab); }, [data, tab]);
    await page.reload(); await page.waitForSelector(tab === 'sync' ? '#syConn' : '#view > *');
    return page;
  };
  const connect = async (page, { name, code }) => {
    await page.fill('#sy-url', gs.url); await page.fill('#sy-name', name); await page.fill('#sy-code', code || '');
    await page.click('[data-act="syConnect"]');
    await page.waitForFunction(() => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && !/Проверяю/.test(e.textContent); }, null, { timeout: 20000 });
    return page.textContent('#sym-conn');
  };
  const DB = async page => { await sleep(700); return page.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:v1'))); };
  const msg = async (page, key, re, t = 25000) => { await page.waitForFunction(([k, s]) => { const e = document.querySelector('#sym-' + k); return e && !e.hidden && new RegExp(s).test(e.textContent); }, [key, re.source], { timeout: t }); return page.textContent('#sym-' + key); };
  const E = 'fin-9012', A = 'adm-5678';   // сотрудник с правом на цены (экономист): эти тесты про сверку цен

  // ===== 0. неверный код / закрытый доступ / недоступный адрес
  const B = await mk('B', baseSeed());
  console.log('0a:', await connect(B, { name: 'Технолог', code: 'нет-такого' })); 
  assert.ok(/Код не подходит/.test(await B.textContent('#sym-conn')));
  gs.setMode('login'); let t0 = await connect(B, { name: 'Технолог', code: E }); console.log('0b:', t0); assert.ok(/Нет связи с общей базой/.test(t0));
  gs.setMode('down'); t0 = await connect(B, { name: 'Технолог', code: E }); console.log('0c:', t0); assert.ok(/Нет связи с общей базой/.test(t0));
  gs.setMode('ok');
  await B.fill('#sy-url', 'https://example.com/abc'); await B.click('[data-act="syConnect"]'); await sleep(200); assert.ok(/оканчивается на \/exec/.test(await B.textContent('#sym-conn')));

  // ===== 1. технолог: подключение и первая публикация всего своего
  let t = await connect(B, { name: 'Технолог', code: A }); console.log('1:', t); assert.ok(/Подключено: технолог/.test(t));
  await B.waitForSelector('#syMine'); await msg(B, 'pull', /Всё актуально/);
  let mine = await B.$$eval('#syMine .syrow b', e => e.map(x => x.textContent)); console.log('мои:', mine.join(', ')); assert.strictEqual(mine.length, 4);
  assert.ok(await B.$('#sy-pub'), 'у технолога есть «Опубликовать сразу»');
  await B.fill('#sy-note', 'Первая загрузка базы'); await B.click('#sy-pub');
  await msg(B, 'send', /Опубликовано: 4/); await sleep(1500);
  assert.strictEqual(gs.gas.rows('Общая база').length, 4); assert.strictEqual(gs.gas.rows('Предложения').length, 0);
  await B.waitForFunction(() => /Мои изменения · 0/.test(document.querySelector('#syMine h2').textContent), null, { timeout: 15000 });
  console.log('1 OK: опубликовано, у технолога изменений нет');

  // ===== 2. редактор A: подключается, всё усыновляется по названию; правит цену и добавляет ТТК
  const aData = baseSeed(); // совпадает с общей базой
  const Apage = await mk('A', aData);
  t = await connect(Apage, { name: 'Мария', code: E }); console.log('2:', t); assert.ok(/Подключено: тер. управляющий/.test(t));
  await msg(Apage, 'pull', /Всё актуально/);
  await Apage.waitForFunction(() => /Мои изменения · 0/.test(document.querySelector('#syMine h2').textContent), null, { timeout: 15000 });
  assert.ok(!(await Apage.$('#sy-pub')), 'у редактора нет «Опубликовать сразу»');
  // правим данные прямо в хранилище страницы и перезагружаем (как будто сделали это на других вкладках)
  await Apage.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('kbzhu:v1'));
    d.ings.i2.price = 550; d.recipes.r1.sell.main = 135; d.recipes.r1.qty = { main: 9 };
    d.ings.i9 = { name: 'Масло сливочное', p: 0.5, f: 82, c: 0.8, kind: 'table', source: '', price: 700 };
    d.recipes.r9 = { name: 'Пюре тест', output: 200, rows: [{ rid: 'c', ing: 'i3', net: 180, share: 100 }, { rid: 'd', ing: 'i9', net: 20, share: 100 }], ref: { label: '', p: null, f: null, c: null, kcal: null, tol: 10, basis: '100' }, ttk: {}, sell: { main: 60 } };
    localStorage.setItem('kbzhu:v1', JSON.stringify(d));
  });
  await Apage.reload(); await Apage.waitForSelector('#syMine');
  await Apage.waitForFunction(() => /Мои изменения · 4/.test(document.querySelector('#syMine h2').textContent));
  await Apage.waitForFunction(() => /цена 500 ₽\/кг → 550 ₽\/кг/.test(document.querySelector('#syMine').textContent), null, { timeout: 15000 });
  const rowsA = await Apage.$$eval('#syMine .syrow', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim())); console.log(rowsA.join('\n'));
  assert.ok(rowsA.some(x => /Говядина облачная.*цена 500 ₽\/кг → 550 ₽\/кг/.test(x)), 'описание правки цены');
  assert.ok(rowsA.some(x => /Котлета тест.*цена продажи \(Волгоград\) 120 ₽ → 135 ₽/.test(x)));
  assert.ok(rowsA.some(x => /Пюре тест.*новая ТТК/.test(x)) && rowsA.some(x => /Масло сливочное.*новое сырьё/.test(x)));
  assert.ok(!rowsA.some(x => /qty|продаж.*9/.test(x)), 'локальные продажи в описание не попадают');
  await Apage.fill('#sy-note', 'Цены с ноября'); await Apage.click('#sy-send');
  await msg(Apage, 'send', /Отправлено на проверку технологу: 4/);
  await sleep(1200);
  const pend = gs.gas.rows('Предложения'); assert.strictEqual(pend.length, 4); assert.ok(pend.every(r => r[7] === 'ждёт' && r[5] === 'Мария' && r[8] === 'Цены с ноября'));
  assert.strictEqual(gs.gas.rows('Общая база').length, 4, 'до проверки общая база не изменилась');
  console.log('2 OK: предложение на проверке');

  // ===== 3. технолог: видит предложение с описанием правок, принимает
  await B.click('[data-act="syRefresh"]');
  await B.waitForFunction(() => /На проверке · 1/.test(document.querySelector('#syPend h2').textContent), null, { timeout: 15000 });
  const pb = await B.$$eval('#syPend .syrow', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim())); console.log(pb.join('\n'));
  assert.ok(pb.some(x => /Говядина облачная.*цена 500 ₽\/кг → 550 ₽\/кг/.test(x)) && pb.some(x => /Пюре тест.*новая ТТК/.test(x)));
  await B.waitForFunction(() => / · 1/.test(document.querySelector('#tabSync').textContent), null, { timeout: 5000 });   // плашка вкладки обновляется следом за списком, а не в тот же миг
  await B.click('[data-act="syApprove"]');
  await msg(B, 'review', /Принято и опубликовано/);
  await B.waitForFunction(() => /На проверке · 0/.test(document.querySelector('#syPend h2').textContent), null, { timeout: 15000 });
  assert.strictEqual(gs.gas.rows('Общая база').length, 6); assert.ok(gs.gas.rows('Предложения').every(r => r[7] === 'принято'));
  const logB = await B.$$eval('#syLog .syrow', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim())); console.log(logB.slice(0, 5).join('\n'));
  assert.ok(logB.some(x => /Мария.*принято.*Говядина облачная/.test(x)));
  console.log('3 OK: принято');

  // ===== 4. редактор C: пустой браузер с автополучением при открытии
  const C = await mk('C', { ings: {}, recipes: {}, cfg: {} }, 'menu');
  await C.evaluate(([u]) => { localStorage.setItem('kbzhu:sync', JSON.stringify({ cfg: { url: u, name: 'Пётр', code: 'fin-9012', acode: '', auto: true, rev: 0, role: 'finance', mapUrl: u }, map: { ing: {}, rec: {} } })); }, [gs.url]);
  await C.reload();
  await C.waitForFunction(() => /Получено из общей базы/.test(document.querySelector('#toast').textContent), null, { timeout: 20000 });
  console.log('toast C:', await C.textContent('#toast'));
  const dc = await DB(C);
  const names = Object.values(dc.ings).map(x => x.name).sort(); assert.deepStrictEqual(names, ['Говядина облачная', 'Картофель', 'Масло сливочное', 'Свёкла']);
  assert.strictEqual(Object.values(dc.ings).find(x => x.name === 'Говядина облачная').price, 550, 'принятая цена');
  const kot = Object.values(dc.recipes).find(x => x.name === 'Котлета тест'), pyu = Object.values(dc.recipes).find(x => x.name === 'Пюре тест');
  assert.strictEqual(kot.sell.main, 135); assert.strictEqual(kot.qty, undefined, 'чужие продажи не приходят');
  assert.deepStrictEqual(pyu.rows.map(r => dc.ings[r.ing].name + ':' + r.net), ['Картофель:180', 'Масло сливочное:20']);
  assert.strictEqual(pyu.sell.main, 60);
  console.log('4 OK: C получил общую базу при открытии');
  // меню у C показывает блюда с ценами продажи
  await C.click('[data-tab="menu"]'); assert.ok(/Пюре тест/.test(await C.textContent('#view')));

  // ===== 5. A получает: изменения совпали с принятыми → правки сняты, продажи у A остались
  await Apage.click('[data-act="syPull"]'); await msg(Apage, 'pull', /Всё актуально|Получено|Применено/);
  await Apage.waitForFunction(() => /Мои изменения · 0/.test(document.querySelector('#syMine h2').textContent), null, { timeout: 15000 });
  const da = await DB(Apage); assert.deepStrictEqual(da.recipes.r1.qty, { main: 9 }, 'продажи A на месте'); assert.strictEqual(da.ings.i2.price, 550);
  console.log('5 OK');

  // ===== 6. конфликт: технолог меняет цену картофеля, A тоже менял — A видит конфликт
  await Apage.evaluate(() => { const d = JSON.parse(localStorage.getItem('kbzhu:v1')); d.ings.i3.price = 33; localStorage.setItem('kbzhu:v1', JSON.stringify(d)); });
  await Apage.reload(); await Apage.waitForSelector('#syMine');
  await sleep(5800);   // стартовая проверка у A прошла: дальше общее подтягивается само, а список выбора виден, если правка пришла уже после открытия
  await B.evaluate(() => { const d = JSON.parse(localStorage.getItem('kbzhu:v1')); const id = Object.keys(d.ings).find(k => d.ings[k].name === 'Картофель'); d.ings[id].price = 35; localStorage.setItem('kbzhu:v1', JSON.stringify(d)); });
  await B.reload(); await B.waitForSelector('#syMine');
  await B.waitForFunction(() => /Мои изменения · 1/.test(document.querySelector('#syMine h2').textContent)); await B.fill('#sy-note', 'Картофель подорожал'); await B.click('#sy-pub'); await msg(B, 'send', /Опубликовано: 1/);
  await Apage.click('[data-act="syPull"]');
  await Apage.waitForSelector('#upBar [data-act="hdBack"]', { timeout: 15000 });
  console.log('конфликт: плашка «Продолжить работу»:', (await Apage.textContent('#upBar')).replace(/\s+/g, ' ').trim());
  assert.strictEqual((await DB(Apage)).ings.i3.price, 35, 'у редактора применена версия технолога');
  assert.strictEqual(await Apage.locator('[data-act="syApply"]').count(), 0, 'списка выбора нет');
  await Apage.click('#upBar [data-act="hdBack"]'); await sleep(900);
  assert.strictEqual((await DB(Apage)).ings.i3.price, 33, 'свои правки вернулись кнопкой «Продолжить работу»');
  assert.ok(/Мои изменения · 1/.test(await Apage.textContent('#syMine h2')), 'и остались к отправке');
  // второй раз: берём общее
  await Apage.evaluate(() => { const d = JSON.parse(localStorage.getItem('kbzhu:v1')); d.ings.i3.price = 34; localStorage.setItem('kbzhu:v1', JSON.stringify(d)); });
  await B.evaluate(() => {}); await B.click('[data-act="syRefresh"]');
  await Apage.reload(); await Apage.waitForSelector('#syMine'); // конфликт был разрешён «оставить моё», rev подтянут: новой версии нет
  await Apage.click('[data-act="syPull"]'); await msg(Apage, 'pull', /Всё актуально/);
  console.log('6 OK: конфликт');

  // ===== 7. отклонение: A предлагает свою цену картофеля, технолог отклоняет с комментарием
  await Apage.fill('#sy-note', 'Моя цена'); await Apage.click('#sy-send'); await msg(Apage, 'send', /Отправлено на проверку технологу: 1/);
  await B.click('[data-act="syRefresh"]'); await B.waitForFunction(() => /На проверке · 1/.test(document.querySelector('#syPend h2').textContent), null, { timeout: 15000 });
  const stale = await B.textContent('#syPend'); console.log('stale:', /изменилась после/.test(stale));
  await B.fill('[data-act="syRN"]', 'Цена от поставщика 35'); await B.click('[data-act="syReject"]'); await msg(B, 'review', /Отклонено/);
  await B.waitForFunction(() => /На проверке · 0/.test(document.querySelector('#syPend h2').textContent), null, { timeout: 15000 });
  assert.ok(gs.gas.rows('Предложения').some(r => r[7] === 'отклонено' && /Цена от поставщика 35/.test(r[8])));
  console.log('7 OK: отклонено');

  // ===== 8. возврат прежнего значения технологом, A получает
  await B.click('[data-act="syRefresh"]'); await sleep(1200);
  const revBtn = await B.$$eval('#syLog .syrow', e => e.map(x => [x.textContent.replace(/\s+/g, ' ').trim(), !!x.querySelector('[data-act="syRevert"]')]));
  const idx = revBtn.findIndex(([tx, has]) => has && /Картофель/.test(tx) && /опубликовано/.test(tx)); assert.ok(idx >= 0, 'есть кнопка возврата у публикации цены картофеля: ' + JSON.stringify(revBtn.slice(0, 4)));
  await B.locator('#syLog .syrow').nth(idx).locator('[data-act="syRevert"]').click(); await msg(B, 'review', /возвращено/);
  await sleep(800); const nowPub = gs.gas.parseOut(gs.gas.get({ a: 'pull', since: 0, code: 'adm-5678' })).data.items.find(x => x.name === 'Картофель'); assert.strictEqual(nowPub.json.price, 30, 'в общей базе цена вернулась к 30'); 
  const dbb = await DB(B); assert.strictEqual(Object.values(dbb.ings).find(x => x.name === 'Картофель').price, 30, 'и у технолога');
  console.log('8 OK: возврат');

  assert.deepStrictEqual(errs, [], 'ошибки страниц: ' + errs.join('; '));
  console.log('PWSYNC1 OK'); await browser.close(); gs.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
