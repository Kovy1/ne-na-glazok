// Помощник ИИ: кнопки в карте ТТК, черновик, настройка ключа (макет GigaChat)
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const TT = require('./tt');
const path = require('path'), vm = require('vm'), assert = require('assert');
const { startGas } = require('./sync/gasserver');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ref = { label: '', p: null, f: null, c: null, kcal: null, tol: 10, basis: '100' };
const seed = () => ({
  ings: { i3: { name: 'Картофель', p: 2, f: 0.4, c: 16, kind: 'table', source: '', price: 30 }, i4: { name: 'Говядина', p: 19, f: 12, c: 0, kind: 'table', source: '', price: 520 } },
  recipes: {
    r1: { name: 'Гуляш говяжий', output: 150, rows: [{ rid: 'a', ing: 'i4', net: 100, share: 100 }, { rid: 'b', ing: 'i3', net: 60, share: 100 }], ref, ttk: { num: '9', org: 'ООО «Кредо»', t42: '', look: '', color: '', texture: '', taste: '' } },
    r2: { name: 'Гуляш из свинины', output: 150, rows: [{ rid: 'c', ing: 'i4', net: 90, share: 100 }], ref, ttk: { num: '10', t42: 'Мясо нарезать кубиками, обжарить до золотистой корочки, добавить воду и тушить до готовности.', look: 'Кусочки мяса в соусе', color: 'Коричневый', texture: 'Мягкая', taste: 'Мясной' } }
  },
  cfg: {},
});
let mode = 'steps', chatBodies = [], chatCount = 0;
const STEPS = '```\n1. Мясо нарезать кубиками.\n2) **Обжарить** до золотистой корочки.\n- Добавить картофель и тушить 40 минут [уточнить: температура].\n```';
const ORGANO = '```json\n{"look":"Кусочки мяса и картофеля в соусе","color":"Коричневый","texture":["Мясо мягкое","картофель рассыпчатый"],"taste":"Мясной, с лёгким запахом специй"}\n```';
function fetchMock(url, p) {
  if (/\/models$/.test(url)) return { code: 200, body: JSON.stringify({ data: [{ id: 'x/small:free', name: 'Small', context_length: 8000, pricing: { prompt: '0', completion: '0' } }, { id: 'y/big:free', name: 'Big', context_length: 100000, pricing: { prompt: '0', completion: '0' } }] }) };
  if (/oauth/.test(url)) return { code: 200, body: JSON.stringify({ access_token: 'tok', expires_at: Date.now() + 1800000 }) };
  chatCount++; chatBodies.push(JSON.parse(p.payload));
  if (mode === 'pay') return { code: 402, body: '{"message":"Payment Required"}' };
  let text = mode === 'steps' ? STEPS : mode === 'organo' ? ORGANO : mode === 'junk' ? 'Не могу ответить на этот вопрос' : 'готово';
  return { code: 200, body: JSON.stringify({ model: 'meta/llama:free', choices: [{ message: { role: 'assistant', content: text } }], usage: { total_tokens: 50 } }) };
}
(async () => {
  const gs = await startGas({ fetch: fetchMock }); vm.runInContext('setup()', gs.gas.ctx);
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
  const fld = (p, k) => p.inputValue('textarea[data-act="ttf"][data-k="' + k + '"]');
  const openTtk = async p => { await TT.openCalc(p); await p.waitForSelector('#rname'); await sleep(200); };

  // 1. технолог, ключа ещё нет: подсказка и «Скопировать запрос»
  const A = await mk(1280, 'adm-5678', seed());
  await A.click('#tabSync'); await A.waitForSelector('#aiBox');
  assert.ok(/Помощник выключен/.test(await A.innerText('#aiBox')), 'карточка ИИ: ключ не задан');
  assert.strictEqual(await A.inputValue('#ai-prov'), 'openrouter', 'по умолчанию OpenRouter');
  assert.strictEqual(await A.locator('#aiBox [data-act="aiTest"]').isDisabled(), true, '«Проверить ИИ» без ключа недоступна');
  await openTtk(A);
  assert.strictEqual(await A.locator('#ai-tech [data-act="aiGo"]').count(), 1);
  assert.strictEqual(await A.locator('#ai-organo [data-act="aiGo"]').count(), 1);
  assert.ok(/ИИ ещё не настроен/.test(await A.innerText('#ai-tech')), 'подсказка про настройку');
  await A.click('#ai-tech [data-act="aiGo"]'); await sleep(200);
  assert.strictEqual(chatCount, 0, 'без ключа запрос не уходит');
  console.log('1 OK: без ключа');

  // 1b. второй путь без ключа: «Спросить в чате» → ответ чата вставляется прямо в поле карты
  await A.evaluate(() => { window.__opened = []; window.__clip = ''; window.__rd = ''; window.open = u => { window.__opened.push(u); return null; }; navigator.clipboard.writeText = t => { window.__clip = t; return Promise.resolve(); }; navigator.clipboard.readText = () => Promise.resolve(window.__rd); });
  const paste = (p, sel, txt) => p.evaluate(([sel, txt]) => { const t = document.querySelector(sel), dt = new DataTransfer(); dt.setData('text/plain', txt); return t.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, [sel, txt]);
  assert.strictEqual(await A.locator('#ai-tech textarea').count(), 0, 'лишних полей под кнопками нет');
  assert.strictEqual(await A.locator('#ai-tech [data-act="aiCopy"]').count(), 0, 'отдельной кнопки копирования нет');
  await A.click('#ai-tech [data-act="aiAsk"]'); await A.waitForSelector('#ai-tech .aiwait');
  assert.deepStrictEqual(await A.evaluate(() => window.__opened), ['https://chat.deepseek.com/'], 'открылся чат DeepSeek');
  const q1 = await A.evaluate(() => window.__clip);
  assert.ok(/Гуляш говяжий/.test(q1) && /размер нарезки/.test(q1) && /Говядина/.test(q1), 'запрос скопирован: блюдо, состав, требования');
  assert.strictEqual(await A.locator('#ai-tech textarea').count(), 0, 'ответ вставляется в само поле 4.2, отдельного поля нет');
  const F42 = 'textarea[data-act="ttf"][data-k="t42"]';
  // вставили сам запрос: обычная вставка, без разбора
  assert.strictEqual(await paste(A, F42, q1), true, 'запрос вставляется как обычный текст');
  assert.strictEqual(await fld(A, 't42'), '');
  // ответ чата со вступлением, markdown и номерами
  const ans = 'Конечно! Вот технология:\n\n**4.2. Технология приготовления**\n1. Говядину нарезать кубиками 2×2 см.\n2. Обжарить 10 минут при 170 °C.\n\nЕсли нужно, могу добавить гарнир.';
  assert.strictEqual(await paste(A, F42, ans), false, 'вставка перехвачена');
  await A.waitForFunction(s => document.querySelector(s).value.length > 10, F42);
  assert.strictEqual(await fld(A, 't42'), 'Говядину нарезать кубиками 2×2 см.\nОбжарить 10 минут при 170 °C.', 'вступление, заголовок и номера убраны');
  assert.strictEqual(await A.locator('#ai-tech .aiwait').count(), 0, 'ожидание ответа закончено');
  assert.ok(/Текст вставлен \(чат\)/.test(await A.innerText('#ai-tech')));
  await A.click('#ai-tech [data-act="aiUndo"]'); await sleep(200);
  assert.strictEqual(await fld(A, 't42'), '', '«Вернуть прежний» восстанавливает пустое поле');
  // без ожидания ответа вставка обычная
  assert.strictEqual(await paste(A, F42, ans), true);
  // органолептика: выбор чата, вставка в любое из полей, кнопка «из буфера»
  await A.selectOption('#ai-organo [data-act="aiChatSel"]', 'qwen');
  assert.strictEqual(await A.evaluate(() => localStorage.getItem('kbzhu:aichat')), 'qwen', 'выбор чата запоминается');
  assert.strictEqual(await A.inputValue('#ai-tech [data-act="aiChatSel"]'), 'qwen', 'выбор виден во всех блоках');
  await A.click('#ai-organo [data-act="aiAsk"]'); await A.waitForSelector('#ai-organo .aiwait');
  assert.deepStrictEqual(await A.evaluate(() => window.__opened.slice(-1)), ['https://chat.qwen.ai/']);
  const q2 = await A.evaluate(() => window.__clip); assert.ok(/Внешний вид: …/.test(q2) && !/JSON/.test(q2), 'в запросе для чата четыре строки, без JSON');
  assert.strictEqual(await paste(A, 'textarea[data-k="taste"]', 'Просто длинный текст без нужных строк'), true, 'непонятный текст вставляется как обычно');
  await A.evaluate(() => { window.__rd = '**Внешний вид:** Кусочки мяса в густом соусе\n- Цвет: коричневый\n- Консистенция: мясо мягкое\nВкус и запах: мясной, с запахом специй'; });
  await A.click('#ai-organo [data-act="aiClip"]'); await A.waitForFunction(() => /Текст вставлен/.test(document.querySelector('#ai-organo').textContent));
  assert.deepStrictEqual([await fld(A, 'look'), await fld(A, 'color'), await fld(A, 'texture'), await fld(A, 'taste')], ['Кусочки мяса в густом соусе', 'коричневый', 'мясо мягкое', 'мясной, с запахом специй']);
  // непонятный ответ в буфере и отмена
  await A.click('#ai-organo [data-act="aiAsk"]'); await A.waitForSelector('#ai-organo .aiwait');
  await A.evaluate(() => { window.__rd = 'Просто текст без нужных строк, длинный'; });
  await A.click('#ai-organo [data-act="aiClip"]'); await A.waitForSelector('#ai-organo .err'); assert.ok(/Не нашёл в ответе/.test(await A.innerText('#ai-organo .err')));
  await A.click('#ai-organo [data-act="aiWaitX"]'); await sleep(150);
  assert.strictEqual(await A.locator('#ai-organo .aiwait').count(), 0, 'отмена убирает подсказку');
  assert.strictEqual(chatCount, 0, 'через чат запросы к API не уходят');
  await A.evaluate(() => localStorage.removeItem('kbzhu:aichat'));
  console.log('1b OK: чат без ключа');

  // 2. ввод ключа, проверка
  await A.click('#tabSync'); await A.waitForSelector('#aiBox');
  await A.click('#aiBox [data-act="aiKeySave"]'); await sleep(200);
  assert.ok(/Вставьте ключ/.test(await A.innerText('#sym-ai')), 'пустой ключ не принимается');
  await A.fill('#ai-key', 'sk-or-v1-0123456789abcdef0123456789abcdef');
  await A.click('#aiBox [data-act="aiKeySave"]');
  await A.waitForFunction(() => /Помощник включён: OpenRouter/.test(document.querySelector('#aiBox').textContent), null, { timeout: 20000 });
  assert.strictEqual(await A.inputValue('#ai-key'), '', 'ключ в поле не остаётся');
  const html = await A.content(); assert.ok(html.indexOf('sk-or-v1-0123') < 0, 'ключ нигде не виден в странице');
  assert.ok(!(await A.evaluate(() => JSON.stringify(localStorage))).includes('sk-or-v1-0123'), 'ключ не в хранилище браузера');
  mode = 'ok';
  await A.click('#aiBox [data-act="aiTest"]');
  await A.waitForFunction(() => /ИИ отвечает/.test(document.querySelector('#sym-ai').textContent), null, { timeout: 20000 });
  assert.ok(/готово/.test(await A.innerText('#sym-ai')) && /meta\/llama:free/.test(await A.innerText('#sym-ai')));
  console.log('2 OK: ключ сохранён и проверен');

  // 3. технология по ключу: сразу в поле, «Вернуть прежний»
  mode = 'steps'; chatBodies = [];
  await openTtk(A);
  await A.evaluate(() => { const t = document.querySelector('textarea[data-act="ttf"][data-k="t42"]'); t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.ok(/отправятся в OpenRouter/.test(await A.innerText('#ai-tech')), 'предупреждение о передаче данных');
  assert.strictEqual(await A.locator('#ai-tech textarea').count(), 0, 'отдельного поля для черновика нет');
  await A.click('#ai-tech [data-act="aiGo"]');
  await A.waitForSelector('#ai-tech [data-act="aiUndo"]', { timeout: 20000 });
  const ai1 = 'Мясо нарезать кубиками.\nОбжарить до золотистой корочки.\nДобавить картофель и тушить 40 минут [уточнить: температура].';
  assert.strictEqual(await fld(A, 't42'), ai1, 'в поле 4.2 сразу текст; номера, маркеры и ** убраны');
  const um = JSON.stringify(chatBodies[0].messages);
  assert.ok(/Гуляш говяжий/.test(um) && /Говядина/.test(um) && /Картофель/.test(um), 'в запросе блюдо и состав');
  assert.ok(/Гуляш из свинины/.test(um) && /золотистой корочки/.test(um), 'в запросе образец из похожей ТТК');
  assert.ok(!/ООО «Кредо»/.test(um), 'название организации не уходит');
  assert.ok(/размер нарезки/.test(um) && /температурой в °C и временем в минутах/.test(um), 'в запросе требуются нарезка, температура и время');
  await A.click('#ai-tech [data-act="aiUndo"]'); await sleep(200);
  assert.strictEqual(await fld(A, 't42'), '', 'вернулся прежний (пустой) текст');
  assert.strictEqual(await A.locator('#ai-tech [data-act="aiUndo"]').count(), 0);
  console.log('3 OK: технология');

  // 4. в поле уже есть текст: ИИ учитывает его и заменяет, прежний возвращается; своя правка убирает кнопку возврата
  await A.fill('textarea[data-act="ttf"][data-k="t42"]', 'Мясо обжарить.'); await sleep(200);
  chatBodies = []; await A.click('#ai-tech [data-act="aiGo"]'); await A.waitForSelector('#ai-tech [data-act="aiUndo"]', { timeout: 20000 });
  assert.ok(/Уже написано/.test(JSON.stringify(chatBodies[0].messages)) && /Мясо обжарить\./.test(JSON.stringify(chatBodies[0].messages)), 'готовый текст учитывается');
  assert.strictEqual(await fld(A, 't42'), ai1);
  await A.click('#ai-tech [data-act="aiUndo"]'); await sleep(200);
  assert.strictEqual(await fld(A, 't42'), 'Мясо обжарить.', 'вернулся прежний текст');
  await A.click('#ai-tech [data-act="aiGo"]'); await A.waitForSelector('#ai-tech [data-act="aiUndo"]', { timeout: 20000 });
  await A.fill('textarea[data-act="ttf"][data-k="t42"]', ai1 + '\nПодавать горячим.'); await sleep(200);
  assert.strictEqual(await A.locator('#ai-tech [data-act="aiUndo"]').count(), 0, 'после правки руками кнопки возврата нет');
  console.log('4 OK: замена и возврат');

  // 5. органолептика по ключу: четыре поля сразу
  mode = 'organo';
  await A.click('#ai-organo [data-act="aiGo"]'); await A.waitForSelector('#ai-organo [data-act="aiUndo"]', { timeout: 20000 });
  assert.deepStrictEqual([await fld(A, 'look'), await fld(A, 'color'), await fld(A, 'texture'), await fld(A, 'taste')], ['Кусочки мяса и картофеля в соусе', 'Коричневый', 'Мясо мягкое, картофель рассыпчатый', 'Мясной, с лёгким запахом специй']);
  await A.click('#ai-organo [data-act="aiUndo"]'); await sleep(200);
  assert.strictEqual(await fld(A, 'look'), 'Кусочки мяса в густом соусе', 'возвращается то, что было до ИИ');
  console.log('5 OK: органолептика');

  // 6. ошибки: непонятный ответ и «нет оплаты»; поля не меняются
  mode = 'junk'; const before = await fld(A, 't42');
  await A.click('#ai-organo [data-act="aiGo"]'); await A.waitForSelector('#ai-organo .err', { timeout: 20000 });
  assert.ok(/ответил не в том виде/.test(await A.innerText('#ai-organo')));
  assert.strictEqual(await fld(A, 'look'), 'Кусочки мяса в густом соусе', 'при ошибке поля не меняются');
  mode = 'pay';
  await A.click('#ai-tech [data-act="aiGo"]'); await A.waitForSelector('#ai-tech .err', { timeout: 20000 });
  console.log('ошибка оплаты:', (await A.innerText('#ai-tech .err')).slice(0, 100));
  assert.ok(await A.locator('#ai-tech [data-act="aiGo"]').isEnabled(), 'после ошибки кнопка снова доступна');
  assert.strictEqual(await fld(A, 't42'), before, 'текст при ошибке не меняется');
  console.log('6 OK: ошибки');

  // 8. редактор: ключа не видит, кнопка работает
  mode = 'steps';
  const E = await mk(1280, 'ed-1234', seed());
  await E.click('#tabSync'); await E.waitForSelector('#syConn, .card');
  assert.strictEqual(await E.locator('#aiBox').count(), 0, 'настройка ключа только у технолога');
  await openTtk(E);
  await E.click('#ai-tech [data-act="aiGo"]'); await E.waitForSelector('#ai-tech [data-act="aiUndo"]', { timeout: 20000 });
  console.log('8 OK: редактор');

  // 9. телефон: кнопки в карте не вылезают за экран
  const M = await mk(390, 'adm-5678', seed());
  await openTtk(M);
  const ov = await M.evaluate(() => { const b = document.querySelector('#ai-tech'); const r = b.getBoundingClientRect(); return { r: r.right, w: innerWidth, sw: document.documentElement.scrollWidth }; });
  assert.ok(ov.r <= ov.w && ov.sw <= ov.w + 1, 'нет горизонтальной прокрутки: ' + JSON.stringify(ov));
  console.log('9 OK: телефон');

  // 10. ключ убирается
  await A.click('#tabSync'); await A.waitForSelector('#aiBox [data-act="aiKeyDel"]');
  await A.click('#aiBox [data-act="aiKeyDel"]'); await sleep(200); await A.click('#aiBox [data-act="aiKeyDel"]');
  await A.waitForFunction(() => /Помощник выключен/.test(document.querySelector('#aiBox').textContent), null, { timeout: 20000 });
  await openTtk(A);
  assert.ok(/ИИ ещё не настроен/.test(await A.innerText('#ai-tech')));
  console.log('10 OK: ключ убран');

  // 11. другие сервисы: выбор, список бесплатных моделей, свой адрес, GigaChat
  await A.click('#tabSync'); await A.waitForSelector('#aiBox');
  await A.fill('#ai-key', 'sk-or-v1-0123456789abcdef0123456789abcdef'); await A.click('#aiBox [data-act="aiKeySave"]');
  await A.waitForFunction(() => /Помощник включён: OpenRouter/.test(document.querySelector('#aiBox').textContent), null, { timeout: 20000 });
  await A.click('#aiBox [data-act="aiModels"]');
  await A.waitForFunction(() => /Бесплатных моделей: 2/.test(document.querySelector('#sym-ai').textContent), null, { timeout: 20000 });
  assert.deepStrictEqual(await A.$$eval('#ai-mlist option', o => o.map(x => x.value)), ['y/big:free', 'x/small:free'], 'список моделей в подсказке поля');
  await A.fill('#ai-model', 'y/big:free'); await A.click('#aiBox [data-act="aiKeySave"]');
  await A.waitForFunction(() => /модель y\/big:free/.test(document.querySelector('#aiBox').textContent), null, { timeout: 20000 });
  chatBodies = []; mode = 'steps'; await openTtk(A); await A.click('#ai-tech [data-act="aiGo"]'); await A.waitForSelector('#ai-tech [data-act="aiUndo"]', { timeout: 20000 });
  assert.strictEqual(chatBodies[0].model, 'y/big:free', 'выбранная модель уходит в запрос');
  await A.click('#tabSync'); await A.waitForSelector('#aiBox');
  await A.selectOption('#ai-prov', 'giga'); await sleep(200);
  assert.strictEqual(await A.locator('#ai-scope').count(), 1, 'у GigaChat есть тип доступа'); assert.strictEqual(await A.locator('#aiBox [data-act="aiLax"]').count(), 1);
  assert.strictEqual(await A.locator('#aiBox [data-act="aiModels"]').count(), 0);
  await A.selectOption('#ai-prov', 'custom'); await sleep(200);
  assert.strictEqual(await A.locator('#ai-url').count(), 1, 'у своего сервиса есть адрес');
  await A.fill('#ai-key', 'k'.repeat(24)); await A.click('#aiBox [data-act="aiKeySave"]'); await sleep(200);
  assert.ok(/Укажите адрес/.test(await A.innerText('#sym-ai')));
  await A.fill('#ai-url', 'http://bad.example.com/v1'); await A.fill('#ai-model', 'm1'); await A.click('#aiBox [data-act="aiKeySave"]');
  await A.waitForFunction(() => /Адрес должен начинаться с https/.test(document.querySelector('#sym-ai').textContent), null, { timeout: 20000 });
  await A.selectOption('#ai-prov', 'openrouter'); await sleep(200);
  assert.ok(/OpenRouter ✓/.test(await A.innerText('#ai-prov')), 'у сервиса с ключом стоит отметка');
  console.log('11 OK: выбор сервиса');

  assert.deepStrictEqual(errs, [], 'ошибок страницы нет: ' + errs.join('; '));
  await browser.close(); gs.close();
  console.log('PASS ai ui');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
