/* v26: выбор юридического лица перед скачиванием документа: подстановка только в файл, память «пользователь + точка», предпросмотр */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert'), vm = require('vm'), fs = require('fs'), cp = require('child_process');
const { startGas } = require('./sync/gasserver');
const SRC = process.argv[2] || 'kbzhu.html';
const errs = [];
(async () => {
  const gs = await startGas({ rs: { editor: ['main'], finance: ['msk'], viewer: ['main', 'msk'], audit: ['main'] } });
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve(SRC), A = 'adm-5678', E = 'ed-1234';
  vm.runInContext('setup()', gs.gas.ctx);
  const mk = async (name, w = 1200) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, acceptDownloads: true }); const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(name + ': ' + e.message + ' ' + String(e.stack || '').slice(0, 400)));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|net::ERR|Refused to execute/.test(m.text())) errs.push(name + ' console: ' + m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(url);
    await page.evaluate(() => {
      localStorage.clear(); localStorage.setItem('kbzhu:tab', 'sync');
      const d = { ings: { i1: { name: 'Свёкла', p: 1.5, f: 0.1, c: 8.8, kind: 'table', source: '', price: 30, priceUnit: 'kg' } }, recipes: { t0: { name: 'Борщ', output: 250, rows: [{ ing: 'i1', net: 100, rid: 'q0' }], ref: {} } }, cfg: {} };
      localStorage.setItem('kbzhu:v1', JSON.stringify(d));
    });
    await page.reload(); await page.waitForSelector('#view > *');
    return page;
  };
  const connect = async (page, { name, code }) => {
    await page.click('#tabSync'); await page.waitForSelector('#syConn');
    if (await page.locator('#sy-url').count()) await page.fill('#sy-url', gs.url);
    await page.fill('#sy-name', name); await page.fill('#sy-code', code);
    await page.click('[data-act="syConnect"]');
    await page.waitForFunction(() => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && /Подключено|не подходит|Не удалось/.test(e.textContent); }, null, { timeout: 30000 });
  };
  const docOf = (p) => cp.execFileSync('python3', ['-I', '-c', 'import zipfile,sys;print(zipfile.ZipFile(sys.argv[1]).read("word/document.xml").decode("utf-8"))', p], { maxBuffer: 1 << 26 }).toString();
  const newLe = async (T, name, org, head) => {
    await T.click('[data-act="drSub"][data-sub="le"]'); await T.click('[data-act="drNew"]'); await T.waitForSelector('#drEd');
    await T.fill('#drEd [data-k="name"]', name); await T.fill('#drEd [data-k="org"]', org); await T.fill('#drEd [data-k="headName"]', head);
    await T.click('[data-act="drSave"]'); await T.waitForFunction(() => !document.querySelector('#drEd'));
  };
  const T = await mk('T'); await connect(T, { name: 'Технолог', code: A });
  await T.click('#tabDir'); await T.waitForSelector('#drView');
  await newLe(T, 'Ромашка', 'ООО «Ромашка»', 'Иванов И.И.');
  await newLe(T, 'Лютик', 'ООО «Лютик»', 'Петров П.П.');
  await T.click('[data-act="drSub"][data-sub="pt"]'); await T.click('[data-act="drNew"]'); await T.waitForSelector('#drEd');
  await T.fill('#drEd [data-k="name"]', 'Столовая Центр'); await T.selectOption('#drEd select[data-k="region"]', 'main');
  await T.selectOption('#drEd select[data-k="le"]', { label: 'Ромашка — ООО «Ромашка»' });
  await T.click('[data-act="drSave"]'); await T.waitForFunction(() => !document.querySelector('#drEd') && /Столовая Центр/.test(document.querySelector('#drTbl')?.textContent || ''));
  console.log('1 OK: справочник наполнен');

  // 2. верхняя строка: точка и пользователь видны
  assert.ok(await T.isVisible('#pointBox'), 'выбор точки в верхней строке');
  assert.ok(/Технолог/.test(await T.textContent('#whoBox')), 'пользователь в верхней строке');
  await T.selectOption('#pointSel', { label: 'Столовая Центр' });

  // 3. скачивание из меню: окно выбора, по умолчанию юрлицо точки, предпросмотр
  const ttk0 = await T.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('kbzhu:v1')).recipes));
  await T.click('#tabMenu'); await T.waitForSelector('.mrow [data-act="mDl"]');
  await T.click('.mrow [data-act="mDl"]'); await T.waitForSelector('dialog.dg[open]');
  assert.ok(/Ромашка/.test(await T.textContent('dialog.dg .hdrprev')), 'предпросмотр: юрлицо точки');
  assert.strictEqual(await T.inputValue('dialog.dg [data-act="dgLe"] >> nth=0').catch(() => ''), await T.locator('dialog.dg [data-act="dgLe"] option:checked').getAttribute('value'));
  await T.selectOption('dialog.dg [data-act="dgLe"]', { label: 'Лютик — ООО «Лютик»' });
  assert.ok(/Лютик/.test(await T.textContent('dialog.dg .hdrprev')) && /Петров/.test(await T.textContent('dialog.dg .hdrprev')), 'предпросмотр меняется');
  let [dl] = await Promise.all([T.waitForEvent('download'), T.click('dialog.dg [data-act="dgGo"]')]);
  let doc = docOf(await dl.path());
  assert.ok(/Лютик/.test(doc) && /Петров/.test(doc), 'в файле реквизиты Лютика');
  assert.strictEqual(await T.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('kbzhu:v1')).recipes)), ttk0, 'исходная ТТК не изменилась');
  console.log('3 OK: юрлицо подставлено в файл, карта не изменилась');

  // 4. запомнено для «пользователь + точка»
  await T.click('.mrow [data-act="mDl"]'); await T.waitForSelector('dialog.dg[open]');
  assert.ok(/Лютик/.test(await T.textContent('dialog.dg .hdrprev')), 'выбор запомнен');
  [dl] = await Promise.all([T.waitForEvent('download'), T.click('dialog.dg [data-act="dgGo"]')]); await dl.path();
  // отмена не скачивает и не меняет
  await T.click('.mrow [data-act="mDl"]'); await T.waitForSelector('dialog.dg[open]'); await T.click('dialog.dg [data-act="dgNo"]');
  assert.strictEqual(await T.locator('dialog.dg[open]').count(), 0);
  // «как записано в карте»
  await T.click('.mrow [data-act="mDl"]'); await T.waitForSelector('dialog.dg[open]');
  await T.selectOption('dialog.dg [data-act="dgLe"]', ''); [dl] = await Promise.all([T.waitForEvent('download'), T.click('dialog.dg [data-act="dgGo"]')]);
  doc = docOf(await dl.path()); assert.ok(!/Лютик/.test(doc), 'без подстановки реквизитов нет');
  console.log('4 OK: память выбора, отмена, «как в карте»');

  // 5. другой пользователь: чужая память не подставляется
  const M = await mk('M'); await connect(M, { name: 'Редактор', code: E });
  await M.click('#tabMenu'); await M.waitForSelector('.mrow [data-act="mDl"]');
  await M.click('.mrow [data-act="mDl"]'); await M.waitForSelector('dialog.dg[open]');
  assert.strictEqual(await M.locator('dialog.dg [data-act="dgPt"]').count(), 1);
  assert.ok(!/Лютик/.test(await M.textContent('dialog.dg .hdrprev')), 'у другого пользователя нет чужого выбора');
  await M.selectOption('dialog.dg [data-act="dgPt"]', { label: 'Столовая Центр' });
  assert.ok(/Ромашка/.test(await M.textContent('dialog.dg .hdrprev')), 'по умолчанию юрлицо точки');
  await M.click('dialog.dg [data-act="dgNo"]');
  console.log('5 OK: пользователи не видят выбор друг друга');

  assert.deepStrictEqual(errs, [], errs.join('\n'));
  console.log('OK'); await browser.close(); gs.close && gs.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
