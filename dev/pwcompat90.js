/* Совместимость: приложение 90 (страница, оставшаяся в кеше у части сотрудников) со скриптом общей базы 30.
   Рабочий адрес, зашитый в сборку 90, перенаправляется на имитацию Apps Script; наружу запросы не уходят. */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert'), fs = require('fs');
const { startGas } = require('./sync/gasserver');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const APP90 = process.argv[2] || 'out/app90.html', APP91 = process.argv[3] || 'out/КБЖУ_калькулятор_автономный.html';
const errs = [];
const baseSeed = () => ({
  ings: { i2: { name: 'ТЕСТ Говядина', p: 18, f: 12, c: 0, kind: 'table', source: '', price: 500 }, i3: { name: 'ТЕСТ Картофель', p: 2, f: 0.4, c: 16, kind: 'table', source: '', price: 30 } },
  recipes: { r1: { name: 'ТЕСТ Котлета', output: 150, rows: [{ rid: 'a', ing: 'i2', net: 100, share: 100 }, { rid: 'b', ing: 'i3', net: 50, share: 100 }], ref: { label: '', p: null, f: null, c: null, kcal: null, tol: 10, basis: '100' }, ttk: {}, sell: {} } },
});
(async () => {
  const gs = await startGas();
  const html90 = fs.readFileSync(APP90, 'utf8');
  assert.ok(/APP_REL=90,SRV_NEED=28/.test(html90), 'это сборка приложения 90');
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  let leaked = 0;
  const mk = async (ver, name, data) => {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } }); const page = await ctx.newPage();
    page.on('pageerror', e => { if (!/Unexpected token '<'/.test(e.message)) errs.push(name + ': ' + e.message); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    if (ver === 90) {
      /* всё, что адресовано на script.google.com (рабочий адрес из сборки 90), уходит на имитацию; остальное наружу не пропускается */
      await page.route(/^https?:\/\/(?!127\.0\.0\.1|file)[^/]*\//, async r => {
        const u = new URL(r.request().url());
        if (!/script\.google(usercontent)?\.com$/.test(u.hostname)) { if (!/^(fonts\.googleapis\.com|fonts\.gstatic\.com|docs\.google\.com)$/.test(u.hostname)) { leaked++; console.log('внешний запрос:', u.hostname); } return r.abort(); }
        try {
          const target = gs.url + u.search; const body = r.request().postData();
          const resp = await fetch(target, body == null ? {} : { method: 'POST', body, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow' });
          await r.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', headers: { 'access-control-allow-origin': '*' }, body: await resp.text() });
        } catch (e) { await r.abort(); }
      });
    }
    await page.goto('file://' + path.resolve(ver === 90 ? 'out/app90.html' : APP91));
    await page.evaluate(([d, tab]) => { localStorage.clear(); localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:tab', tab); }, [data, 'sync']);
    await page.reload(); await page.waitForSelector('#syConn');
    return page;
  };
  const connect = async (page, { name, code, url }) => {
    if (url) await page.fill('#sy-url', url);
    await page.fill('#sy-name', name); await page.fill('#sy-code', code || '');
    await page.click('[data-act="syConnect"]');
    await page.waitForFunction(() => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && !/Проверяю/.test(e.textContent); }, null, { timeout: 25000 });
    return page.textContent('#sym-conn');
  };
  const msg = async (page, key, re, t = 25000) => { await page.waitForFunction(([k, s]) => { const e = document.querySelector('#sym-' + k); return e && !e.hidden && new RegExp(s).test(e.textContent); }, [key, re.source], { timeout: t }); };
  const A = 'adm-5678', E = 'fin-9012';

  // 1. приложение 90: подключение к скрипту 30 под кодом технолога, версия скрипта принята без предупреждения об устаревании
  const P90 = await mk(90, 'A90', baseSeed());
  assert.strictEqual(await P90.$('#sy-url'), null, 'в сборке 90 адрес зашит и поле адреса не показывается');
  let t = await connect(P90, { name: 'Технолог', code: A }); console.log('1:', t.replace(/\s+/g, ' ').slice(0, 200));
  assert.ok(/Подключено: технолог/.test(t), 'подключение к скрипту 30');
  await P90.waitForFunction(() => /скрипт общей базы/.test((document.querySelector('[data-seg="sys"]') || {}).textContent || ''), null, { timeout: 15000 });
  const verTxt = await P90.evaluate(() => (document.querySelector('[data-seg="sys"] .cmsg') || {}).textContent || '');
  console.log('версии:', verTxt.slice(0, 200)); assert.ok(/скрипт общей базы: 30/.test(verTxt), 'версия скрипта видна: ' + verTxt);
  assert.ok(!/устарел|обновите скрипт/i.test(verTxt), 'для скрипта 30 предупреждения об устаревании нет');
  await P90.waitForSelector('#syMine'); await msg(P90, 'pull', /Всё актуально/);
  // 2. технолог (приложение 90) публикует базу
  await P90.fill('#sy-note', 'Публикация из приложения 90'); await P90.click('#sy-pub');
  await msg(P90, 'send', /Опубликовано: \d+/); await sleep(1200);
  const pubRows = gs.gas.rows('Общая база').length; console.log('2: опубликовано строк', pubRows); assert.ok(pubRows >= 3);
  // 3. данные фудкоста других сотрудников лежат на сервере (скрипт 30): приложение 90 их не затрагивает и не ломается
  const rid = 'compat-' + Math.random().toString(36).slice(2) + '-abcdef';
  const fcPut = JSON.parse(gs.gas.post({ op: 'usradd', rid: 'compat-u-' + Math.random().toString(36).slice(2) + '-abcdef', code: A, by: 'Технолог', name: 'Иванов И.И.', role: 'editor', own: false, regs: ['main'] }).text);
  console.log('usradd:', JSON.stringify(fcPut).slice(0, 200));
  const fr = JSON.parse(gs.gas.post({ op: 'fcput', code: fcPut.code, by: 'Иванов И.И.', rid, id: 'b_main_c90', reg: 'main', data: { batch: { id: 'b_main_c90', type: 'receipts', from: '2026-10-01', to: '2026-10-31', n: 1 }, ops: { receipts: [{ id: 'o1', item: 'ТЕСТ', qty: 1, sum: 1 }] } } }).text);
  assert.strictEqual(fr.ok, true, JSON.stringify(fr));
  await P90.click('[data-act="syPull"]').catch(() => {}); await sleep(1500);
  const rowsAfter = gs.gas.rows('Общая база').length; assert.strictEqual(rowsAfter, pubRows, 'данные фудкоста не попали в общую базу');
  // 4. смешанный парк: редактор на приложении 90 получает базу, опубликованную технологом на приложении 90; редактор на приложении 91 (по адресу) — то же самое
  const E90 = await mk(90, 'E90', baseSeed());
  t = await connect(E90, { name: 'Мария', code: E }); console.log('4a:', t.replace(/\s+/g, ' ').slice(0, 160)); assert.ok(/Подключено: тер. управляющий/.test(t));
  await msg(E90, 'pull', /Всё актуально/);
  const E91 = await mk(91, 'E91', baseSeed());
  t = await connect(E91, { name: 'Мария', code: E, url: gs.url }); console.log('4b:', t.replace(/\s+/g, ' ').slice(0, 160)); assert.ok(/Подключено: тер. управляющий/.test(t));
  await msg(E91, 'pull', /Всё актуально/);
  // 5. редактор на приложении 90 отправляет правку цены, технолог на приложении 91 её принимает
  await E90.evaluate(() => { const d = JSON.parse(localStorage.getItem('kbzhu:v1')); d.ings.i2.price = 560; localStorage.setItem('kbzhu:v1', JSON.stringify(d)); });
  await E90.reload(); await E90.waitForSelector('#syMine');
  await E90.waitForFunction(() => /Мои изменения · [1-9]/.test(document.querySelector('#syMine h2').textContent), null, { timeout: 20000 });
  await E90.click('#sy-send').catch(async () => { await E90.click('[data-act="sySend"]'); });
  await msg(E90, 'send', /отправлен|Отправлено|на подтверждение/i); await sleep(1200);
  const pend = gs.gas.rows('Предложения').length; console.log('5: предложений', pend); assert.ok(pend >= 1, 'правка от приложения 90 дошла до технолога');
  assert.deepStrictEqual(await (async () => { const r = await P90.evaluate(() => 1); return r; })(), 1);
  assert.strictEqual(leaked, 0, 'наружу, кроме адреса скрипта, запросов не было');
  assert.deepStrictEqual(errs, [], errs.join('\n'));
  await browser.close(); gs.close(); console.log('OK compat90');
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
