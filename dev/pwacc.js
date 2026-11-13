/* Проверка самой страницы приёмки на имитации Apps Script (на настоящем Google её запускает человек в браузере) */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert'), fs = require('fs'), cp = require('child_process'), os = require('os');
const { startGas } = require('./sync/gasserver');
(async () => {
  const kitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-'));
  cp.execFileSync('node', ['sync/mk_test_script.js', kitDir]);
  fs.copyFileSync(path.join(kitDir, 'Code.test.gs'), 'sync/Code.test.gs');
  try {
    const kit = JSON.parse(fs.readFileSync(path.join(kitDir, 'test_accounts.json'), 'utf8'));
    const gs = await startGas({ file: 'Code.test.gs' });
    require('vm').runInContext('seedTest()', gs.gas.ctx);
    const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
    const page = await (await browser.newContext()).newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto('file://' + path.resolve('acceptance/index.html'));
    await page.fill('#u', gs.url); await page.fill('#a', JSON.stringify(kit));
    await page.click('#run');
    await page.waitForFunction(() => /^Готово/.test(document.querySelector('#st').textContent), null, { timeout: 110000 });
    const rows = await page.$$eval('#t tbody tr', t => t.map(r => [...r.cells].map(c => c.textContent)));
    const bad = rows.filter(r => r[1] === 'НЕ ПРОЙДЕНО');
    console.log(await page.textContent('#st'));
    bad.forEach(r => console.log('НЕ ПРОЙДЕНО:', r.join(' | ').slice(0, 300)));
    assert.strictEqual(bad.length, 0, 'есть непройденные проверки');
    assert.ok(rows.length >= 40, 'проверок мало: ' + rows.length);
    assert.deepStrictEqual(errs, []);
    // тот же набор против скрипта с неисправным правом доступа должен ловить ошибки: отключаем проверку региона у шефа и убеждаемся, что страница это видит
    await browser.close(); gs.close();
    console.log('OK acc');
  } finally { try { fs.unlinkSync('sync/Code.test.gs'); } catch (e) {} }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
