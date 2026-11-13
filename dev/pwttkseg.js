// Одна вкладка «ТТК»: стартовый экран с двумя кнопками (создать новую / скачать из облака), возврат «‹ ТТК» и предпросмотр карты
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const TT = require('./tt');
const path = require('path'), vm = require('vm'), cp = require('child_process'), fs = require('fs'), os = require('os'), assert = require('assert');
const { startGas } = require('./sync/gasserver');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ref = { label: '', p: null, f: null, c: null, kcal: null, tol: 10, basis: '100' };
const seed = () => ({
  ings: { i3: { name: 'Картофель', p: 2, f: 0.4, c: 16, kind: 'table', source: '', price: 30 }, i4: { name: 'Говядина', p: 19, f: 12, c: 0, kind: 'table', source: '', price: 520 } },
  recipes: { r1: { name: 'Гуляш', output: 150, rows: [{ rid: 'a', ing: 'i4', net: 100, share: 100 }, { rid: 'b', ing: 'i3', net: 60, share: 100 }], ref, ttk: { num: '9', org: 'ООО «Кредо»', head: 'Директор', headName: 'Иванов И.И.', t42: 'Мясо нарезать кубиками и обжарить.\nДобавить картофель, тушить 40 минут.', look: 'Кусочки мяса', color: 'Коричневый', texture: 'Мягкая', taste: 'Мясной' } } },
  cfg: {},
});
(async () => {
  const gs = await startGas(); vm.runInContext('setup()', gs.gas.ctx);
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve('kbzhu.html');
  const errs = [];
  async function mk(W, code, data) {
    const ctx = await browser.newContext({ viewport: { width: W, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await p.goto(url);
    await p.evaluate(d => { localStorage.clear(); if (d) localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:tab', 'sync'); }, data);
    await p.reload(); await p.waitForSelector('#view > *');
    await p.click('#tabSync'); await p.waitForSelector('#syConn');
    await p.fill('#sy-url', gs.url); await p.fill('#sy-name', 'Тест'); await p.fill('#sy-code', code);
    await p.click('[data-act="syConnect"]');
    await p.waitForFunction(() => document.querySelector('#tabCalc').dataset.cloud === '1', null, { timeout: 30000 });
    await sleep(800);
    return p;
  }

  // 1. технолог: одна вкладка «ТТК», внутри два раздела
  const T = await mk(1280, 'adm-5678', seed());
  const rail = await T.$$eval('.tabs .tab:not([hidden])', a => a.map(x => x.textContent.trim().replace(/\s+·.*$/, '')));
  console.log('вкладки:', rail.join(' | '));
  assert.ok(rail.includes('ТТК') && !rail.some(x => /облаке/.test(x)), 'в шапке одна вкладка «ТТК»');
  assert.strictEqual(await T.locator('.tabs #tabCloud').count(), 0);
  await T.click('#tabCalc'); await T.waitForSelector('#ttkHome');
  assert.strictEqual(await T.locator('#tabCalc[aria-selected="true"]').count(), 1);
  assert.ok(/Создать новую/.test(await T.textContent('#ttkNew')) && /Скачать из облака/.test(await T.textContent('#tabCloud')), 'две кнопки на стартовом экране');
  assert.strictEqual(await T.locator('#recipeSel').count(), 0, 'выбора из сохранённых на стартовом экране нет');
  await T.click('#tabCloud'); await T.waitForSelector('#syCloud');
  assert.strictEqual(await T.locator('#tabCalc[aria-selected="true"]').count(), 1, 'вкладка «ТТК» остаётся выбранной в облаке');
  assert.strictEqual(await T.locator('#ttkSeg').count(), 1, 'возврат на стартовый экран есть и в облаке');
  await T.click('#segCalc'); await T.waitForSelector('#ttkHome');
  assert.strictEqual(await T.locator('#syCloud').count(), 0);
  await T.click('#ttkSavedLink'); await T.waitForSelector('#recipeSel');
  await T.selectOption('#recipeSel', 'r1'); await T.waitForSelector('#rname');
  assert.strictEqual(await T.locator('#recipeSel').count(), 0, 'в открытой карте списка сохранённых нет');
  console.log('1 OK: одна вкладка, стартовый экран');

  // 2. предпросмотр
  await T.click('[data-act="pvTtk"] >> nth=0'); await T.waitForSelector('#pvPage');
  assert.ok(await T.evaluate(() => document.querySelector('.wrap').inert === true), 'страница под окном недоступна');
  const txt = await T.innerText('#pvPage');
  ['УТВЕРЖДАЮ:', 'ТЕХНИКО-ТЕХНОЛОГИЧЕСКАЯ КАРТА № 9', '«Гуляш» 1/150гр.', 'Говядина', 'Картофель', 'Выход готового блюда', '4.2.1. Мясо нарезать кубиками и обжарить.', 'Иванов И.И.', 'Кусочки мяса', 'Калорийность, ккал'].forEach(x => assert.ok(txt.indexOf(x) > -1, 'в предпросмотре есть: ' + x));
  assert.strictEqual(await T.locator('#pvPage table').count(), 3);
  assert.strictEqual(await T.locator('#pvPage table:first-of-type td[rowspan="3"]').count(), 2, 'шапка таблицы рецептуры объединена по строкам');
  assert.strictEqual(await T.locator('#pvPage table:first-of-type td[colspan="4"]').count(), 1);
  const col = await T.evaluate(() => { const td = document.querySelector('#pvPage table:first-of-type tr:nth-child(5) td:nth-child(2)'); return getComputedStyle(td).color; });
  assert.strictEqual(col, 'rgb(0, 0, 0)', 'текст в таблицах чёрный на белом листе');
  // то же, что в скачанном файле
  const dlp = T.waitForEvent('download'); await T.click('#pvOv [data-pv="dl"]');
  await T.waitForSelector('dialog.dg[open]', { timeout: 5000 }).then(() => T.click('dialog.dg [data-act="dgGo"]'), () => {});   // v27: при подключённой общей базе сначала окно выбора юрлица
  const dl = await dlp;
  const f = path.join(os.tmpdir(), 'pv_' + Date.now() + '.docx'); await dl.saveAs(f);
  const xml = cp.execFileSync('unzip', ['-p', f, 'word/document.xml'], { maxBuffer: 1 << 26 }).toString('utf8');
  const docText = (xml.match(/<w:t[ >][^>]*>[^<]*|<w:t>[^<]*/g) || []).map(s => s.replace(/^<w:t[^>]*>/, '')).join('').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, '');
  assert.strictEqual(txt.replace(/\s+/g, ''), docText, 'предпросмотр совпадает с текстом скачиваемого файла');
  fs.unlinkSync(f);
  await T.keyboard.press('Escape'); await sleep(150);
  assert.strictEqual(await T.locator('#pvOv').count(), 0, 'Esc закрывает');
  assert.ok(await T.evaluate(() => !document.querySelector('.wrap').inert), 'страница снова доступна');
  console.log('2 OK: предпросмотр совпадает с файлом');

  // 3. правка видна в новом предпросмотре; кнопка есть и внизу карты
  await T.fill('#rname', 'Гуляш с подливой'); await sleep(200);
  await T.click('#secDl [data-act="pvTtk"]'); await T.waitForSelector('#pvPage');
  assert.ok(/«Гуляш с подливой»/.test(await T.innerText('#pvPage')), 'предпросмотр берёт текущие данные');
  await T.click('#pvOv [data-pv="close"]'); await sleep(150);
  assert.strictEqual(await T.locator('#pvOv').count(), 0);
  console.log('3 OK: текущие данные, закрытие кнопкой');

  // 4. пустая база: на стартовом экране «Создать новую» и «Скачать из облака», сохранённых карт нет
  const E = await mk(1280, 'ed-1234', null);
  await E.click('#tabCalc'); await E.waitForSelector('#ttkHome');
  assert.strictEqual(await E.locator('#ttkSavedLink').count(), 0, 'сохранённых карт нет: ссылки нет');
  await E.click('#tabCloud'); await E.waitForSelector('#syCloud');
  console.log('4 OK');

  // 5. телефон: лист предпросмотра целиком по ширине экрана
  const M = await mk(390, 'adm-5678', seed());
  await TT.openCalc(M);
  await M.click('[data-act="pvTtk"] >> nth=0'); await M.waitForSelector('#pvPage');
  const g = await M.evaluate(() => { const s = document.querySelector('.pvscroll'), f = document.querySelector('.pvfit'); return { sw: s.scrollWidth, cw: s.clientWidth, z: parseFloat(f.style.zoom) }; });
  console.log('телефон:', JSON.stringify(g));
  assert.ok(g.z < 0.6 && g.sw <= g.cw + 1, 'лист уменьшен под экран без горизонтальной прокрутки');
  console.log('5 OK');

  // 6. шеф-повар: расчёта нет, «ТТК» открывает облако
  const V = await mk(1280, 'view-3456', null);
  await TT.openCalc(V); await V.waitForSelector('#syCloud');
  assert.strictEqual(await V.locator('#ttkSeg').count(), 0, 'у шеф-повара переключателя нет');
  assert.strictEqual(await V.locator('#tabCalc[aria-selected="true"]').count(), 1);
  console.log('6 OK: шеф-повар');

  assert.deepStrictEqual(errs, [], 'ошибок страницы нет: ' + errs.join(' | '));
  await browser.close(); process.exit(0);
})().catch(e => { console.error('FAIL', e.message || e); process.exit(1); });
