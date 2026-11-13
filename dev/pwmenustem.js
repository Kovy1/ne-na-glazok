/* значок «В меню» у файла: тот же номер ТТК и то же блюдо, даже если в названиях разные окончания или опечатка («запеченый» / «запеченный», «соусе» / «соусом») */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const TT = require('./tt');
const path = require('path'), assert = require('assert'), vm = require('vm');
const { startGas } = require('./sync/gasserver');
const SRC = process.argv[2] || 'kbzhu.html';
const errs = [];
(async () => {
  const gs = await startGas(); vm.runInContext('setup()', gs.gas.ctx);
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const REF = { label: '', p: null, f: null, c: null, kcal: null, tol: 10, basis: '100' };
  const rec = (name, num, sell) => { const r = { name, output: 150, rows: [{ rid: 'a', ing: 'i1', net: 100, share: 100 }], ref: REF, ttk: { num } }; if (sell) r.sell = { main: sell }; return r; };
  const seed = { ings: { i1: { name: 'Говядина', p: 18, f: 12, c: 0, kind: 'table', source: '', price: 400 } }, recipes: {
    r1: rec('Картофель, запеченный в горчичном соусе 1/150 (ТТК №262)', '262', 90),
    r2: rec('Цветная капуста, запеченная под сметанным соусом 1/150 (ТТК №296)', '296', 95),
    r3: rec('Суп харчо 1/250 (ТТК №388)', '388', 120),
    r4: rec('Гречка отварная с овощами 1/150 г (ТТК №12)', '12', 40) }, cfg: {} };
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } }); const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + path.resolve(SRC));
  await page.evaluate(d => { localStorage.clear(); localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:tab', 'sync'); }, seed);
  await page.reload(); await page.waitForSelector('#syConn');
  await page.fill('#sy-url', gs.url); await page.fill('#sy-name', 'Технолог'); await page.fill('#sy-code', 'adm-5678');
  await page.click('[data-act="syConnect"]');
  const msg = (key, re) => page.waitForFunction(([k, s]) => { const e = document.querySelector('#sym-' + k); return e && !e.hidden && new RegExp(s).test(e.textContent); }, [key, re.source], { timeout: 40000 });
  await page.waitForSelector('#syMine'); await msg('pull', /Всё актуально/);
  await page.fill('#sy-note', 'Первая загрузка'); await page.click('#sy-pub'); await msg('send', /Опубликовано: /);
  const docx = Buffer.concat([Buffer.from('PK\u0003\u0004'), Buffer.alloc(300, 5)]);
  ['ТТК №262 Картофель запеченый в горчичном соусе.docx', 'ТТК №296 Капуста цветная, запеченная в соусе 150гр.docx', 'ТТК №388 Суп гороховый 250 гр.docx', 'ТТК №180 Рис с овощами 150 гр.docx', 'ТТК №12 Гречка отварная с овощами 150гр.docx'].forEach(n => gs.gas.dropFile('reg:main', n, docx));
  await page.click('#tabCalc'); if (await page.locator('#tabCloud').count()) await page.click('#tabCloud'); await page.waitForSelector('#syCloud');
  await page.click('#syCloud [data-act="syFRefresh"]'); await page.waitForSelector('#syFRegs .ctile, #syFNav .ccp', { timeout: 20000 });
  await TT.cloudIn(page, 'main');
  await page.waitForFunction(() => document.querySelectorAll('#syFList .syrow').length === 5, null, { timeout: 20000 });
  await page.waitForSelector('#syFList .mchk');
  const T = await page.$$eval('#syFList .syrow', rows => Object.fromEntries(rows.map(r => [r.querySelector('b').textContent.replace(/^ТТК №([\d.]+) .*$/, '$1'), (r.querySelector('.mchk') || {}).textContent || ''])));
  console.log(JSON.stringify(T));
  assert.strictEqual(T['262'], '✓ В меню', 'запеченый / запеченный');
  assert.strictEqual(T['296'], '✓ В меню', 'соусе / соусом, другой порядок слов');
  assert.strictEqual(T['12'], '✓ В меню');
  assert.strictEqual(T['388'], 'Нет в базе', 'другое блюдо с тем же номером не склеивается: суп гороховый ≠ харчо');
  assert.strictEqual(T['180'], 'Нет в базе');
  assert.deepStrictEqual(errs, []);
  await browser.close(); gs.close && gs.close(); console.log('MENUSTEM OK'); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
