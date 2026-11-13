/* Фудкост: права. Шеф-повар (viewer) и аудит видят план, но не меняют назначения. ТЕСТ-данные */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert');
const SRC = process.argv[2] || 'out/КБЖУ_калькулятор_автономный.html';
const errs = [];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 1100 } })).newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.route(/script\.google\.com|script\.googleusercontent\.com/, r => r.abort());
  await page.goto('file://' + path.resolve(SRC));
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('kbzhu:tab', 'fc'); });
  await page.reload(); await page.waitForSelector('#fcObj');
  await page.selectOption('#fcObj', '__new__'); await page.fill('#fcNewObj', 'ТЕСТ Права'); await page.dispatchEvent('#fcNewObj', 'change');
  await page.fill('input[data-act="fcFrom"]', '2026-10-01'); await page.dispatchEvent('input[data-act="fcFrom"]', 'change');
  await page.fill('input[data-act="fcTo"]', '2026-10-31'); await page.dispatchEvent('input[data-act="fcTo"]', 'change');
  await page.evaluate(() => { const F = window.kbzhuFc, S = F.S, O = S.fc.sel.obj; S.ings.tM = { id: 'tM', name: 'ТЕСТ Мясо', price: 400 };
    S.fc.ops.revision = { r1: { id: 'r1', b: 'x', obj: O, d: '2026-10-01', nm: 'ТЕСТ Мясо', u: 'кг', book: 50, fact: 50 }, r2: { id: 'r2', b: 'x', obj: O, d: '2026-10-31', nm: 'ТЕСТ Мясо', u: 'кг', book: 50, fact: 40 } };
    F.cfgSet('thr.shortRub', 100); });
  await page.click('[data-act="fcView"][data-v="plan"]'); await page.click('[data-act="fcBuild"]'); await page.waitForSelector('.fcm');
  const as = (role) => page.evaluate(r => { const S = window.kbzhuFc.S; S.sy.cfg.url = 'https://script.google.com/macros/s/TEST/exec'; S.sy.cfg.code = '1'; S.sy.cfg.name = 'ТЕСТ Пользователь'; S.sy.cfg.role = r; S.fc.scope = window.kbzhuFc.scopeKey(); S.fc.scopeLoaded = S.fc.scope; return null; }, role);
  for (const [role, canEdit] of [['admin', true], ['editor', true], ['finance', true], ['viewer', false], ['audit', false]]) {
    await as(role);
    const r = await page.evaluate(() => { const F = window.kbzhuFc, h = F.planHtml(), d = document.createElement('div'); d.innerHTML = h; const sel = d.querySelector('select[data-act="fcAsg"]'), dl = d.querySelector('[data-act="fcDl"]'); return { can: F.canEdit(), asgDisabled: sel ? sel.disabled : null, dl: !!dl && !dl.disabled, items: d.querySelectorAll('.fcm').length }; });
    assert.strictEqual(r.can, canEdit, role + ': право правки');
    assert.strictEqual(r.asgDisabled, !canEdit, role + ': выбор исполнителя ' + (canEdit ? 'доступен' : 'закрыт'));
    assert.ok(r.items > 0 && r.dl, role + ' видит план и может его скачать');
  }
  assert.deepStrictEqual(errs, []);
  console.log('OK fc5'); await browser.close();
})().catch(e => { console.error('FAIL', e.message, errs); process.exit(1); });
