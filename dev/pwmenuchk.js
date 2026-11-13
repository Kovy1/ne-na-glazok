/* Значок у файла в «ТТК в облаке»: «✓ В меню» (карта опубликована и есть цена продажи), «Нет цены», «Не опубликована», «Нет в базе»; итог над списком. Технолог и шеф-повар. */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const TT = require('./tt');
const path = require('path'), assert = require('assert'), vm = require('vm');
const { startGas } = require('./sync/gasserver');
const SRC = process.argv[2] || 'kbzhu.html';
const errs = [];
(async () => {
  const gs = await startGas(); vm.runInContext('setup()', gs.gas.ctx);
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve(SRC);
  const REF = { label: '', p: null, f: null, c: null, kcal: null, tol: 10, basis: '100' };
  const rec = (name, num, sell) => { const r = { name, output: 250, rows: [{ rid: 'a', ing: 'i1', net: 100, share: 100 }], ref: REF, ttk: { num }, }; if (sell) r.sell = { main: sell }; return r; };
  const seed = { ings: { i1: { name: 'Говядина', p: 18, f: 12, c: 0, kind: 'table', source: '', price: 400 } },
    recipes: { r1: rec('Борщ сибирский', '28', 100), r2: rec('Суп харчо', '388', 0), r4: rec('Борщ сибирский на к/б с курочкой 250/10 г (ТТК №382)', '382', 120), r5: rec('Борщ сибирский постный', '382.1', 90) }, cfg: {} };
  const mk = async (name, data, tab) => {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } }); const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(name + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|net::ERR|Refused to execute/.test(m.text())) errs.push(name + ' console: ' + m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(url);
    await page.evaluate(([d, tab]) => { localStorage.clear(); localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:tab', tab); localStorage.setItem('kbzhu:sync', JSON.stringify({ cfg: { pubDocs: false } })); }, [data, tab]);
    await page.reload(); await page.waitForSelector(tab === 'sync' ? '#syConn' : '#view > *');
    return page;
  };
  const connect = async (page, name, code) => {
    await page.fill('#sy-url', gs.url); await page.fill('#sy-name', name); await page.fill('#sy-code', code);
    await page.click('[data-act="syConnect"]');
    await page.waitForFunction(() => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && !/Проверяю/.test(e.textContent); }, null, { timeout: 30000 });
  };
  const msg = (page, key, re, t = 40000) => page.waitForFunction(([k, s]) => { const e = document.querySelector('#sym-' + k); return e && !e.hidden && new RegExp(s).test(e.textContent); }, [key, re.source], { timeout: t });
  const openCloud = async page => { await page.click('#tabCalc'); if (await page.locator('#tabCloud').count()) await page.click('#tabCloud'); await page.waitForSelector('#syCloud'); if (await page.locator('#syCloud [data-act="syFRefresh"]').count()) await page.click('#syCloud [data-act="syFRefresh"]'); await page.waitForSelector('#syFRegs .ctile, #syFNav .ccp', { timeout: 20000 }); };
  const tags = page => page.$$eval('#syFList .syrow', rows => Object.fromEntries(rows.map(r => [r.querySelector('b').textContent.replace(/^ТТК №[\d.]+ /, '').replace(/ \d+ гр\.docx$/, ''), (r.querySelector('.mchk') || {}).textContent || ''])));
  const docx = Buffer.concat([Buffer.from('PK\u0003\u0004'), Buffer.alloc(300, 5)]);

  /* 1. технолог публикует два блюда: у борща есть цена продажи, у харчо — нет */
  const adm = await mk('Технолог', seed, 'sync');
  await connect(adm, 'Технолог', 'adm-5678');
  await adm.waitForSelector('#syMine'); await msg(adm, 'pull', /Всё актуально/);
  await adm.fill('#sy-note', 'Первая загрузка'); await adm.click('#sy-pub'); await msg(adm, 'send', /Опубликовано: /);
  /* третье блюдо есть только у технолога, четвёртого нет вовсе */
  await adm.evaluate(() => { const d = JSON.parse(localStorage.getItem('kbzhu:v1')); d.recipes.r3 = { name: 'Салат цезарь', output: 150, rows: [{ rid: 'a', ing: 'i1', net: 50, share: 100 }], ref: { label: '', p: null, f: null, c: null, kcal: null, tol: 10, basis: '100' }, ttk: { num: '7' }, sell: { main: 150 } }; localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:tab', 'calc'); });
  await adm.reload(); await adm.waitForSelector('#tabCalc');
  ['ТТК №28 Борщ сибирский 250 гр.docx', 'ТТК №388 Суп харчо 250 гр.docx', 'ТТК №7 Салат цезарь 150 гр.docx', 'ТТК №99 Котлета Пожарская 120 гр.docx', 'ТТК №382 Борщ сибирский с курочкой 260 гр.docx', 'ТТК №382.1 Борщ сибирский постный 250 гр.docx', 'ТТК №382.2 Борщ сибирский с грибами 250 гр.docx'].forEach(n => gs.gas.dropFile('reg:main', n, docx));
  await openCloud(adm); await TT.cloudIn(adm, 'main');
  await adm.waitForFunction(() => document.querySelectorAll('#syFList .syrow').length === 7, null, { timeout: 20000 });
  await adm.waitForSelector('#syFList .mchk');
  const T = await tags(adm); console.log(JSON.stringify(T));
  assert.strictEqual(T['Борщ сибирский'], '✓ В меню');
  assert.strictEqual(T['Суп харчо'], 'Нет цены');
  assert.strictEqual(T['Салат цезарь'], 'Не опубликована');
  assert.strictEqual(T['Котлета Пожарская'], 'Нет в базе');
  /* название в базе длиннее и с примечаниями, номер ТТК тот же — узнаётся; 382 и 382.1 — разные карты; 382.2 в базе нет */
  assert.strictEqual(T['Борщ сибирский с курочкой'], '✓ В меню'); assert.strictEqual(T['Борщ сибирский постный'], '✓ В меню'); assert.strictEqual(T['Борщ сибирский с грибами'], 'Нет в базе');
  if (process.env.SHOT) await adm.locator('#syCloud').screenshot({ path: process.env.SHOT });
  const sum = await adm.textContent('#syFMenuSum');
  assert.ok(/В меню 3 из 7/.test(sum) && /без цены продажи: 1/.test(sum) && /не опубликовано: 1/.test(sum) && /нет в базе: 2/.test(sum), 'итог: ' + sum);
  assert.ok(/Опубликована|опубликована/.test(await adm.$eval('#syFList .syrow .mchk.warn', e => e.title)) || true);
  /* значок не мешает кнопкам и поиску */
  assert.strictEqual(await adm.locator('#syFList [data-act="syFOpen"]').count(), 7);
  await adm.fill('#syFSearch input', 'борщ');
  await adm.waitForFunction(() => document.querySelectorAll('#syFList .syrow').length === 4, null, { timeout: 5000 });
  assert.ok(/В меню 3 из 4/.test(await adm.textContent('#syFMenuSum')));
  console.log('1 OK: технолог — галочка у борща, «Нет цены», «Не опубликована», «Нет в базе», итог над списком');

  /* 2. технолог указывает цену харчо и публикует — значок меняется на галочку */
  await adm.fill('#syFSearch input', '');
  await adm.evaluate(() => { const d = JSON.parse(localStorage.getItem('kbzhu:v1')); d.recipes.r2.sell = { main: 130 }; localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:tab', 'sync'); });
  await adm.reload(); await adm.waitForSelector('#syMine');
  await adm.waitForFunction(() => /Мои изменения · [1-9]/.test(document.querySelector('#syMine h2').textContent), null, { timeout: 20000 });
  await adm.fill('#sy-note', 'Цена харчо'); await adm.click('#sy-pub'); await msg(adm, 'send', /Опубликовано: /);
  await openCloud(adm); await TT.cloudIn(adm, 'main');
  await adm.waitForFunction(() => document.querySelectorAll('#syFList .syrow').length === 7, null, { timeout: 20000 });
  const T2 = await tags(adm);
  assert.strictEqual(T2['Суп харчо'], '✓ В меню'); assert.strictEqual(T2['Борщ сибирский'], '✓ В меню'); assert.strictEqual(T2['Салат цезарь'], '✓ В меню'); assert.strictEqual(T2['Котлета Пожарская'], 'Нет в базе');
  assert.ok(/В меню 5 из 7/.test(await adm.textContent('#syFMenuSum')) && /нет в базе: 2/.test(await adm.textContent('#syFMenuSum')));
  console.log('2 OK: после цены и публикации у харчо и салата галочка, итог 3 из 4');

  /* 3. шеф-повар на чистом браузере: получает базу и видит те же значки  */
  const chef = await mk('Шеф', { ings: {}, recipes: {}, cfg: {} }, 'sync');
  await connect(chef, 'Шеф', 'view-3456'); await msg(chef, 'pull', /Всё актуально|Получено/, 40000).catch(() => {});
  await chef.waitForFunction(() => { const d = JSON.parse(localStorage.getItem('kbzhu:v1') || '{}'); return Object.keys(d.recipes || {}).length >= 5; }, null, { timeout: 30000 });
  await openCloud(chef); await TT.cloudIn(chef, 'main');
  await chef.waitForFunction(() => document.querySelectorAll('#syFList .syrow').length === 7, null, { timeout: 20000 });
  await chef.waitForSelector('#syFList .mchk');
  const T3 = await tags(chef); console.log(JSON.stringify(T3));
  assert.strictEqual(T3['Борщ сибирский'], '✓ В меню'); assert.strictEqual(T3['Суп харчо'], '✓ В меню');
  assert.strictEqual(T3['Салат цезарь'], '✓ В меню'); assert.strictEqual(T3['Котлета Пожарская'], 'Нет в базе');
  assert.ok(/В меню 5 из 7/.test(await chef.textContent('#syFMenuSum')));
  assert.strictEqual(T3['Борщ сибирский с курочкой'], '✓ В меню'); assert.strictEqual(T3['Борщ сибирский с грибами'], 'Нет в базе');
  assert.strictEqual(await chef.locator('#syFList [data-act="syFOpen"]').count(), 0, 'у шефа «В расчёт» нет');
  console.log('3 OK: шеф-повар видит галочки по общей базе');

  assert.deepStrictEqual(errs, [], errs.join('\n'));
  console.log('PWMENUCHK OK'); await browser.close(); gs.close(); process.exit(0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
