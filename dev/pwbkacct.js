/* Копия на Диске закреплена за учётной записью: именной пользователь видит пометку, общий код — предупреждение;
   общий код не открывает копию именного пользователя, даже вписав его ФИО */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert'), vm = require('vm');
const { startGas } = require('./sync/gasserver');
const SRC = process.argv[2] || 'kbzhu.html';
const errs = [];
(async () => {
  const gs = await startGas();
  vm.runInContext('setup()', gs.gas.ctx);
  const post = b => JSON.parse(gs.gas.post(Object.assign({ rid: 'rid-' + Math.random().toString(36).slice(2) + '-abcdef' }, b)).text);
  const u = post({ op: 'usradd', code: 'adm-5678', by: 'Технолог', name: 'Петров П.П.', role: 'editor', own: false });
  assert.ok(u.ok, JSON.stringify(u));
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve(SRC);
  const data = n => ({ ings: { i1: { name: 'Сырьё ' + n, p: 1, f: 1, c: 1, kind: 'table', source: '', price: 10 } }, recipes: {}, cfg: {} });
  const mk = async name => {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } }); const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(name + ': ' + e.message));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.addInitScript(() => { window.KBZHU_BK_WAIT = 1200; });
    await page.goto(url);
    await page.evaluate(([d]) => { localStorage.clear(); localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:tab', 'sync'); }, [data(name)]);
    await page.reload(); await page.waitForSelector('#view > *');
    return page;
  };
  const connect = async (page, name, code) => {
    await page.fill('#sy-url', gs.url); await page.fill('#sy-name', name); await page.fill('#sy-code', code);
    await page.click('[data-act="syConnect"]');
    await page.waitForFunction(() => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && !/Проверяю|Читаю/.test(e.textContent); }, null, { timeout: 20000 });
  };
  const card = p => p.textContent('#bkBox').then(t => t.replace(/\s+/g, ' ').trim());

  // 1. именной редактор: пометка про учётную запись, копия сохраняется
  const N = await mk('named');
  await connect(N, 'Петров П.П.', u.code);
  await N.waitForSelector('#bkBox',{state:'attached'});
  let t = await card(N); assert.ok(/закреплена за вашей учётной записью/.test(t), t); assert.ok(!/общему коду/.test(t), t);
  await N.waitForFunction(() => /ещё нет|совпадают|push|правки/.test(document.querySelector('#bkStat').textContent), null, { timeout: 20000 });
  if (/ещё нет/.test(await N.textContent('#bkStat'))) await N.evaluate(() => document.querySelector('#bkBox [data-act="bkSaveNow"]').click());
  await N.waitForFunction(() => /совпадают/.test(document.querySelector('#bkStat').textContent), null, { timeout: 30000 });
  const mine = gs.gas.parseOut(gs.gas.get({ a: 'bkinfo', code: u.code, who: 'Петров П.П.', by: 'кто угодно' })).data;
  assert.strictEqual(mine.has, true, JSON.stringify(mine)); assert.strictEqual(mine.cur.by, 'Петров П.П.');
  console.log('1 OK: именной пользователь: пометка и копия за учётной записью');

  // 2. общий код редактора: предупреждение про общий код; копия Петрова ему недоступна
  const S = await mk('shared');
  await connect(S, 'Иванов И.И.', 'ed-1234');
  await S.waitForSelector('#bkBox',{state:'attached'});
  t = await card(S); assert.ok(/Вы вошли по общему коду/.test(t) && /именной доступ/.test(t) && !/закреплена за вашей/.test(t), t);
  const spoof = gs.gas.parseOut(gs.gas.get({ a: 'bkinfo', code: 'ed-1234', by: 'Петров П.П.' })).data;
  assert.strictEqual(spoof.ok, false); assert.strictEqual(spoof.err, 'named', JSON.stringify(spoof));
  const spoof2 = gs.gas.parseOut(gs.gas.get({ a: 'bkget', code: 'ed-1234', by: ' петров  п.п. ' })).data;
  assert.strictEqual(spoof2.err, 'named');
  console.log('2 OK: общий код: предупреждение; чужая копия не открывается');

  // 3. общий код с занятым именем: понятное сообщение вместо молчаливой подмены
  const S2 = await mk('shared2');
  await connect(S2, 'Петров П.П.', 'ed-1234');
  await S2.waitForSelector('#bkBox',{state:'attached'});
  await S2.waitForFunction(() => /занято именным доступом/.test(document.querySelector('#bkBox').textContent), null, { timeout: 20000 });
  console.log('3 OK:', (await card(S2)).slice(0, 220));

  assert.deepStrictEqual(errs, [], errs.join('\n'));
  await browser.close(); gs.close && gs.close();
  console.log('PWBKACCT OK'); process.exit(0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
