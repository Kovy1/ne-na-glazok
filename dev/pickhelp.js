/* помощники для полей поиска сырья (.ipi): выбрать по значению (data-v) или набрать текст и нажать на подходящую строку */
module.exports = {
  async pickV(inp, v) {
    await inp.click();
    await inp.page().locator('.ipl:not([hidden]) .ipo[data-v="' + v + '"]').first().click();
  },
  async pickText(inp, text, label) {
    await inp.click(); await inp.fill(text);
    await inp.page().locator('.ipl:not([hidden]) .ipo', { hasText: label || text }).first().click();
  },
  async pickKey(inp, text) {
    await inp.click(); await inp.fill(text); await inp.press('Enter');
  },
};
