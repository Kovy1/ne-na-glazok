/* оповещение о новой версии приложения: гость, редактор, технолог; кнопка открывает ссылку; у технолога подсказка загрузить страницу */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert'), vm = require('vm');
const { startGas } = require('./sync/gasserver');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SRC = process.argv[2] || 'kbzhu.html';
const errs = [];
(async () => {
  const gs = await startGas();
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve(SRC);
  const E = 'ed-1234', A = 'adm-5678';
  const post = b => JSON.parse(gs.gas.post(Object.assign({ rid: 'rid-' + Math.random().toString(36).slice(2) + '-abcdef', by: 'Технолог' }, b)).text);
  vm.runInContext('setup()', gs.gas.ctx);
  const ing = (name, o) => Object.assign({ name, p: 1, f: 1, c: 1, kind: 'table', source: '' }, o);
  const rec = (name, output, sell) => ({ name, output, rows: [{ ing: 'i-aaa', in: 'Лук', net: 50, share: 100 }], ref: {}, ttk: {}, sell });
  assert.ok(post({ op: 'publish', code: A, items: [
    { kind: 'ing', sid: 'i-aaa', name: 'Лук', baseRev: 0, json: ing('Лук', { price: 130, priceUnit: 'kg', packG: 1000 }) },
    { kind: 'rec', sid: 'r-111', name: 'Суп с луком', baseRev: 0, json: rec('Суп с луком', 250, { main: 180 }) },
  ] }).ok);
  const SRV = 202611011200, OLD = 202610010000, NEW = 202612010000;
  const pageHtml = b => '<!doctype html><html><head><meta charset="utf-8"></head><body><script>window.KBZHU_SEED={};window.KBZHU_RELEASE=1;' + (b ? 'window.KBZHU_BUILD=' + b + ';' : '') + '</script>' + 'Борщ · '.repeat(9000) + '<script>var x=1;</script></body></html>';
  const putPage = b => assert.ok(post({ op: 'pagePut', code: A, html: pageHtml(b) }).ok);

  const mk = async build => {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    await ctx.addInitScript(([u, b]) => { window.KBZHU_URL = u; if (b) window.KBZHU_BUILD = b; }, [gs.url, build]);
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|net::ERR|Refused to execute/.test(m.text())) errs.push('console: ' + m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(url);
    await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('#view > *');
    return { ctx, page };
  };
  const bar = async page => page.evaluate(() => { const e = document.querySelector('#upBar'); return e && !e.hidden && getComputedStyle(e).display !== 'none' ? e.textContent.replace(/\s+/g, ' ').trim() : ''; });
  const login = async (page, code, name) => {
    await page.click('[data-act="gmLogin"]'); await page.waitForSelector('#syConn');
    await page.fill('#sy-name', name); await page.fill('#sy-code', code); await page.click('[data-act="syConnect"]');
    await page.waitForFunction(() => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && /Подключено/.test(e.textContent); }, null, { timeout: 30000 });
  };
  const waitBar = async (page, re, ms) => { const t0 = Date.now(); let b = ''; while (Date.now() - t0 < (ms || 12000)) { b = await bar(page); if (re.test(b)) return b; await sleep(300); } return b; };

  // ===== 0. на ссылке страницы ещё нет, или она без номера сборки: оповещений нет
  { const { ctx, page } = await mk(OLD); await page.waitForSelector('.gmrow'); await sleep(600);
    assert.strictEqual(await bar(page), '', 'страницы на ссылке нет: плашки нет'); await ctx.close(); }
  putPage(0);
  { const { ctx, page } = await mk(OLD); await page.waitForSelector('.gmrow'); await sleep(600);
    assert.strictEqual(await bar(page), '', 'страница без номера: плашки нет'); await ctx.close(); }
  console.log('0 OK');

  // ===== 1. технолог загрузил новую страницу
  putPage(SRV);

  // гость со старой версией: заметная плашка и кнопка
  { const { ctx, page } = await mk(OLD); await page.waitForSelector('.gmrow');
    const b = await waitBar(page, /Вышла новая версия/); console.log('гость:', b);
    assert.ok(/Вышла новая версия приложения/.test(b) && /Открыть новую версию/.test(b));
    if (process.env.SHOT) await page.screenshot({ path: 'out/app_banner.png' });
    assert.ok(await page.isVisible('#upBar [data-act="upApp"]'));
    const box = await page.locator('#upBar [data-act="upApp"]').boundingBox(); assert.ok(box.height >= 36 && box.width >= 120, 'кнопка крупная');
    const seen = []; ctx.on('request', r => seen.push(r.url()));
    const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('#upBar [data-act="upApp"]')]);
    await sleep(800); console.log('открылась:', seen.filter(u => /\/exec\?v=/.test(u)).join(' '));
    assert.ok(seen.some(u => u.startsWith(gs.url + '?v=' + SRV)), 'ссылка скрипта с номером версии');
    await pop.close();
    // после входа плашка остаётся (редактор)
    await login(page, E, 'Иван');
    const b2 = await waitBar(page, /Вышла новая версия/); assert.ok(/Вышла новая версия/.test(b2), 'у вошедшего редактора плашка есть: ' + b2);
    await page.click('[data-tab="menu"]'); await sleep(300);
    assert.ok(/Вышла новая версия/.test(await bar(page)), 'плашка видна на любой вкладке');
    await ctx.close(); }

  // гость с той же версией и с более новой: плашки нет
  for (const b of [SRV, NEW]) { const { ctx, page } = await mk(b); await page.waitForSelector('.gmrow'); await sleep(800);
    assert.strictEqual(await bar(page), '', 'версия ' + b + ' не старше ссылки: плашки нет'); await ctx.close(); }
  // файл без номера сборки (артефакт, исходник): плашки нет
  { const { ctx, page } = await mk(0); await page.waitForSelector('.gmrow'); await sleep(800); assert.strictEqual(await bar(page), ''); await ctx.close(); }
  console.log('1 OK');

  // ===== 2. технолог: версия новее ссылки → подсказка загрузить; старее → как у всех; одинаково → тихо
  { const { ctx, page } = await mk(NEW); await page.waitForSelector('.gmrow'); await login(page, A, 'Технолог');
    const b = await waitBar(page, /прежняя версия/); console.log('технолог:', b);
    assert.ok(/На ссылке лежит прежняя версия приложения/.test(b) && /Загрузить/.test(b) && !/Вышла новая/.test(b));
    await page.click('#upBar [data-act="upPg"]'); await page.waitForSelector('#pgBox'); await sleep(500);
    const pg = await page.innerText('#pgBox'); console.log('блок:', pg.replace(/\s+/g, ' ').slice(0, 500));
    assert.ok(/старше вашей/.test(pg), 'в блоке сказано, что на ссылке версия старше');
    assert.ok(await page.isVisible('#pgBox [data-act="pgPick"]'));
    // загрузка страницы технологом (серверным вызовом): плашка исчезает после следующей проверки
    putPage(NEW);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    const t0 = Date.now(); let g = await bar(page); while (/прежняя версия/.test(g) && Date.now() - t0 < 50000) { await sleep(1500); await page.evaluate(() => window.dispatchEvent(new Event('focus'))); g = await bar(page); }
    assert.ok(!/прежняя версия/.test(g), 'после загрузки плашки нет: ' + g);
    await ctx.close(); }
  putPage(SRV);
  { const { ctx, page } = await mk(OLD); await page.waitForSelector('.gmrow'); await login(page, A, 'Технолог');
    const b = await waitBar(page, /Вышла новая версия/); assert.ok(/Вышла новая версия/.test(b) && !/прежняя версия/.test(b), 'технолог на старой версии видит то же, что все: ' + b);
    await ctx.close(); }
  { const { ctx, page } = await mk(SRV); await page.waitForSelector('.gmrow'); await login(page, A, 'Технолог'); await sleep(7000);
    assert.strictEqual(await bar(page).then(x => /версия/.test(x)), false, 'версии равны: тихо');
    await page.click('[data-tab="sync"]'); await page.waitForSelector('#pgBox'); await sleep(600);
    assert.ok(/та же версия/.test(await page.innerText('#pgBox')), 'в блоке: та же версия'); await ctx.close(); }
  console.log('2 OK');

  assert.deepStrictEqual(errs, [], errs.join('; '));
  console.log('PWAPP OK'); await browser.close(); gs.close && gs.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
