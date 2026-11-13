const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SRC = process.argv[2] || 'kbzhu.html';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage(); const errs = [], reqs = [];
  page.on('pageerror', e => { if (!/Unexpected token '<'/.test(e.message)) errs.push(e.message); });
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|net::ERR|Refused to execute/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  // ---- имитация Google
  const table = { status: 'ok', table: { cols: [
    { id: 'A', label: 'Название' }, { id: 'B', label: 'Белки, г' }, { id: 'C', label: 'Жиры, г' }, { id: 'D', label: 'Углеводы, г' }, { id: 'E', label: 'Источник' }, { id: 'F', label: 'Ккал' }, { id: 'G', label: 'Тип данных' },
    { id: 'H', label: 'Потери: холодная обработка, %' }, { id: 'I', label: 'Потери: варка, %' }, { id: 'J', label: 'Потери: жарка, %' }, { id: 'K', label: 'Потери: тушение, %' }, { id: 'L', label: 'Потери: запекание, %' },
    { id: 'M', label: 'Синонимы' }, { id: 'N', label: 'Цена, ₽' }, { id: 'O', label: 'Цена за' }, { id: 'P', label: 'Масса упаковки, г' }, { id: 'Q', label: 'Позиция в прайсе' }],
    rows: [
      { c: [{ v: 'Говядина облачная' }, { v: 18.9, f: '18,9' }, { v: 12.4, f: '12,4' }, { v: 0, f: '0' }, { v: 'Google' }, { v: 190 }, { v: 'Справочник' }, { v: 0.2, f: '20%' }, null, null, null, null, null, { v: 520.5, f: '520,50 ₽' }, { v: 'кг' }, null, { v: 'Говядина охл.' }] },
      { c: [{ v: 'Молоко тест' }, { v: 3.2, f: '3,2' }, { v: 3.6, f: '3,6' }, { v: 4.8, f: '4,8' }, { v: 'Google' }, { v: 61 }, null, null, null, null, null, null, null, { v: 85.5, f: '85,5' }, { v: 'кг' }, null, null] },
    ] } };
  const jsonp = (url, body) => {
    const cb = decodeURIComponent(new URL(url).searchParams.get('tqx')).match(/responseHandler:([\w$]+)/)[1];
    return `/*O_o*/\n${cb}(${JSON.stringify(body)});`;
  };
  let mode = 'ok';
  await page.route('https://docs.google.com/spreadsheets/d/PUBLICID/gviz/tq*', route => {
    reqs.push(route.request().url());
    if (mode === 'ok') return route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: jsonp(route.request().url(), table) });
    if (mode === 'denied') return route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: jsonp(route.request().url(), { status: 'error', errors: [{ reason: 'access_denied', message: 'Access denied' }] }) });
    if (mode === 'login') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><body>Sign in</body></html>' });
    if (mode === 'empty') return route.fulfill({ status: 200, contentType: 'text/javascript', body: jsonp(route.request().url(), { status: 'ok', table: { cols: [], rows: [] } }) });
    return route.abort();
  });
  // опубликованный CSV: сервер отвечает без разрешения CORS
  await page.route('https://docs.google.com/spreadsheets/d/e/2PACX-TEST/pub*', route => { reqs.push(route.request().url()); route.fulfill({ status: 200, contentType: 'text/csv', body: 'a;b\n1;2' }); });

  // Playwright сам добавляет CORS-заголовки к подменённым ответам, поэтому отказ Google имитируем в самом fetch: обычный запрос отклоняется, запрос no-cors проходит
  await page.addInitScript(() => { const of = window.fetch; window.fetch = (u, o) => (String(u).includes('/spreadsheets/d/e/') && !(o && o.mode === 'no-cors')) ? Promise.reject(new TypeError('Failed to fetch')) : of(u, o); });
  await page.goto('file://' + path.resolve(SRC));
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('kbzhu:v1', JSON.stringify({ ings: { i1: { name: 'Молоко тест', p: 2.8, f: 3, c: 4.7, kind: 'table', source: 'старое', price: 70 } }, recipes: {}, cfg: {} }));
    localStorage.setItem('kbzhu:tab', 'base');
  });
  await page.reload(); await page.waitForSelector('#cloudCard');
  await page.click('#cloudCard > summary');
  const msg = async () => { await page.waitForFunction(() => { const e = document.querySelector('#cm-base'); return e && !e.hidden && !/Загружаю/.test(e.textContent); }); return page.textContent('#cm-base'); };

  // 1. обычная ссылка из адресной строки: данные приходят скриптом, CORS не нужен
  await page.fill('#cu-base', 'https://docs.google.com/spreadsheets/d/PUBLICID/edit?gid=0#gid=0');
  await page.click('[data-act="cLoad"][data-k="base"]');
  await page.waitForFunction(() => document.querySelector('#impText') && document.querySelector('#impText').value.length > 50);
  const txt = await page.$eval('#impText', e => e.value).then(v => v.split(/\r?\n/));
  console.log('rows:', txt.length, '|', txt[1]);
  assert.strictEqual(txt.length, 3);
  assert.ok(reqs[0].includes('gid=0') && reqs[0].includes('responseHandler:'), 'запрос содержит gid и имя функции: ' + reqs[0]);
  assert.ok(await page.$eval('#cm-base', e => /Получено строк: 3/.test(e.textContent)));
  await page.click('[data-act="doImport"]');
  await page.waitForFunction(() => /Добавлено: 1, обновлено: 1/.test(document.querySelector('#importMsg').textContent));
  await sleep(800);
  const I = await page.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:v1')).ings);
  const beef = Object.values(I).find(x => x.name === 'Говядина облачная'), milk = Object.values(I).find(x => x.name === 'Молоко тест');
  console.log('beef', JSON.stringify(beef)); console.log('milk', JSON.stringify(milk));
  assert.strictEqual(beef.price, 520.5); assert.strictEqual(beef.p, 18.9); assert.strictEqual(beef.loss.cold, 20, '«20%» из таблицы = 20 %'); assert.strictEqual(beef.kind, 'table');
  assert.strictEqual(milk.price, 85.5); assert.strictEqual(milk.source, 'Google');
  // служебная функция удалена
  assert.ok(await page.evaluate(() => !Object.keys(window).some(k => k.startsWith('__kbzhuGv'))), 'временная функция убрана');
  assert.ok(await page.evaluate(() => !document.querySelector('script[src*="gviz"]')), 'временный script убран');

  // 2. таблица закрыта: Google вернул ошибку доступа / страницу входа / пустую таблицу
  for (const [m, re] of [['denied', /Таблица не отдала данные/], ['login', /Таблица не отдала данные/], ['empty', /нет строк/]]) {
    mode = m;
    await page.fill('#cu-base', 'https://docs.google.com/spreadsheets/d/PUBLICID/edit#gid=0');
    await page.click('[data-act="cLoad"][data-k="base"]');
    const t = await msg(); console.log(m + ':', t); assert.ok(re.test(t), m);
    assert.ok(await page.$eval('[data-act="cLoad"][data-k="base"]', b => !b.disabled));
  }
  // 3. запрос не дошёл (сеть)
  mode = 'abort';
  await page.fill('#cu-base', 'https://docs.google.com/spreadsheets/d/PUBLICID/edit#gid=0'); await page.click('[data-act="cLoad"][data-k="base"]');
  const t3 = await msg(); console.log('abort:', t3); assert.ok(/не смогла обратиться/.test(t3));

  // 4. опубликованный CSV без CORS: подсказка про обычную ссылку
  await page.fill('#cu-base', 'https://docs.google.com/spreadsheets/d/e/2PACX-TEST/pub?gid=0&single=true&output=csv'); await page.click('[data-act="cLoad"][data-k="base"]');
  const t4 = await msg(); console.log('pub:', t4); assert.ok(/опубликованный CSV/.test(t4) && /из адресной строки/.test(t4));

  // 5. цены региона через прайс по обычной ссылке
  mode = 'ok';
  await page.fill('#cu-price', 'https://docs.google.com/spreadsheets/d/PUBLICID/edit#gid=0'); await page.click('[data-act="cLoad"][data-k="price"]');
  await page.waitForSelector('#priceCard');
  console.log('price rows:', await page.$$eval('#priceCard .trow:not(.thead) .tn', e => e.map(x => x.childNodes[0].textContent)).then(a => a.join(' | ')));

  // 6. автообновление при открытии через такую ссылку
  await page.evaluate(() => { const l = JSON.parse(localStorage.getItem('kbzhu:links')); l.main.base = 'https://docs.google.com/spreadsheets/d/PUBLICID/edit#gid=0'; l.main.auto = true; localStorage.setItem('kbzhu:links', JSON.stringify(l)); });
  await page.reload();
  await page.waitForFunction(() => /База обновлена по ссылке: добавлено 0, обновлено 2/.test(document.querySelector('#toast').textContent), null, { timeout: 8000 });
  console.log('toast:', await page.textContent('#toast'));

  assert.deepStrictEqual(errs, [], 'ошибки страницы: ' + errs.join('; '));
  console.log('PART 3 OK');
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
