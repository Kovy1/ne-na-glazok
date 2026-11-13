/* пользователи с именным доступом: технолог создаёт — человек входит по ФИО и коду — при первом входе придумывает свой */
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
  const A = 'adm-5678';
  const mk = async (name) => {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } }); const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(name + ': ' + e.message + ' ' + String(e.stack || '').slice(0, 400)));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|net::ERR|Refused to execute/.test(m.text())) errs.push(name + ' console: ' + m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(url);
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('kbzhu:tab', 'sync'); });
    await page.reload(); await page.waitForSelector('#view > *');
    return page;
  };
  const connect = async (page, { name, code }, wait = /Подключено|Код не|Вы входите|Доступ|Слишком|Сначала/) => {
    await page.click('#tabSync'); await page.waitForSelector('#syConn');
    if (await page.locator('#sy-url').count()) await page.fill('#sy-url', gs.url);
    await page.fill('#sy-name', name); await page.fill('#sy-code', code);
    await page.click('[data-act="syConnect"]');
    await page.waitForFunction(re => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && new RegExp(re).test(e.textContent); }, wait.source, { timeout: 30000 });
    return page.textContent('#sym-conn');
  };
  vm.runInContext('setup()', gs.gas.ctx);
  const T = await mk('T');
  console.log('T:', await connect(T, { name: 'Технолог', code: A }));
  await T.waitForSelector('#syUsr'); await T.click('#syUsr > summary');
  await T.waitForSelector('#us-name');
  assert.ok(/Пользователи и коды доступа/.test(await T.textContent('#syUsr > summary')));

  // 1. технолог создаёт редактора: логин = ФИО, код из 5 цифр показывается один раз
  await T.fill('#us-name', 'Петров П.П.'); await T.selectOption('#us-role', 'editor');
  assert.strictEqual(await T.isChecked('#us-own'), true, 'по умолчанию человек задаёт свой код сам');
  await T.click('[data-act="usAdd"]'); await T.waitForSelector('.usmade');
  const made = (await T.textContent('.usmade')).replace(/\s+/g, ' ');
  const code = (await T.textContent('.usmade .uscode')).trim();
  assert.ok(/^\d{5}$/.test(code), 'код из 5 цифр: ' + code);
  assert.ok(/Логин: Петров П\.П\./.test(made) && /редактор/.test(made) && /один раз/.test(made), made);
  await T.waitForFunction(() => /Петров П\.П\./.test(document.querySelector('#syUsr .uslist')?.textContent || ''));
  assert.ok(/ждёт первого входа/.test(await T.textContent('#syUsr .uslist')), 'в списке: ждёт первого входа');
  // дубль
  await T.click('[data-act="usMadeHide"]'); await T.fill('#us-name', 'петров п.п'); await T.click('[data-act="usAdd"]');
  await T.waitForFunction(() => /уже есть/.test(document.querySelector('#syUsr')?.textContent || ''));
  console.log('1 OK: создан', code);

  // 2. человек входит: неверное ФИО и код не пускают; верные — просят придумать свой код
  const U = await mk('U');
  assert.ok(/Код не подходит/.test(await connect(U, { name: 'Иванов И.И.', code })), 'чужое ФИО');
  assert.ok(/Вы входите впервые/.test(await connect(U, { name: 'петров п п', code })), 'первый вход');
  await U.waitForSelector('#syFirst');
  assert.strictEqual(await U.locator('#sy-nc1').count(), 1);
  // слишком короткий и несовпадающий
  await U.fill('#sy-nc1', '12'); await U.fill('#sy-nc2', '12'); await U.click('[data-act="syFirst"]');
  await U.waitForFunction(() => /не короче 4/.test(document.querySelector('#sym-conn')?.textContent || ''));
  await U.fill('#sy-nc1', 'мойкод55'); await U.fill('#sy-nc2', 'мойкод56'); await U.click('[data-act="syFirst"]');
  await U.waitForFunction(() => /не совпали/.test(document.querySelector('#sym-conn')?.textContent || ''));
  await U.fill('#sy-nc1', 'мойкод55'); await U.fill('#sy-nc2', 'мойкод55'); await U.click('[data-act="syFirst"]');
  await U.waitForFunction(() => /Подключено: редактор/.test(document.querySelector('#sym-conn')?.textContent || ''), null, { timeout: 30000 });
  await U.waitForFunction(() => !document.querySelector('#syFirst'), null, { timeout: 10000 });
  assert.strictEqual(await U.locator('#syFirst').count(), 0);
  assert.strictEqual(await U.inputValue('#sy-name'), 'Петров П.П.', 'ФИО подставлено так, как ввёл технолог');
  assert.strictEqual(await U.locator('#syUsr').count(), 0, 'раздела «Пользователи» у редактора нет');
  assert.strictEqual(await U.locator('#syMyCode').count(), 1, 'есть «Сменить мой код»');
  await U.context().close();      // страница закрыта: дальше её код всё равно перестанет подходить
  console.log('2 OK');

  // 3. выданный код больше не работает, новый работает после перезагрузки
  const U2 = await mk('U2');
  assert.ok(/Код не подходит/.test(await connect(U2, { name: 'Петров П.П.', code })), 'выданный код погашен');
  assert.ok(/Подключено: редактор/.test(await connect(U2, { name: 'Петров П.П.', code: 'мойкод55' }, /Подключено|Код не/)));
  // смена кода в кабинете
  await U2.click('#syMyCode > summary');
  await U2.fill('#sy-nc1', 'новыйкод9'); await U2.fill('#sy-nc2', 'новыйкод9');
  await U2.click('[data-act="syMyCode"]');
  await U2.waitForFunction(() => /Код изменён/.test(document.querySelector('#sym-conn')?.textContent || ''), null, { timeout: 30000 });
  const U3 = await mk('U3');
  assert.ok(/Код не подходит/.test(await connect(U3, { name: 'Петров П.П.', code: 'мойкод55' })));
  assert.ok(/Подключено: редактор/.test(await connect(U3, { name: 'Петров П.П.', code: 'новыйкод9' }, /Подключено|Код не/)));
  console.log('3 OK');

  // 4. технолог: отключить, включить, новый код, права, удалить
  await T.evaluate(() => { const d = document.querySelector('#syUsr'); if (d && !d.open) d.open = true; });
  await T.click('[data-act="usReload"]').catch(() => {});
  await T.waitForSelector('#syUsr .uslist .syrow');
  await T.click('#syUsr .syrow [data-act="usOff"]');
  await T.waitForFunction(() => /отключён/.test(document.querySelector('#syUsr .uslist')?.textContent || ''));
  const U4 = await mk('U4');
  assert.ok(/отключён/.test(await connect(U4, { name: 'Петров П.П.', code: 'новыйкод9' }, /отключён|Код не|Подключено/)), 'отключённого не пускает');
  await T.click('#syUsr .syrow [data-act="usOff"]');
  await T.waitForFunction(() => /активен/.test(document.querySelector('#syUsr .uslist')?.textContent || ''));
  await T.selectOption('#syUsr .syrow select[data-act="usRole"]', 'viewer');
  await T.waitForFunction(() => /шеф-повар/.test(document.querySelector('#syUsr .uslist .tstat')?.textContent || ''));
  await T.click('#syUsr .syrow [data-act="usReset"]'); await T.click('#syUsr .syrow [data-act="usReset"]');   // второе нажатие подтверждает
  await T.waitForSelector('.usmade');
  const code2 = (await T.textContent('.usmade .uscode')).trim(); assert.ok(/^\d{5}$/.test(code2));
  await T.click('#syUsr .syrow [data-act="usDel"]'); await T.click('#syUsr .syrow [data-act="usDel"]');
  await T.waitForFunction(() => /Пока никого нет/.test(document.querySelector('#syUsr')?.textContent || ''));
  console.log('4 OK');

  // 5. общие коды как раньше, с любым именем
  const S2 = await mk('S2');
  assert.ok(/Подключено: редактор/.test(await connect(S2, { name: 'Любое Имя', code: 'ed-1234' })));
  assert.strictEqual(await S2.locator('#syMyCode').count(), 0, 'у общего кода «Сменить мой код» нет');

  if (errs.length) { console.log('ERRORS:\n' + errs.join('\n')); process.exit(1); }
  console.log('PWUSERS OK');
  await browser.close(); process.exit(0);
})().catch(e => { console.error('FAIL', e); console.log(errs.join('\n')); process.exit(1); });
