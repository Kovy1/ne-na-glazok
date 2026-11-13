/* v27: пустой справочник и повторные скачивания. (v26: выбор юридического лица перед скачиванием документа: подстановка только в файл, память «пользователь + точка», предпросмотр */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert'), vm = require('vm'), fs = require('fs'), cp = require('child_process');
const { startGas } = require('./sync/gasserver');
const SRC = process.argv[2] || 'kbzhu.html';
const errs = [];
(async () => {
  const gs = await startGas({ rs: { editor: ['main'], finance: ['msk'], viewer: ['main', 'msk'], audit: ['main'] } });
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const gsRef = { cur: gs };
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
    if (await page.locator('#sy-url').count()) await page.fill('#sy-url', gsRef.cur.url);
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
  const dlOpen = async (P) => { await P.click('#tabMenu'); await P.waitForSelector('.mrow [data-act="mDl"]'); await P.click('.mrow [data-act="mDl"]'); await P.waitForSelector('dialog.dg[open]'); };
  // 1. технолог, справочник пуст: окно открывается, есть создание
  const T = await mk('T'); await connect(T, { name: 'Технолог', code: A });
  await dlOpen(T);
  assert.ok(/В справочнике нет юридических лиц/.test(await T.textContent('dialog.dg')), 'сказано, что справочник пуст');
  await T.click('dialog.dg [data-act="dgMkOpen"]');
  await T.fill('dialog.dg [data-k="name"]', 'Василёк'); await T.fill('dialog.dg [data-k="org"]', 'ООО «Василёк»'); await T.fill('dialog.dg [data-k="headName"]', 'Козлов К.К.');
  await T.click('dialog.dg [data-act="dgMkSave"]');
  await T.waitForFunction(() => /Василёк/.test(document.querySelector('dialog.dg .hdrprev')?.textContent || ''), null, { timeout: 15000 });
  assert.ok(/Василёк/.test(await T.locator('dialog.dg [data-act="dgLe"] option:checked').textContent()), 'созданное юрлицо выбрано');
  let [dl] = await Promise.all([T.waitForEvent('download'), T.click('dialog.dg [data-act="dgGo"]')]);
  let doc = docOf(await dl.path()); assert.ok(/Василёк/.test(doc) && /Козлов/.test(doc), 'в файле реквизиты созданного юрлица');
  const after = await T.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('kbzhu:v1')).recipes)); assert.ok(!/Василёк/.test(after), 'исходная ТТК не изменилась');
  console.log('1 OK: пустой справочник → создано юрлицо → оно в скачанном файле, карта прежняя');
  // 2. повторное скачивание подряд: окно снова открывается, юрлицо уже в справочнике
  await dlOpen(T);
  assert.ok(/Василёк/.test(await T.textContent('dialog.dg [data-act="dgLe"]')), 'юрлицо теперь в справочнике');
  assert.strictEqual(await T.locator('dialog.dg [data-act="dgMkOpen"]').count(), 0);
  await T.selectOption('dialog.dg [data-act="dgLe"]', { label: 'Василёк — ООО «Василёк»' });
  [dl] = await Promise.all([T.waitForEvent('download'), T.click('dialog.dg [data-act="dgGo"]')]); doc = docOf(await dl.path()); assert.ok(/Козлов/.test(doc));
  await dlOpen(T); await T.selectOption('dialog.dg [data-act="dgLe"]', ''); [dl] = await Promise.all([T.waitForEvent('download'), T.click('dialog.dg [data-act="dgGo"]')]);
  doc = docOf(await dl.path()); assert.ok(!/Козлов/.test(doc), 'повторно с другим выбором — реквизиты другие');
  console.log('2 OK: повторные скачивания подряд: окно каждый раз, выбор действует на каждый файл');

  // 3. другой сервер с пустым справочником: редактор не создаёт, но выбирает сохранённую шапку
  const gs2 = await startGas({ rs: { editor: ['main'], finance: ['msk'], viewer: ['main', 'msk'], audit: ['main'] } }); vm.runInContext('setup()', gs2.gas.ctx);
  gsRef.cur = gs2;
  const M = await mk('M'); await M.evaluate(() => localStorage.setItem('kbzhu:ttkhdrs', JSON.stringify([{ org: 'ООО «Сохранённая»', head: 'Директор', headName: 'Сидоров С.С.' }])));
  await connect(M, { name: 'Редактор', code: E });
  await dlOpen(M);
  assert.ok(/нет юридических лиц/.test(await M.textContent('dialog.dg')) && /добавляет технолог/.test(await M.textContent('dialog.dg')));
  assert.strictEqual(await M.locator('dialog.dg [data-act="dgMkOpen"]').count(), 0, 'без прав создания нет');
  await M.selectOption('dialog.dg [data-act="dgLe"]', { label: 'ООО «Сохранённая» — Директор Сидоров С.С.' });
  assert.ok(/Сохранённая/.test(await M.textContent('dialog.dg .hdrprev')));
  [dl] = await Promise.all([M.waitForEvent('download'), M.click('dialog.dg [data-act="dgGo"]')]); doc = docOf(await dl.path());
  assert.ok(/Сохранённая/.test(doc) && /Сидоров/.test(doc), 'в файле сохранённая шапка');
  console.log('3 OK: редактор: справочник пуст → сохранённая шапка попала в файл');

  assert.deepStrictEqual(errs, [], errs.join('\n'));
  console.log('OK'); await browser.close(); gs.close && gs.close(); gs2.close && gs2.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
