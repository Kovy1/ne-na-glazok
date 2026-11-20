/* «Что изменилось»: один показ, роль, не перекрывает ввод, первый пользователь без истории, синхронизация по имени между устройствами */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert'), vm = require('vm');
const { startGas } = require('./sync/gasserver');
const SRC = process.argv[2] || 'out/КБЖУ_калькулятор_автономный.html';
const errs = [];
const REL = (require('fs').readFileSync(SRC, 'utf8').match(/APP_REL=(\d+)/) || [])[1], RELRE = new RegExp('=' + REL + '$');
(async () => {
  const gs = await startGas();
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve(SRC), A = 'adm-5678';
  vm.runInContext('setup()', gs.gas.ctx);
  const post = b => JSON.parse(gs.gas.post(Object.assign({ rid: 'rid-' + Math.random().toString(36).slice(2) + '-abcdef' }, b)).text);
  const mk = async (name, pre) => {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } }); const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(name + ': ' + e.message));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(url);
    await page.evaluate(p => { localStorage.clear(); if (p !== 'fresh') localStorage.setItem('kbzhu:tab', 'sync'); }, pre || '');
    if (pre !== 'fresh') { await page.reload(); } else { await page.reload(); await page.evaluate(() => localStorage.removeItem('kbzhu:tab')); }
    await page.waitForSelector('#view > *');
    return page;
  };
  const connect = async (page, { name, code }) => {
    await page.click('#tabSync'); await page.waitForSelector('#syConn');
    if (await page.locator('#sy-url').count()) await page.fill('#sy-url', gs.url);
    await page.fill('#sy-name', name); await page.fill('#sy-code', code);
    await page.click('[data-act="syConnect"]');
    await page.waitForFunction(() => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && /Подключено/.test(e.textContent); }, null, { timeout: 30000 });
  };
  const shown = p => p.evaluate(() => { window.kbzhuRel.tick(); const b = document.querySelector('#relBar'); return b && !b.hidden ? b.innerText : ''; });
  const waitShown = async p => { await p.waitForFunction(() => { window.kbzhuRel.tick(); const b = document.querySelector('#relBar'); return b && !b.hidden && /Что изменилось/.test(b.innerText); }, null, { timeout: 15000 }); return shown(p); };
  const key = p => p.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf('kbzhu:rel:') === 0).map(k => k + '=' + localStorage.getItem(k)));

  // 1. первый пользователь (пустой браузер): прежняя история не показывается, ознакомление записано
  const F = await mk('F', 'fresh');
  assert.strictEqual(await shown(F), '', 'первому пользователю окна нет');
  assert.ok((await key(F)).some(k => RELRE.test(k)), 'отметка выпуска записана: ' + await key(F));
  console.log('1 OK');

  // 2. прежний пользователь без отметки: видит только выпуск 91, роль «технолог» видит и действие по скрипту
  const L = await mk('L');
  const t = await waitShown(L); console.log(t.replace(/\s+/g, ' ').slice(0, 300));
  assert.ok(/Версия 91/.test(t) && !/Версия 90/.test(t) && !/Версия 89/.test(t), 'только непрочитанные выпуски журнала (с 91)');
  assert.ok(new RegExp('Установлена версия ' + REL).test(t), 'сказано, что версия установлена');
  assert.ok(/Понятно/.test(t) && /Вся история/.test(t));
  assert.ok(/обновите скрипт общей базы до версии 30/.test(t), 'технолог видит действие по скрипту');
  // не перекрывает ввод: поле в фокусе — окно не появляется заново
  await L.click('[data-rel="ok"]');
  assert.strictEqual(await shown(L), '', 'после «Понятно» окна нет');
  assert.ok((await key(L)).some(k => RELRE.test(k)));
  await L.reload(); await L.waitForSelector('#view > *'); await L.waitForTimeout(300);
  assert.strictEqual(await shown(L), '', 'после перезагрузки не повторяется');
  // полная история доступна и после ознакомления
  await L.click('#relFoot [data-rel="all"]'); const all = await L.textContent('#relBar');
  assert.ok(/Версия 91/.test(all) && /Версия 90/.test(all) && /Версия 89/.test(all), 'полная история'); await L.click('#relBar [data-rel="close"]');
  console.log('2 OK');

  // 3. ввод не прерывается
  const I = await mk('I');
  await I.evaluate(() => { const i = document.createElement('input'); i.id = 'tmpIn'; document.body.appendChild(i); i.focus(); });
  assert.strictEqual(await shown(I), '', 'пока поле в фокусе, окна нет');
  await I.evaluate(() => document.getElementById('tmpIn').blur());
  assert.ok(/Версия 91/.test(await waitShown(I)), 'после ввода окно появилось');
  console.log('3 OK');

  // 4. именной пользователь: по роли (редактор не видит действие по скрипту), синхронизация между устройствами
  const c = post({ op: 'usradd', code: A, by: 'Технолог', name: 'Петров П.П.', role: 'editor', own: false });
  assert.strictEqual(c.ok, true);
  const D1 = await mk('D1');
  await connect(D1, { name: 'Петров П.П.', code: c.code });
  const t1 = await waitShown(D1); console.log(t1.replace(/\s+/g, ' ').slice(0, 200));
  assert.ok(/Версия 91/.test(t1) && /Загрузка цен из 1С/.test(t1) && !/обновите скрипт/.test(t1), 'редактору — его пункты, без действий технолога');
  await D1.click('[data-rel="ok"]');
  await D1.waitForFunction(() => document.querySelector('#relBar').hidden);
  const srv = post({ op: 'relget', code: c.code, by: 'Петров П.П.' }); assert.strictEqual(srv.v, +REL, 'на сервере записано: ' + JSON.stringify(srv));
  const D2 = await mk('D2');          // другое устройство, локальной отметки нет
  await connect(D2, { name: 'Петров П.П.', code: c.code });
  await D2.waitForTimeout(500);
  for (let i = 0; i < 6; i++) { await D2.waitForTimeout(400); assert.strictEqual(await shown(D2), '', 'на втором устройстве окно не повторяется'); }
  assert.ok((await key(D2)).some(k => RELRE.test(k)), 'отметка с сервера перенесена на устройство');
  console.log('4 OK');
  if (errs.length) { console.log(errs); process.exit(1); }
  console.log('OK rel');
  await browser.close(); process.exit(0);
})();
