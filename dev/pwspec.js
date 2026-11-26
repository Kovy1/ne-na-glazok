/* блюда из ресурсной спецификации 1С: все листы, сопоставление сырья, ошибка в спецификации, отметка «Нет ТТК» и привязка ТТК позже */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert');
const SRC = process.argv[2] || 'kbzhu.html';
const errs = [];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 1000 } })).newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + path.resolve(SRC));
  const ing = (name, price, cold) => Object.assign({ name, p: 1, f: 0, c: 8, kind: 'table', source: 'справочник', price }, cold ? { loss: { cold } } : {});
  const d = { ings: { i1: ing('Капуста белокочанная', 30, 20), i2: ing('Свекла', 35, 20), i3: ing('Морковь', 40, 20), i4: ing('Сахар-песок', 80) }, recipes: {}, cfg: {} };
  d.ings.i1.aliases = ['капуста свеж цел н очищ н мыт вес'];
  await page.evaluate(d => { localStorage.clear(); localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:tab', 'calc'); localStorage.setItem('kbzhu:whatsnew', '999'); }, d);
  await page.reload();
  await page.waitForSelector('#specLoad');
  await page.setInputFiles('#specFile', 'fixtures/spec/spec_test.xlsx');
  await page.waitForSelector('#specCard');
  let t = await page.innerText('#specCard');
  assert.ok(/Блюд\s*4/.test(t), 'четыре блюда с двух листов: ' + t.slice(0, 300));
  assert.ok(/выпечка/.test(t) && /1 бл/.test(t), 'листы видны');
  assert.ok(/сырья намного больше выхода/.test(t), 'ошибка спецификации отмечена');
  const sel = await page.evaluate(() => kbzhuSpec.S.spec.ds.map(x => x.sel));
  assert.deepStrictEqual(sel, [true, true, false, true], 'запеканка с 20 кг сгущёнки не отмечена');
  // капуста по запомненному названию — совпала; морковь/свекла/сахар — похожие, нужно подтвердить; остальное не найдено
  const st = await page.evaluate(() => { const S = kbzhuSpec.S, o = {}; Object.keys(S.spec.ing).forEach(k => { const e = S.spec.ing[k]; o[e.name] = kbzhuSpec.ingSt(e); }); return o; });
  assert.strictEqual(st['Капуста свеж цел н/очищ н/мыт вес'], 'ok');
  const kapRow = await page.textContent('#specCard .sprow:has-text("Капуста свеж")');
  assert.ok(/в блюде: Борщ тест 250\/10 \(ТТК №381\)/.test(kapRow), 'видно, в каком блюде сырьё: ' + kapRow);
  // подтверждаем все предложенные, остальные — новым сырьём
  while (await page.$('#specCard [data-act="specTake"]')) await page.click('#specCard [data-act="specTake"]');
  await page.click('[data-act="specNewAll"]');
  await page.click('[data-act="specCat"]');
  await page.click('[data-act="specApply"]');
  await page.waitForTimeout(400);
  const R = await page.evaluate(() => { const S = kbzhuSpec.S, o = {}; Object.keys(S.recipes).forEach(id => { const r = S.recipes[id]; o[r.name] = { id, out: r.output, spec: r.spec, rows: r.rows.map(x => ({ n: x.tname, ing: x.ing, g: x.gross, net: x.net, skip: !!x.skip })), cat: r.cat, num: r.ttk && r.ttk.num }; }); return o; });
  const names = Object.keys(R).sort();
  assert.deepStrictEqual(names, ['Борщ тест 250/10 (ТТК №381)', 'Булочка без номера 100г', 'Суп тестовый 250г (ТТК №999)'], 'приставка «СМ» убрана, номер ТТК в названии: ' + names);
  const b = R['Борщ тест 250/10 (ТТК №381)'];
  assert.strictEqual(b.out, 260); assert.strictEqual(b.num, '381');
  assert.ok(b.spec && b.spec.d === '2026-10-01', 'дата действия спецификации');
  const kap = b.rows.find(x => /Капуста/.test(x.n));
  assert.strictEqual(kap.ing, 'i1'); assert.strictEqual(kap.g, 25); assert.strictEqual(kap.net, 20, 'нетто по норме холодной обработки');
  const s = R['Суп тестовый 250г (ТТК №999)'];
  assert.ok(/Контейнер РК-11 1 шт/.test(s.spec.sk), 'штуки без массы перечислены: ' + s.spec.sk);
  assert.strictEqual(s.rows.find(x => /Квас/.test(x.n)).g, 100, 'литры как килограммы');
  assert.ok(b.cat && s.cat && R['Булочка без номера 100г'].cat && b.cat !== R['Булочка без номера 100г'].cat, 'разложено по папкам листов');
  // стартовый экран: список блюд без ТТК
  t = await page.innerText('#ttkHome');
  assert.ok(/Нет ТТК: 3 блюда/.test(t), 'на стартовом экране счётчик: ' + t);
  // открыть борщ: плашка «Нет ТТК»
  await page.click('#specNoTtk summary');
  await page.click('#specNoTtk [data-rid="' + b.id + '"] [data-act="specOpen"]');
  await page.waitForSelector('.specstrip');
  assert.ok(/Нет ТТК/.test(await page.innerText('.specstrip')));
  // привязать ТТК: файл ложится в эту карту, отметка снимается
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('.specstrip [data-act="specTtk"]')]);
  await fc.setFiles('fixtures/spec/ttk381.docx');
  await page.waitForSelector('#ttkCard');
  t = await page.innerText('#ttkCard');
  await page.click('[data-act="ttkCreate"]');
  await page.waitForTimeout(400);
  const after = await page.evaluate(id => { const r = kbzhuSpec.S.recipes[id]; return { name: r.name, spec: !!r.spec, n: Object.keys(kbzhuSpec.S.recipes).length, rows: r.rows.length }; }, b.id);
  assert.strictEqual(after.spec, false, 'после привязки ТТК отметки «Нет ТТК» нет');
  assert.strictEqual(after.n, 3, 'новая карта не создана');
  assert.strictEqual(after.rows, 5, 'состав из ТТК');
  assert.ok(!(await page.$('.specstrip')));
  console.log('OK spec');
  if (errs.length) { console.log(errs); process.exit(1); }
  await browser.close();
})();
