/* Готовит скрипт для ОТДЕЛЬНОЙ тестовой таблицы: Code.gs с тестовыми кодами и функцией seedTest() (именные тестовые пользователи).
   Использование: node sync/mk_test_script.js <каталог вывода>
   В каталоге появятся Code.test.gs (вставляется в Apps Script тестовой таблицы) и test_accounts.md (логины и пароли).
   Коды случайные, создаются при каждом запуске; в репозиторий их не кладут. Рабочий скрипт и рабочие коды не затрагиваются. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const out = process.argv[2] || '.';
const rnd = (p) => p + '-' + Array.from(crypto.randomBytes(6)).map(b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
const shared = { ADMIN: rnd('adm'), EDITOR: rnd('ed'), FINANCE: rnd('fin'), VIEW: rnd('view'), AUDIT: rnd('aud') };
const RU = { main: 'Волгоград', msk: 'Москва' };
const users = [
  { id: 't0001', name: 'Тест Технолог', role: 'admin', regs: null, code: rnd('tech') },
  { id: 't0002', name: 'Тест Редактор Волгоград', role: 'editor', regs: ['main'], code: rnd('edv') },
  { id: 't0003', name: 'Тест Редактор Москва', role: 'editor', regs: ['msk'], code: rnd('edm') },
  { id: 't0004', name: 'Тест Управляющий Волгоград', role: 'finance', regs: ['main'], code: rnd('finv') },
  { id: 't0005', name: 'Тест Управляющий Москва', role: 'finance', regs: ['msk'], code: rnd('finm') },
  { id: 't0006', name: 'Тест Шеф Волгоград 1', role: 'viewer', regs: ['main'], code: rnd('chv1') },
  { id: 't0007', name: 'Тест Шеф Волгоград 2', role: 'viewer', regs: ['main'], code: rnd('chv2') },
  { id: 't0008', name: 'Тест Шеф Москва 1', role: 'viewer', regs: ['msk'], code: rnd('chm1') },
  { id: 't0009', name: 'Тест Без Региона', role: 'viewer', regs: [], code: rnd('none') },
];
const sharedRegs = { editor: ['main', 'msk'], finance: ['main', 'msk'], viewer: ['main', 'msk'], audit: ['main', 'msk'] };
let src = fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8');
const rep = (a, b) => { if (!src.includes(a)) throw new Error('нет строки: ' + a); src = src.replace(a, "'" + b + "'"); };
rep("'ЗАМЕНИТЕ-код-редактора'", shared.EDITOR); rep("'ЗАМЕНИТЕ-код-технолога'", shared.ADMIN); rep("'ЗАМЕНИТЕ-код-управляющего'", shared.FINANCE);
rep("'ЗАМЕНИТЕ-код-шеф-повара'", shared.VIEW); rep("'ЗАМЕНИТЕ-код-аудита'", shared.AUDIT);
src += `

/* ===== ТОЛЬКО ДЛЯ ТЕСТОВОЙ ТАБЛИЦЫ ===== создаёт тестовых именных пользователей с известными кодами и назначает регионы общим кодам.
   Запускается один раз вручную: выбрать seedTest → «Выполнить». Повторный запуск уже созданных пользователей не меняет. */
function seedTest() {
  try { setup(); } catch (e) { Logger.log('setup: ' + e); }
  var users = ${JSON.stringify(users)}, have = usrAll_().map(function (u) { return u.nm; }), added = 0;
  users.forEach(function (u) {
    if (have.indexOf(login_(u.name)) > -1) return;
    appendRows_('usr', [[u.id, u.name, u.role, usrHash_(u.code), USR_ON, new Date(), '', '', u.regs === null ? '' : JSON.stringify(u.regs)]]);
    added++;
  });
  usrDrop_();
  PropertiesService.getScriptProperties().setProperty('rs', JSON.stringify(${JSON.stringify(sharedRegs)}));
  Logger.log('Тестовых пользователей добавлено: ' + added + '. Регионы общих кодов назначены.');
}
`;
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'Code.test.gs'), src);
const rows = [['Технолог (общий код)', 'все', '—', shared.ADMIN], ['Редактор (общий код)', 'Волгоград, Москва', '—', shared.EDITOR], ['Тер. управляющий (общий код)', 'Волгоград, Москва', '—', shared.FINANCE], ['Шеф-повар (общий код)', 'Волгоград, Москва', '—', shared.VIEW], ['Аудит (общий код)', 'Волгоград, Москва', '—', shared.AUDIT]];
const rl = { admin: 'Технолог', editor: 'Редактор', finance: 'Тер. управляющий', viewer: 'Шеф-повар' };
const md = ['# Тестовые учётные записи (только для тестовой таблицы)', '', 'Создаются функцией seedTest() в тестовом Apps Script. На рабочую базу не распространяются. Вход: поле «ФИО» = логин, поле «Код» = пароль.', '',
  '## Именные пользователи', '', '| Роль | Регион | Логин (ФИО) | Пароль (код) |', '|---|---|---|---|']
  .concat(users.map(u => `| ${rl[u.role]} | ${u.regs === null ? 'все' : (u.regs.length ? u.regs.map(r => RU[r]).join(', ') : 'не назначен') } | ${u.name} | ${u.code} |`))
  .concat(['', '## Общие коды (без имени; в поле «ФИО» можно написать любое имя)', '', '| Роль | Регионы | Логин | Пароль (код) |', '|---|---|---|---|'])
  .concat(rows.map(r => `| ${r.join(' | ')} |`));
fs.writeFileSync(path.join(out, 'test_accounts.md'), md.join('\n') + '\n');
fs.writeFileSync(path.join(out, 'test_accounts.json'), JSON.stringify({ shared, users }, null, 1));
console.log('готово:', out);
