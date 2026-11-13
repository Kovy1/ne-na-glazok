/* вкладка «ТТК» открывается стартовым экраном; помощники для тестов */
exports.openCalc = async function (page, nameRe) {
  await page.click('#tabCalc');
  await page.waitForSelector('#ttkHome, #rname, #syCloud');
  if (await page.locator('#syCloud').count()) return;            // у шеф-повара «ТТК» сразу открывает облако
  if (await page.locator('#ttkHome').count()) {
    if (!(await page.locator('#ttkSavedLink').count())) return;     // сохранённых карт нет: остаётся стартовый экран
    await page.click('#ttkSavedLink'); await page.waitForSelector('#recipeSel');
    const v = await page.evaluate(re => { const o = Array.from(document.querySelectorAll('#recipeSel option')).filter(x => x.value && (!re || new RegExp(re).test(x.textContent)))[0]; return o && o.value; }, nameRe ? (nameRe instanceof RegExp ? nameRe.source : String(nameRe)) : null);
    await page.selectOption('#recipeSel', v);
  }
  await page.waitForSelector('#rname');
};
/* перейти к другой сохранённой карте из открытой */
exports.pickRecipe = async function (page, nameRe) {
  if (await page.locator('#ttkBack').count()) await page.click('#ttkBack');
  await page.waitForSelector('#ttkHome, #recipeSel');
  if (await page.locator('#ttkHome').count()) { await page.click('#ttkSavedLink'); await page.waitForSelector('#recipeSel'); }
  const v = await page.evaluate(re => { const o = Array.from(document.querySelectorAll('#recipeSel option')).filter(x => x.value && new RegExp(re).test(x.textContent))[0]; return o && o.value; }, nameRe instanceof RegExp ? nameRe.source : String(nameRe));
  if (!v) throw new Error('нет блюда ' + nameRe);
  await page.selectOption('#recipeSel', v);
  await page.waitForSelector('#rname');
};
/* пункт меню «Ещё» (копия, архив, удалить, загрузка) */
exports.more = async function (page, act) {
  if (await page.locator('#ttkMenu[hidden]').count()) await page.click('#ttkMore');
  await page.click('#ttkMenu [data-act="' + act + '"]');
};
/* экран «Сохранённые карты» (список блюд, фильтр по папкам) */
exports.showSaved = async function (page) {
  if (await page.locator('#recipeSel').count()) return;
  if (await page.locator('#ttkBack').count()) await page.click('#ttkBack');
  await page.waitForSelector('#ttkHome, #recipeSel');
  if (await page.locator('#ttkHome').count()) { await page.click('#ttkSavedLink'); await page.waitForSelector('#recipeSel'); }
};
/* облако: из корня зайти в регион ('main' | 'msk' | 'pend' | 'arch' | ''), затем в папку ('all' — «Все карты региона», 'root', id папки) */
exports.cloudIn = async function (page, reg = 'main', dir = 'all') {
  await page.waitForSelector('#syCloud');
  for (let i = 0; i < 4 && !(await page.locator('#syFRegs [data-act="syFReg"]').count()) && (await page.locator('[data-act="syFBack"]').count()); i++) await page.click('[data-act="syFBack"]');
  const tile = '#syFRegs [data-act="syFReg"][data-reg="' + reg + '"]';
  if (await page.locator(tile).count()) await page.click(tile);
  await page.waitForSelector('#syFNav .ccp', { timeout: 10000 });
  if (reg !== 'pend' && reg !== 'arch' && await page.locator('#syFChips .cfold').count()) { await page.click('#syFChips [data-act="syFDir"][data-dir="' + dir + '"]'); }
  await page.waitForTimeout(150);
};
/* облако: открыть «На проверке» (кнопка в плитках или в строке пути; если уже внутри — остаться) */
exports.goPend = async function (page) {
  await page.waitForFunction(() => document.querySelector('[data-act="syFReg"][data-reg="pend"]') || /На проверке/.test((document.querySelector('#syFNav .ccp') || {}).textContent || ''), null, { timeout: 20000 });
  const c = page.locator('[data-act="syFReg"][data-reg="pend"]');
  if (await c.count()) await c.first().click();
};
