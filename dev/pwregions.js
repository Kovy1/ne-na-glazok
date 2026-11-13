/* v26: регионы пользователей. Технолог назначает регионы в «Пользователях»; два человека разных регионов видят только своё;
   смена учётной записи на одном устройстве не показывает чужие данные и возвращает свои; скрытое не удаляется */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert'), vm = require('vm');
const { startGas } = require('./sync/gasserver');
const SRC = process.argv[2] || 'kbzhu.html';
const errs = [];
(async () => {
  const gs = await startGas({ rs: {} });
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve(SRC), A = 'adm-5678';
  vm.runInContext('setup()', gs.gas.ctx);
  let n = 0; const post = b => JSON.parse(gs.gas.post(Object.assign({ rid: 'rid-' + (++n) + '-abcdef' }, b)).text);
  const mk = async (name, ctx0) => {
    const ctx = ctx0 || await browser.newContext({ viewport: { width: 1200, height: 900 } }); const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(name + ': ' + e.message + ' ' + String(e.stack || '').slice(0, 400)));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|net::ERR|Refused to execute/.test(m.text())) errs.push(name + ' console: ' + m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(url);
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('kbzhu:tab', 'sync'); });
    await page.reload(); await page.waitForSelector('#view > *');
    return page;
  };
  const connect = async (page, { name, code }, wait = /Подключено|Код не|Вы входите|Доступ|Слишком|Сначала|Не удалось/) => {
    await page.click('#tabSync'); await page.waitForSelector('#syConn');
    if (await page.locator('#sy-url').count()) await page.fill('#sy-url', gs.url);
    await page.fill('#sy-name', name); await page.fill('#sy-code', code);
    await page.click('[data-act="syConnect"]');
    await page.waitForFunction(re => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && new RegExp(re).test(e.textContent); }, wait.source, { timeout: 30000 });
    return page.textContent('#sym-conn');
  };
  const store = (page) => page.evaluate(() => ({ v1: JSON.parse(localStorage.getItem('kbzhu:v1') || 'null'), sy: JSON.parse(localStorage.getItem('kbzhu:sync') || 'null'), owner: localStorage.getItem('kbzhu:owner') }));
  const T = await mk('T');
  console.log('T:', await connect(T, { name: 'Технолог', code: A }));

  // база: сырьё с ценами трёх регионов, карта Москвы
  const ap = (items) => { const p = post({ op: 'propose', code: A, by: 'Технолог', items }); assert.ok(p.ok, JSON.stringify(p)); assert.ok(post({ op: 'approve', code: A, by: 'Технолог', batch: p.batch }).ok); };
  ap([
    { kind: 'ing', sid: 'i-beet', name: 'Свёкла', baseRev: 0, json: { name: 'Свёкла', p: 1.5, f: 0.1, c: 8, kind: 'table', source: '', price: 30, priceUnit: 'kg', px: { msk: { price: 50, priceUnit: 'kg' } } } },
    { kind: 'rec', sid: 'r-msk', name: 'Хачапури', baseRev: 0, json: { name: 'Хачапури', output: 200, rows: [], reg: 'msk', ref: {} } },
  ]);

  // 1. технолог: пользователи без регионов видны как «не назначены»; назначает регионы флажками
  await T.waitForSelector('#syUsr'); await T.click('#syUsr > summary'); await T.waitForSelector('#us-name'); await T.waitForSelector('#syUsr fieldset.rgset');
  const mkUser = async (name, regIds) => {
    await T.fill('#us-name', name);
    await T.uncheck('#us-own');
    for (const id of regIds) await T.check('#syUsr fieldset.rgset >> nth=0 >> input[data-rid="' + id + '"]');
    await T.click('[data-act="usAdd"]'); await T.waitForSelector('.usmade');
    const code = (await T.textContent('.usmade .uscode')).trim(); await T.click('[data-act="usMadeHide"]'); return code;
  };
  const cV = await mkUser('Волгоградов В.В.', ['main']);
  const cM = await mkUser('Москвин М.М.', ['msk']);
  const cN = await mkUser('Новичков Н.Н.', []);        // регионов не отмечено: остаётся «не назначены»
  const list = (await T.textContent('#syUsr .uslist')).replace(/\s+/g, ' ');
  assert.ok(/Новичков Н\.Н\.[^]*не назначены/.test(list), 'у нового без регионов подпись «не назначены»: ' + list);
  assert.ok(/Регионы не назначены: 5/.test(await T.textContent('#syUsr')), 'сводка: Новичков и четыре общих кода');
  console.log('1 OK: пользователи созданы', cV, cM, cN);

  // 2. человек Волгограда: видит только свой регион и свою цену
  const V = await mk('V');
  assert.ok(/Подключено/.test(await connect(V, { name: 'Волгоградов В.В.', code: cV })), 'вход V');
  await V.waitForFunction(() => /Получено|Общая база|актуальн|нет изменений/i.test(document.body.textContent) || true);
  await V.waitForTimeout(1500);
  let st = await store(V);
  assert.deepStrictEqual(st.sy.cfg.regs, ['main'], 'регионы сохранены в настройках');
  const beet = Object.values(st.v1.ings).find(x => x.name === 'Свёкла');
  assert.ok(beet, 'сырьё получено'); assert.strictEqual(beet.price, 30); assert.strictEqual(beet.px, undefined, 'цен Москвы нет');
  assert.ok(!Object.values(st.v1.recipes).some(x => x.name === 'Хачапури'), 'карты Москвы нет');
  await V.click('#tabBase').catch(() => {});
  const opts = await V.$$eval('#regionSel option', o => o.map(x => x.textContent));
  assert.deepStrictEqual(opts, ['Волгоград'], 'в списке регионов только свой: ' + opts);
  console.log('2 OK: V видит только Волгоград');

  // 3. тот же браузер: выходим и входим как москвич — данные Волгоградова с экрана и из хранилища убраны
  await V.evaluate(() => { const b = document.querySelector('[data-act="syDisconnect"]'); if (b) b.click(); });
  await V.waitForTimeout(300);
  // локальная правка Волгоградова, не ушедшая в общую базу
  await V.evaluate(() => { const d = JSON.parse(localStorage.getItem('kbzhu:v1')); d.ings['loc1'] = { name: 'Локальный соус V', p: 0, f: 0, c: 0, kind: 'estimate', source: '' }; localStorage.setItem('kbzhu:v1', JSON.stringify(d)); });
  await V.reload(); await V.waitForSelector('#view > *');
  assert.ok(/Подключено|Подключиться|Проверить/.test(await V.evaluate(() => document.body.textContent)));
  console.log('3a: ', (await connect(V, { name: 'Москвин М.М.', code: cM })).slice(0, 80));
  await V.waitForTimeout(1500);
  st = await store(V);
  assert.deepStrictEqual(st.sy.cfg.regs, ['msk']);
  const ings = Object.values(st.v1.ings);
  assert.ok(!ings.some(x => x.name === 'Локальный соус V'), 'локальные данные прежнего пользователя не показываются следующему');
  const beet2 = ings.find(x => x.name === 'Свёкла');
  assert.ok(beet2 && beet2.price === undefined && beet2.px && beet2.px.msk && beet2.px.msk.price === 50, 'у москвича цена Москвы, цены Волгограда нет');
  assert.ok(Object.values(st.v1.recipes).some(x => x.name === 'Хачапури'), 'карта Москвы есть');
  console.log('3 OK: данные V убраны');

  // 4. возвращается Волгоградов: его локальные данные на месте
  await V.evaluate(() => { const b = document.querySelector('[data-act="syDisconnect"]'); if (b) b.click(); });
  await V.waitForTimeout(300); await V.reload(); await V.waitForSelector('#view > *');
  await connect(V, { name: 'Волгоградов В.В.', code: cV });
  await V.waitForTimeout(1500);
  st = await store(V);
  assert.ok(Object.values(st.v1.ings).some(x => x.name === 'Локальный соус V'), 'своё вернулось');
  assert.ok(!Object.values(st.v1.recipes).some(x => x.name === 'Хачапури'));
  console.log('4 OK: свои данные вернулись');

  // 5. регион добавили, потом сняли и вернули: данные региона приходят, прячутся и возвращаются, а не теряются
  const vid = JSON.parse(gs.gas.get({ code: A, who: 'Технолог', a: 'users', callback: 'cb' }).text.replace(/^cb\(|\);?$/g, '')).users.find(u => u.name === 'Волгоградов В.В.').id;
  const refresh = async () => { await V.evaluate(() => document.querySelector('[data-act="syPull"]').click()); await V.waitForTimeout(1800); return store(V); };
  const goSync = async () => { await V.click('#tabSync'); await V.waitForSelector('[data-act="syPull"]'); };
  await goSync();
  assert.ok(post({ op: 'usrregs', code: A, by: 'Технолог', id: vid, regs: ['main', 'msk'] }).ok);
  st = await refresh();
  assert.deepStrictEqual(st.sy.cfg.regs, ['main', 'msk']);
  let b5 = Object.values(st.v1.ings).find(x => x.name === 'Свёкла');
  assert.strictEqual(b5.price, 30); assert.strictEqual(b5.px.msk.price, 50, 'цена Москвы пришла после назначения');
  assert.ok(Object.values(st.v1.recipes).some(x => x.name === 'Хачапури'), 'карта Москвы пришла');
  assert.ok(post({ op: 'usrregs', code: A, by: 'Технолог', id: vid, regs: ['msk'] }).ok);
  st = await refresh();
  b5 = Object.values(st.v1.ings).find(x => x.name === 'Свёкла');
  assert.strictEqual(b5.price, undefined, 'цена Волгограда убрана с экрана после снятия региона'); assert.strictEqual(b5.px.msk.price, 50);
  const parked = await V.evaluate(() => new Promise(res => { const rq = indexedDB.open('kbzhu-park', 1); rq.onsuccess = () => { const g = rq.result.transaction('kv').objectStore('kv').getAll(); g.onsuccess = () => res(g.result.map(x => x.k)); }; rq.onerror = () => res(null); }));
  assert.ok(parked && parked.some(k => /^hid:/.test(k)), 'скрытое лежит в отдельном хранилище, а не удалено: ' + JSON.stringify(parked));
  assert.ok(post({ op: 'usrregs', code: A, by: 'Технолог', id: vid, regs: ['main'] }).ok);
  st = await refresh();
  b5 = Object.values(st.v1.ings).find(x => x.name === 'Свёкла');
  assert.strictEqual(b5.price, 30, 'цена Волгограда вернулась'); assert.strictEqual(b5.px, undefined, 'цен Москвы нет');
  assert.ok(!Object.values(st.v1.recipes).some(x => x.name === 'Хачапури'), 'карта Москвы убрана');
  console.log('5 OK: регионы выданы, сняты, возвращены без потерь');

  // 6. подмена региона и чужого документа: сервер отказывает даже если страница прислала
  const forged = post({ op: 'propose', code: cV, by: 'Волгоградов В.В.', items: [{ kind: 'rec', sid: 'r-evil', name: 'Подмена', baseRev: 0, json: { name: 'Подмена', output: 100, rows: [], reg: 'msk', ref: {} } }] });
  assert.strictEqual(forged.err, 'region', 'запись в чужой регион отклонена');
  assert.strictEqual(post({ op: 'phput', code: cV, by: 'Волгоградов В.В.', id: 'ph_msk_20260901_20260930', rec: { it: [{ ing: 'x', nm: 'x', pr: 1, ln: [] }] } }).err, 'region');
  console.log('6 OK: подмена региона отклонена сервером');
  console.log('OK');
  await browser.close(); gs.close();
  if (errs.length) { console.log(errs.join('\n')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
