/**
 * Общая база для «ТехнолоGии».
 *
 * Как поставить (один раз, около 5 минут):
 *  1. Создайте пустую Google Таблицу. В меню: Расширения → Apps Script.
 *  2. Удалите всё, что там есть, и вставьте этот файл целиком.
 *  3. Замените два кода ниже на свои. Код редактора раздайте сотрудникам (он видит цены, но его правки принимает технолог), код технолога оставьте себе.
 *  4. Выберите в списке функций «setup», нажмите «Выполнить» и разрешите доступ (Google покажет предупреждение
 *     «приложение не проверено»: Дополнительно → Перейти на страницу…). Так создадутся три служебных листа
 *     и папка «ТТК калькулятора» на вашем Google Диске для файлов .docx (её адрес появится в журнале выполнения).
 *  5. Развернуть → Новое развёртывание → тип «Веб-приложение».
 *       Выполнять от имени: Я.   У кого есть доступ: Все.
 *     Нажмите «Развернуть» и скопируйте адрес веб-приложения (он оканчивается на /exec).
 *  6. В калькуляторе откройте вкладку «Личный кабинет», вставьте адрес, своё ФИО и один код (права зависят от кода).
 *
 * Роли и цены. Закупочные цены, себестоимость и цену продажи видят все коды. Что можно делать:
 *   код технолога: всё; принимает и публикует правки, ведёт файлы, файлы цен и страницу по ссылке;
 *   код редактора: работает так же, но любая его правка (в том числе цены и цена продажи) уходит технологу на подтверждение;
 *   код тер. управляющего / менеджера (необязательный; пока в нём стоит «ЗАМЕНИТЕ…», роль выключена): меню и финансы, ABC-анализ, калькуляция ОП-1
 *   и цены сырья; ТТК и библиотека «ТТК в облаке» ему закрыты (скрипт не отдаёт ему файлы); нерассчитанные ТТК он не видит; правки уходят технологу;
 *   код шеф-повара (необязательный): видит всё без права правки; из ТТК — только рассчитанные и принятые файлы в облаке (файлы «На проверке» не отдаются),
 *   плюс калькуляция ОП-1; ничего не отправляет.
 *   код аудита (необязательный): то же, что у шеф-повара (смотрит и выгружает данные, ничего не меняет и не отправляет), но входит одним кодом, ФИО не нужно.
 * Данные общей базы отдаются только по коду (любой роли).
 *
 * Версия 31 (выпуск приложения 92): в меню без входа (действие «menu») у блюда есть отметка декларации о соответствии по регионам:
 *   номер декларации и срок её действия. Отметку ставит технолог в ТТК, она хранится в данных карты.
 * Версия 30 (выпуск приложения 91): фудкост на сервере. Отчёты, версии плана, ответственные, сроки, статусы и комментарии
 * лежат файлами в папке «Фудкост ТехнолоГии» на Диске (создаётся при первой записи, адрес папки хранится в свойствах скрипта).
 * Доступ проверяется здесь: роль, объект и регион, а исполнитель мероприятия определяется по идентификатору пользователя, а не по ФИО.
 * Устаревшая правка не затирает более свежую: сервер сверяет ревизию и возвращает конфликт.
 * Обновление уже работающей базы: см. sync/UPDATE.md (вставить файл целиком, сохранить, «Управление развёртываниями» → «Новая версия»).
 *
 * Именные доступы. Кроме общих кодов выше технолог может завести человека в калькуляторе («Личный кабинет» → «Пользователи»): указывает
 * фамилию с инициалами и права (технолог, редактор, тер. управляющий, шеф-повар). Скрипт выдаёт код из 5 цифр; человек входит по ФИО и коду
 * и может сам сменить код (или задаёт свой при первом входе, если технолог так отметил). Пользователи хранятся на листе «Пользователи», код
 * в нём только в виде хэша. Общие коды продолжают работать. Для этого нужен скрипт версии 19.
 *
 * Проверка ТТК. Предложения редакторов технолог открывает в калькуляторе («Личный кабинет» → «На проверке») прямо как ТТК: может поправить её и
 * опубликовать, отклонить или вернуть автору на доработку (комментарий обязателен). Автор получает уведомление, открывает карту, исправляет
 * и отправляет снова. Всё это хранится на листе «Предложения» (столбцы K–N: ответ технолога, когда и кто решил, пакет до доработки).
 *
 * Проверка файлов. Файлы .docx, которые предложил редактор («ТТК в облаке» → «На проверке»), технолог тоже открывает в калькуляторе и правит.
 * Он принимает файл в выбранный регион и папку (если поправил карту, в библиотеку уходит его версия файла), отклоняет или возвращает автору
 * на доработку с комментарием. Возвращённый файл остаётся в «На проверке» с комментарием технолога, автор исправляет и предлагает файл снова
 * (файл с тем же именем заменяет прежний) или снимает его с проверки.
 *
 * Файлы цен по регионам. Технолог в калькуляторе (вкладка «Личный кабинет» → «Файлы цен») обновляет на вашем Диске папку «Цены ТехнолоGии»:
 * в ней по папке на каждый регион (Волгоград, Москва…). В папке региона лежат четыре файла и подпапка «Архив»:
 *   «Цены продажи — регион» (Google Таблица и Excel): блюдо, выход, цена продажи и список изменений цен; доступ «все, у кого есть ссылка»,
 *   только чтение (скрипт задаёт его сам: цены продажи не секрет);
 *   «Себестоимость и закупка — регион» (Google Таблица и Excel): цены сырья, себестоимость блюд, наценка, состав себестоимости и журнал
 *   изменений; файлы закрытые, их видите только вы, а остальным они отдаются калькулятором по любому верному коду;
 *   «Архив»: копия обоих Excel-файлов за каждый месяц (последнее состояние месяца).
 * Файлы обновляются сами, когда технолог публикует или принимает изменения; кнопка «Обновить файлы цен» делает это сразу.
 * Новых разрешений для этого не нужно (доступ к Таблицам и Диску у скрипта уже есть): достаточно вставить новый файл поверх старого и создать новую версию развёртывания.
 *
 * Страница по ссылке. Технолог в калькуляторе (вкладка «Личный кабинет» → «Страница по ссылке») один раз загружает готовый файл калькулятора;
 * скрипт кладёт его на Диск и открывает всем по своему адресу /exec: ссылку можно отправить сотрудникам, ничего устанавливать не нужно.
 * Для этого развёртывание должно быть с доступом «Все». Страница обновляется той же кнопкой. Новых разрешений не нужно.
 *
 * Меню для посетителей. Тому, кто открыл страницу без кода, скрипт отдаёт только меню: название блюда, выход порции, номер ТТК, цену продажи по регионам и
 * папки меню (состава, сырья, закупочных цен и себестоимости там нет). По умолчанию видно каждое блюдо с ценой продажи. Технолог может включить в калькуляторе
 * ручной выбор («Меню и финансы» → «Гостевое меню» → «Выбрать блюда вручную», нужен скрипт версии 25): тогда посетители видят только блюда с переключателем
 * «Показывать посетителям» (и только в регионе, где указана цена), а цена и папка блюдо сами не публикуют. Список отмеченных блюд хранится вместе с папками меню;
 * «Вернуть показ по цене» выключает ручной выбор. Менять список может только код технолога.
 *
 * Копия данных пользователя. Калькулятор хранит рабочие данные в браузере; чтобы в разных браузерах и на разных компьютерах были одни и те же
 * данные, он по кнопке (и сам, после правок) сохраняет полную копию на ваш Диск, в папку «Копии данных ТехнолоGии», и умеет забрать её обратно.
 * Копия своя у каждой пары «роль + ФИО», хранится текущая и предыдущая. Новых разрешений не нужно.
 *
 * Регионы доступа (версия 26). Технолог видит все регионы. Остальным регионы назначает технолог в калькуляторе («Личный кабинет» → «Пользователи»): каждому именному
 * пользователю отдельно, общим кодам (редактор, тер. управляющий, шеф-повар, аудит) — по роли. Пока регионы не назначены, человек видит только общие справочники
 * (КБЖУ сырья, составы карт без региона), а цены, карты региона, файлы, история цен и копии данных — нет. Права проверяет скрипт при каждом запросе; при записи чужие цены
 * не затираются. Копия данных общего кода привязана к устройству (секрет хранит калькулятор), ФИО владельца копии не подтверждает.
 * Справочники и ревизии (версия 26). Листы «Справочники» (точки и юридические лица) и «Ревизии» создаются сами. Ревизии, точки и юрлица — по регионам доступа.
 *
 * Файл с адресом. Скрипт сам создаёт на вашем Google Диске маленькую таблицу «ТехнолоGия — адрес подключения» (доступ «все, у кого есть
 * ссылка», только чтение) и записывает в неё адрес веб-приложения, когда технолог подключается в калькуляторе. Сотрудникам достаточно
 * ссылки на эту таблицу (или готового файла калькулятора, куда она вшита): адрес /exec вводить не нужно, а если вы разверните скрипт
 * заново и подключитесь с новым адресом, у всех он обновится сам. Таблица содержит только адрес, без кодов и данных.
 *
 * Если потом измените этот файл (например, коды), нужно заново развернуть:
 * Развернуть → Управление развёртываниями → карандаш → Версия: «Новая версия» → Развернуть.
 *
 * Файлы .docx лежат в папке «ТТК калькулятора» на Диске владельца скрипта, предложенные редакторами файлы — в
 * подпапке «На проверке». Технолог может класть файлы в папку и обычным перетаскиванием.
 * Папки регионов. Внутри «ТТК калькулятора» скрипт ведёт по папке на каждый регион калькулятора (по умолчанию «Волгоград» и «Москва»; список и названия
 * берутся из калькулятора и подгоняются при открытии «ТТК в облаке» технологом). Файл ТТК лежит в папке своего региона или в её подпапке; прежние файлы
 * и папки, лежавшие прямо в «ТТК калькулятора», показываются как «Без региона» и переносятся технологом в нужный регион.
 * Если скрипт обновлён с более старой версии (без Диска), выполните «setup» ещё раз: Google запросит доступ к Диску.
 * Папки библиотеки (первые блюда, салаты и т. д.) — это подпапки в папке региона; технолог создаёт их в калькуляторе
 * (вкладка «ТТК в облаке»). Обновление со старой версии: вставьте этот файл поверх старого с теми же кодами и создайте новую версию
 * развёртывания (setup повторять не нужно, если Диск уже был подключён).
 *
 * Папки меню. Папки меню (первые блюда, салаты и т. д.) и раскладку блюд по ним ведёт технолог; скрипт хранит их в своих свойствах и отдаёт любому коду,
 * так что у остальных сотрудников меню разложено так же. Названия и порядок технолог может взять из папок региона на Диске (папки «1.Первые блюда», «2.Вторые блюда»…).
 *
 * Удаления. Когда технолог удаляет сырьё или ТТК и публикует («Опубликовать сразу»), либо принимает такое предложение редактора, в строке общей
 * базы остаётся метка «удалено» с новой версией: все остальные получат её кнопкой «Получить обновления» (или при открытии страницы), и позиция исчезнет
 * и у них. Сырьё, которое ещё используется в ТТК общей базы, удалить нельзя. Удаление можно отменить в «Журнале изменений» («Вернуть прежнее»).
 * Чтобы это заработало, вставьте скрипт версии 11 и разверните его новой версией.
 *
 * Листы «Общая база», «Предложения» и «Журнал» служебные. Правьте данные через калькулятор, не вручную:
 * калькулятор следит за номерами версий, а ручная правка их не меняет, и изменение не дойдёт до остальных.
 */

var EDITOR_CODE = 'ЗАМЕНИТЕ-код-редактора';
var ADMIN_CODE = 'ЗАМЕНИТЕ-код-технолога';
var FINANCE_CODE = 'ЗАМЕНИТЕ-код-управляющего';   // необязательный, тер. управляющий (менеджер): меню и финансы, ABC, ОП-1 и цены; ТТК и облако закрыты; правки на проверку технологу
var AUDIT_CODE = 'ЗАМЕНИТЕ-код-аудита';             // необязательный, аудит: вход по одному коду без имени; видит и выгружает всё, как шеф-повар, но ничего не меняет и не отправляет
var VIEW_CODE = 'ЗАМЕНИТЕ-код-шеф-повара';        // необязательный, шеф-повар: видит всё, ничего не меняет и не отправляет; ТТК только из облака (принятые файлы) и ОП-1

/* ---------------------------------------------------------------------------------------------- */

var VERSION = 31;
var PTR_NAME = 'ТехнолоGия — адрес подключения';
var PRICE_KEYS = { ing: ['price', 'priceUnit', 'packG', 'priceSrc', 'px'], rec: [] };   // вырезаются у кода без права на цены (сейчас права на цены есть у всех кодов)
var LOCK_KEYS = { ing: [], rec: ['sell'] };                                              // цена продажи: у кода без права на цены её тоже нельзя менять
var EXEC_RE = /^https:\/\/script\.google\.com\/(macros\/s|a\/macros\/[\w.-]+\/s)\/[\w-]+\/exec$/;
var SHEETS = {
  pub: { name: 'Общая база', n: 7, head: ['Ид', 'Вид', 'Название', 'Версия', 'Изменено', 'Кем', 'Данные'], dates: [5] },
  pend: { name: 'Предложения', n: 14, head: ['Пакет', 'Вид', 'Ид', 'Название', 'Была версия', 'Кем', 'Когда', 'Статус', 'Комментарий', 'Данные', 'Ответ технолога', 'Решение', 'Кто решил', 'После доработки пакета'], dates: [7, 12] },
  parch: { name: 'Архив предложений', n: 14, head: ['Пакет', 'Вид', 'Ид', 'Название', 'Была версия', 'Кем', 'Когда', 'Статус', 'Комментарий', 'Данные', 'Ответ технолога', 'Решение', 'Кто решил', 'После доработки пакета'], dates: [7, 12] },
  log: { name: 'Журнал', n: 9, head: ['Когда', 'Кем', 'Действие', 'Вид', 'Название', 'Комментарий', 'Версия', 'Было', 'Ид'], dates: [1] },
  usr: { name: 'Пользователи', n: 9, head: ['Ид', 'ФИО (логин)', 'Права', 'Код (хэш)', 'Состояние', 'Создан', 'Последний вход', 'Было до отключения', 'Регионы'], dates: [6, 7] },
  dir: { name: 'Справочники', n: 7, head: ['Вид', 'Ид', 'Название', 'Версия', 'Изменено', 'Кем', 'Данные'], dates: [5] },
  rev: { name: 'Ревизии', n: 14, head: ['Ид', 'Номер', 'Регион', 'Точка', 'Статус', 'Версия', 'Изменено', 'Кем', 'Дата ревизии', 'Сводка', 'Данные 1', 'Данные 2', 'Данные 3', 'Данные 4'], dates: [7] }
};
var WAIT = 'ждёт', OK = 'принято', NO = 'отклонено', REW = 'на доработке', REP = 'доработано', WD = 'снято';
var FOLDER_NAME = 'ТТК калькулятора', PEND_NAME = 'На проверке';
var MAX_DOCX = 3 * 1024 * 1024;
var DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function setup() {
  sheet_('pub'); sheet_('pend'); sheet_('log');
  var f = folders_(true);
  try { rsetup_({ regs: TREG_DEFAULT, by: 'setup' }); } catch (e) { Logger.log('Папки регионов создастся калькулятор при первом открытии «ТТК в облаке» технологом.'); }
  Logger.log('Листы созданы. Папка для файлов ТТК: ' + f.root.getUrl());
  try { Logger.log('Файл с адресом подключения: ' + ptr_(true).getUrl()); } catch (e) { Logger.log('Файл с адресом создастся при первом подключении технолога.'); }
  Logger.log('Теперь разверните скрипт как веб-приложение (см. комментарий в начале файла).');
}

/* ---------- чтение (адрес с ?callback=… отвечает как скрипт, так страница получает данные без CORS) ---------- */
function doGet(e) {
  var p = (e && e.parameter) || {}, out, role = '';
  if (!p.a && !p.callback) return servePage_();          // открыли адрес в браузере: отдаём страницу калькулятора (если технолог её загрузил)
  try {
    /* данные общей базы отдаются только по коду любой роли; открыты лишь проверка связи и итог своей записи */
    if (p.a === 'pull' || p.a === 'pending' || p.a === 'log' || p.a === 'files' || p.a === 'file' || p.a === 'prices' || p.a === 'pprev' || p.a === 'parch' || p.a === 'pfile' || p.a === 'bkinfo' || p.a === 'bkget' || p.a === 'pageinfo' || p.a === 'inbox' || p.a === 'lay' || p.a === 'fcidx' || p.a === 'fcget' || p.a === 'fcusers' || p.a === 'fcmine' || p.a === 'phlist' || p.a === 'phget' || p.a === 'hist' || p.a === 'aiinfo' || p.a === 'aimodels' || p.a === 'users' || p.a === 'dir' || p.a === 'rvlist' || p.a === 'rvget') {
      role = ready_() ? role_(p.code, p.who) : '';
      if (!role) return reply_(fail_('code', 'Код не подходит'), String(p.callback || ''));
      if (AUTH_ && AUTH_.st === USR_NEW) return reply_(fail_('usrtemp', 'Сначала задайте свой код доступа'), String(p.callback || ''));
    }
    switch (p.a) {
      case 'ping': out = ping_(); break;
      case 'aiinfo': out = aiInfo_(role); break;
      case 'aimodels': out = role === 'admin' ? aiModels_() : fail_('admin', 'Это действие доступно по коду технолога'); break;
      case 'users': out = role === 'admin' ? usrList_() : fail_('admin', 'Это действие доступно по коду технолога'); break;
      case 'pull': out = pull_(Number(p.since) || 0, role); break;
      case 'pending': out = pending_(role); break;
      case 'inbox': out = inbox_(role, String(p.by || '')); break;
      case 'log': out = log_(Number(p.n) || 40, role); break;
      case 'result': out = result_(String(p.rid || '')); break;
      case 'files': out = files_(String(p.fresh) === '1', role); break;
      case 'file': out = file_(p.id, role); break;
      case 'prices': out = prices_(role); break;
      case 'pprev': out = pprev_(String(p.reg || ''), String(p.h || ''), role); break;
      case 'parch': out = parch_(String(p.reg || ''), role); break;
      case 'pfile': out = pfile_(p.id, role); break;
      case 'pageinfo': out = pageInfo_(); break;
      case 'bkinfo': out = bkInfo_(role, String(p.by || ''), p.bkt); break;
      case 'bkget': out = bkGet_(role, String(p.by || ''), String(p.which || ''), p.bkt); break;
      case 'lay': out = lay_(); break;
      case 'fcidx': out = fcIdx_(role); break;
      case 'fcget': out = fcGet_(String(p.id || ''), role); break;
      case 'fcusers': out = fcUsers_(role); break;
      case 'fcmine': out = fcMineList_(role); break;
      case 'phlist': out = phListFor_(role); break;
      case 'phget': out = phGet_(String(p.id || ''), role); break;
      case 'dir': out = dirView_(role); break;
      case 'rvlist': out = rvList_(role); break;
      case 'rvget': out = rvGet_(String(p.id || ''), role); break;
      case 'hist': out = role === 'admin' ? hist_(String(p.kind || ''), String(p.sid || '')) : fail_('admin', 'Это действие доступно по коду технолога'); break;
      case 'menu': out = menu_(); break;                    // открыто без кода: только название, выход и цена продажи (для экрана до входа)
      default: out = { ok: false, err: 'a', msg: 'Неизвестное действие' };
    }
  } catch (err) {
    out = { ok: false, err: err.code || 'server', msg: String(err && err.message || err) };
  }
  return reply_(out, String(p.callback || ''));
}

/* ---------- запись: тело запроса — JSON в text/plain, результат ищется страницей по rid ---------- */
function doPost(e) {
  var req, res, cache = CacheService.getScriptCache();
  try { req = JSON.parse(e.postData.contents); } catch (x) { return reply_({ ok: false, err: 'json' }, ''); }
  var rid = String(req && req.rid || '');
  if (!/^[\w-]{6,60}$/.test(rid)) return reply_({ ok: false, err: 'rid' }, '');
  var done = cache.get('r:' + rid);
  if (done) return reply_(JSON.parse(done), '');          // тот же запрос пришёл второй раз: повторно не выполняем
  if (req && req.op === 'ai') {                           // ответ ИИ ждут секунды: таблицу на это время не блокируем, чужие сохранения не стоят
    try { res = ready_() ? aiRun_(req, role_(req.code, req.by)) : fail_('setup', 'В скрипте не заданы коды (EDITOR_CODE и ADMIN_CODE) или два кода одинаковые.'); }
    catch (err) { res = { ok: false, err: err.code || 'server', msg: String(err && err.message || err) }; }
    cache.put('r:' + rid, JSON.stringify(res), 21600);
    return reply_(res, '');
  }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
  } catch (x) {
    res = { ok: false, err: 'busy', msg: 'Таблица занята другим сохранением, повторите через минуту' };
    cache.put('r:' + rid, JSON.stringify(res), 21600);
    return reply_(res, '');
  }
  try {
    done = cache.get('r:' + rid);
    res = done ? JSON.parse(done) : handle_(req);
  } catch (err) {
    res = { ok: false, err: err.code || 'server', msg: String(err && err.message || err) };
  } finally {
    lock.releaseLock();
  }
  cache.put('r:' + rid, JSON.stringify(res), 21600);
  return reply_(res, '');
}

function reply_(obj, cb) {
  var s = JSON.stringify(obj);
  if (/^[\w$.]{1,60}$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + s + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON);
}
function fail_(code, msg) { return { ok: false, err: code, msg: msg }; }
function err_(code, msg) { var e = new Error(msg); e.code = code; return e; }

/* ---------- права ---------- */
function set_(c) { c = String(c == null ? '' : c); return c.indexOf('ЗАМЕНИТЕ') < 0 && c.length >= 4; }
function ready_() {
  var codes = [EDITOR_CODE, ADMIN_CODE], i, j;
  if (!set_(EDITOR_CODE) || !set_(ADMIN_CODE)) return false;
  if (set_(FINANCE_CODE)) codes.push(FINANCE_CODE);
  if (set_(VIEW_CODE)) codes.push(VIEW_CODE);
  if (set_(AUDIT_CODE)) codes.push(AUDIT_CODE);
  for (i = 0; i < codes.length; i++) for (j = i + 1; j < codes.length; j++) if (String(codes[i]) === String(codes[j])) return false;
  return true;
}
/* admin — технолог; editor и finance (тер. управляющий) — видят цены, правки идут технологу на подтверждение; viewer (шеф-повар) — видит цены, ничего не меняет */
function role_(code, who) {
  code = String(code == null ? '' : code);
  AUTH_ = null;
  if (!code) return '';
  if (code === String(ADMIN_CODE)) return 'admin';
  if (code === String(EDITOR_CODE)) return 'editor';
  if (set_(FINANCE_CODE) && code === String(FINANCE_CODE)) return 'finance';
  if (set_(VIEW_CODE) && code === String(VIEW_CODE)) return 'viewer';
  if (set_(AUDIT_CODE) && code === String(AUDIT_CODE)) return 'audit';        // общий код без имени: ФИО для входа не нужно
  var u = usrFind_(code, who);                       // не общий код: ищем среди именных (нужны и ФИО, и код)
  return u ? u.role : '';
}

/* ---------- регионы доступа (версия 26) ----------
   У технолога доступны все регионы. Остальным регионы назначает технолог: именному пользователю — в таблице «Пользователи» (столбец «Регионы»),
   общему коду (редактор, тер. управляющий, шеф-повар, аудит) — в свойстве скрипта «rs». Пока регионы не назначены, список пуст: человек видит только общие
   справочники (КБЖУ сырья, состав и технологию карт без регионов), а цены, карты, файлы и копии регионов — нет. Каждый запрос проверяется здесь,
   а не в калькуляторе: регион из запроса сверяется с тем, кто вошёл. */
var MAIN_KEYS = ['price', 'priceUnit', 'packG', 'priceSrc'];          // цена сырья основного региона (main) лежит в самой позиции, остальных регионов — в px[регион]
var SHARED_ROLES = ['editor', 'finance', 'viewer', 'audit'];
function regIds_(list) {
  var out = [], seen = {};
  (Array.isArray(list) ? list : []).slice(0, MAX_REGS * 2).forEach(function (x) { x = String(x == null ? '' : x); if (REG_RE.test(x) && !seen[x]) { seen[x] = 1; out.push(x); } });
  return out.slice(0, MAX_REGS);
}
function rsShared_() { var v = parse_(PropertiesService.getScriptProperties().getProperty('rs')); return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; }
/* null — все регионы (технолог); иначе список разрешённых (пустой, пока технолог ничего не назначил). Вызывается после role_() в том же запросе */
function scope_(role) {
  if (role === 'admin') return null;
  if (AUTH_) return Array.isArray(AUTH_.regs) ? AUTH_.regs.slice() : [];
  return regIds_(rsShared_()[role]);
}
function scopeSet_(role) { if (role === 'admin') return true; if (AUTH_) return Array.isArray(AUTH_.regs); return Array.isArray(rsShared_()[role]); }
function rgHas_(sc, id) { return sc === null || sc.indexOf(String(id).split(':')[0]) > -1; }   // ключ цены точки «регион:точка» относится к региону
function noReg_() { return err_('region', 'Этот регион вам не назначен: попросите технолога открыть доступ'); }
/* позиция общей базы глазами человека с ограниченными регионами: null — позиции для него нет совсем (карта чужого региона); у остальных чужие цены вырезаны */
function rgView_(kind, json, sc) {
  if (sc === null || !json || typeof json !== 'object' || json._del) return json;
  var o = JSON.parse(JSON.stringify(json)), g;
  if (kind === 'ing') {
    if (!rgHas_(sc, 'main')) MAIN_KEYS.forEach(function (k) { delete o[k]; });
    if (o.px && typeof o.px === 'object') { for (g in o.px) if (!rgHas_(sc, g)) delete o.px[g]; if (!Object.keys(o.px).length) delete o.px; }
    return o;
  }
  if (kind === 'rec') {
    if (o.reg && !rgHas_(sc, o.reg)) return null;
    if (o.sell && typeof o.sell === 'object') { for (g in o.sell) if (!rgHas_(sc, g)) delete o.sell[g]; if (!Object.keys(o.sell).length) delete o.sell; }
    return o;
  }
  return o;
}
/* Запись человека с ограниченными регионами. Позиции уходят в общую базу целиком, а у него чужих цен нет: поэтому чужое берётся из того, что лежит в базе сейчас
   (cur), присланное по чужим регионам отбрасывается. Карту чужого региона нельзя ни изменить, ни создать под тем же названием, ни перенести в чужой регион. */
function rgMerge_(kind, inc, cur, sc) {
  if (sc === null || !inc || typeof inc !== 'object' || inc._del) return inc;
  cur = (cur && typeof cur === 'object' && !cur._del) ? cur : null;
  var o = JSON.parse(JSON.stringify(inc)), g, keep = {};
  if (kind === 'ing') {
    if (!rgHas_(sc, 'main')) MAIN_KEYS.forEach(function (k) { if (cur && cur[k] !== undefined) o[k] = cur[k]; else delete o[k]; });
    if (cur && cur.px && typeof cur.px === 'object') for (g in cur.px) if (!rgHas_(sc, g)) keep[g] = cur.px[g];
    if (o.px && typeof o.px === 'object') for (g in o.px) if (rgHas_(sc, g)) keep[g] = o.px[g];
    if (Object.keys(keep).length) o.px = keep; else delete o.px;
    return o;
  }
  if (kind === 'rec') {
    if (cur && cur.reg && !rgHas_(sc, cur.reg)) throw noReg_();
    if (o.reg && !rgHas_(sc, o.reg)) throw noReg_();
    if (cur && cur.sell && typeof cur.sell === 'object') for (g in cur.sell) if (!rgHas_(sc, g)) keep[g] = cur.sell[g];
    if (o.sell && typeof o.sell === 'object') for (g in o.sell) if (rgHas_(sc, g)) keep[g] = o.sell[g];
    if (Object.keys(keep).length) o.sell = keep; else delete o.sell;
    return o;
  }
  return o;
}
/* технолог назначает регионы именному пользователю */
function usrRegsSet_(req) {
  var r = usrRow_(req.id), v = r.v.slice(), list = regIds_(req.regs);
  v[8] = JSON.stringify(list);
  sheet_('usr').getRange(r.n, 1, 1, SHEETS.usr.n).setValues([v]);
  usrDrop_();
  appendRows_('log', [[new Date(), by_(req), 'регионы назначены', 'доступ', String(v[1]), list.length ? list.join(', ') : 'нет', 0, '', String(v[0])]]);
  return { ok: true, regs: list };
}
/* технолог назначает регионы общему коду роли (regs: null — снять назначение) */
function rsSet_(req) {
  var role = String(req.role || ''), m = rsShared_(), list;
  if (SHARED_ROLES.indexOf(role) < 0) throw err_('role', 'Выберите роль общего кода');
  if (req.regs === null) delete m[role]; else { list = regIds_(req.regs); m[role] = list; }
  PropertiesService.getScriptProperties().setProperty('rs', JSON.stringify(m));
  appendRows_('log', [[new Date(), by_(req), 'регионы назначены', 'доступ', 'общий код: ' + (USR_ROLES[role] || role), req.regs === null ? 'не назначены' : (list.length ? list.join(', ') : 'нет'), 0, '', '']]);
  return { ok: true, role: role, regs: req.regs === null ? null : list };
}
/* что видит технолог: общие коды с назначенными регионами (null — не назначены) */
function rsView_() {
  var m = rsShared_(), out = {};
  SHARED_ROLES.forEach(function (r) {
    var c = r === 'editor' ? EDITOR_CODE : r === 'finance' ? FINANCE_CODE : r === 'viewer' ? VIEW_CODE : AUDIT_CODE;
    out[r] = { on: r === 'editor' || set_(c), regs: Array.isArray(m[r]) ? regIds_(m[r]) : null };
  });
  return out;
}
/* ид ТТК, которых человек с этими регионами видеть не должен (нужно журналу); считается раз на версию базы */
function hiddenRecs_(sc) {
  var key = 'hid:' + (PropertiesService.getScriptProperties().getProperty('rev') || 0) + ':' + sc.join(','), ca = CacheService.getScriptCache(), hit = null, ids, out = {};
  try { hit = ca.get(key); } catch (e0) { hit = null; }
  ids = hit ? parse_(hit) : null;
  if (!Array.isArray(ids)) {
    ids = [];
    readAll_('pub').forEach(function (r) {
      if (r[1] !== 'rec' || isDel_(r[6])) return;
      var j = parse_(r[6]), g = (j && j.reg) ? String(j.reg) : '';
      if (g && sc.indexOf(g) < 0) ids.push(String(r[0]));
    });
    try { ca.put(key, JSON.stringify(ids), 300); } catch (e1) {}
  }
  ids.forEach(function (x) { out[x] = 1; });
  return out;
}

/* ---------- именные доступы ----------
   Технолог заводит человека в калькуляторе («Личный кабинет» → «Пользователи»): ФИО и права. Скрипт сам выдаёт код из 5 цифр.
   Вход: ФИО (оно же логин) + код. Человек может сразу сменить код на свой; если технолог отметил «Задаст свой код при первом входе»,
   выданный код работает только для этого. В таблице (лист «Пользователи») код хранится только в виде хэша: технолог видит его один раз при создании. */
var USR_ROLES = { admin: 'технолог', editor: 'редактор', finance: 'тер. управляющий', viewer: 'шеф-повар' };
var USR_NEW = 'новый', USR_ON = 'активен', USR_OFF = 'отключён';
var AUTH_ = null;                                   // кто вошёл по именному доступу в этом запросе (по общему коду — null)
function login_(s) { return String(s == null ? '' : s).toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ''); }   // «Иванов А. Б.» = «иванов а б» = «ивановаб»
function usrSalt_() {
  var p = PropertiesService.getScriptProperties(), s = p.getProperty('usrSalt');
  if (!s) { s = Utilities.getUuid(); p.setProperty('usrSalt', s); }
  return s;
}
function usrHash_(code) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, usrSalt_() + ':' + String(code), Utilities.Charset.UTF_8);
  return b.map(function (x) { return ('0' + (x < 0 ? x + 256 : x).toString(16)).slice(-2); }).join('');
}
/* регионы пользователя из ячейки: список или null, если технолог их ещё не назначал */
function usrRegsOf_(v) { var t = String(v == null ? '' : v).trim(), a; if (!t) return null; a = parse_(t); return Array.isArray(a) ? regIds_(a) : null; }
function usrAll_() {
  var cache = CacheService.getScriptCache(), c = cache.get('usr:v2'), o, list;
  if (c) { o = parse_(c); if (o) return o; }
  if (!ss_().getSheetByName(SHEETS.usr.name)) list = [];       // лист появится при создании первого пользователя; пока его нет, чтение его не создаёт
  else list = readAll_('usr').filter(function (r) { return r[0] && r[1]; }).map(function (r) {
    return { id: String(r[0]), name: String(r[1]), nm: login_(r[1]), role: String(r[2]), h: String(r[3]), st: String(r[4]), at: ms_(r[5]), last: ms_(r[6]), prev: String(r[7] || ''), regs: usrRegsOf_(r[8]) };
  });
  cache.put('usr:v2', JSON.stringify(list), 600);
  return list;
}
function usrDrop_() { CacheService.getScriptCache().remove('usr:v2'); CacheService.getScriptCache().remove('usr:v1'); }
/* вход по именному коду: ФИО и код вместе; неверный код десять раз подряд закрывает вход этому ФИО на 10 минут */
function usrFind_(code, who) {
  var w = login_(who), cache = CacheService.getScriptCache(), fk = 'uf:' + w, f, list, i, u = null;
  if (!w) return null;
  list = usrAll_();
  for (i = 0; i < list.length; i++) if (list[i].nm === w) { u = list[i]; break; }
  if (!u) return null;
  f = Number(cache.get(fk) || 0);
  if (f >= 10) throw err_('locked', 'Слишком много неверных попыток входа. Подождите 10 минут и повторите.');
  if (u.h !== usrHash_(code)) { cache.put(fk, String(f + 1), 600); return null; }
  if (u.st === USR_OFF) throw err_('off', 'Доступ отключён технологом.');
  cache.remove(fk);
  AUTH_ = u;
  return u;
}
function usrCodeOk_(code) {
  code = String(code == null ? '' : code).trim();
  if (code.length < 4) throw err_('short', 'Код не короче 4 символов.');
  if (code.length > 40) throw err_('long', 'Код слишком длинный.');
  if (/\s/.test(code)) throw err_('space', 'В коде не должно быть пробелов.');
  [EDITOR_CODE, ADMIN_CODE, FINANCE_CODE, VIEW_CODE, AUDIT_CODE].forEach(function (c) { if (code === String(c)) throw err_('taken', 'Этот код нельзя, придумайте другой.'); });
  return code;
}
function usrGenCode_() {
  var i, c, bad = [EDITOR_CODE, ADMIN_CODE, FINANCE_CODE, VIEW_CODE, AUDIT_CODE].map(String);
  for (i = 0; i < 300; i++) {
    c = String(10000 + Math.floor(Math.random() * 90000));
    if (/^(\d)\1+$/.test(c) || c === '12345' || c === '54321' || bad.indexOf(c) > -1) continue;
    return c;
  }
  return String(10000 + Math.floor(Math.random() * 90000));
}
function usrRow_(id) {
  var rows = readAll_('usr'), i;
  for (i = 0; i < rows.length; i++) if (String(rows[i][0]) === String(id)) return { n: i + 2, v: rows[i] };
  throw err_('nouser', 'Такого пользователя уже нет в списке.');
}
function usrPub_(u) { return { id: u.id, name: u.name, role: u.role, st: u.st, at: u.at, last: u.last, regs: Array.isArray(u.regs) ? u.regs : null }; }
function usrList_() { return { ok: true, users: usrAll_().map(usrPub_), shared: rsView_(), regions: tregs_().map(function (g) { return { id: g.id, name: g.name }; }) }; }
function usrAdd_(req) {
  var name = String(req.name || '').replace(/\s+/g, ' ').trim().slice(0, 60), role = String(req.role || ''), nm = login_(name), list = usrAll_(), code, st, id;
  if (nm.length < 3) throw err_('name', 'Укажите фамилию и инициалы.');
  if (!USR_ROLES[role]) throw err_('role', 'Выберите права.');
  if (list.some(function (u) { return u.nm === nm; })) throw err_('dup', 'Такой пользователь уже есть: ' + name + '.');
  code = usrGenCode_();
  st = req.own === false ? USR_ON : USR_NEW;
  id = Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  var regs = req.regs === undefined || req.regs === null ? null : regIds_(req.regs);
  appendRows_('usr', [[id, name, role, usrHash_(code), st, new Date(), '', '', regs === null ? '' : JSON.stringify(regs)]]);
  usrDrop_();
  return { ok: true, user: { id: id, name: name, role: role, st: st, at: Date.now(), last: 0, regs: regs }, code: code };
}
function usrReset_(req) {
  var r = usrRow_(req.id), v = r.v.slice(), code = usrGenCode_();
  v[3] = usrHash_(code);
  if (String(v[4]) === USR_OFF) v[7] = USR_NEW; else v[4] = USR_NEW;           // отключённому доступ не возвращается
  sheet_('usr').getRange(r.n, 1, 1, SHEETS.usr.n).setValues([v]);
  usrDrop_();
  return { ok: true, code: code };
}
function usrOff_(req) {
  var r = usrRow_(req.id), v = r.v.slice(), st = String(v[4]), off = req.off !== false;
  if (off && st !== USR_OFF) { v[7] = st; v[4] = USR_OFF; }
  else if (!off && st === USR_OFF) { v[4] = String(v[7] || '') || USR_ON; v[7] = ''; }
  sheet_('usr').getRange(r.n, 1, 1, SHEETS.usr.n).setValues([v]);
  usrDrop_();
  return { ok: true };
}
function usrRole_(req) {
  var r = usrRow_(req.id), v = r.v.slice(), role = String(req.role || '');
  if (!USR_ROLES[role]) throw err_('role', 'Выберите права.');
  v[2] = role;
  sheet_('usr').getRange(r.n, 1, 1, SHEETS.usr.n).setValues([v]);
  usrDrop_();
  return { ok: true };
}
function usrDel_(req) {
  var r = usrRow_(req.id);
  sheet_('usr').deleteRow(r.n);
  usrDrop_();
  return { ok: true };
}
/* человек сам меняет свой код (и при первом входе тоже) */
function usrMine_(req) {
  if (!AUTH_) throw err_('nomine', 'Это общий код: он задан в скрипте, сменить его здесь нельзя.');
  var code = usrCodeOk_(req.newCode), r = usrRow_(AUTH_.id), v = r.v.slice();
  v[3] = usrHash_(code);
  if (String(v[4]) === USR_NEW) v[4] = USR_ON;
  sheet_('usr').getRange(r.n, 1, 1, SHEETS.usr.n).setValues([v]);
  usrDrop_();
  return { ok: true };
}
/* вход засчитывается раз в 10 минут: в таблице видно, кто давно не заходил */
function usrSeen_() {
  if (!AUTH_ || Date.now() - (AUTH_.last || 0) < 600000) return;
  try {
    var r = usrRow_(AUTH_.id), v = r.v.slice();
    v[6] = new Date();
    sheet_('usr').getRange(r.n, 1, 1, SHEETS.usr.n).setValues([v]);
    usrDrop_();
  } catch (e) { /* последний вход не записался — не страшно */ }
}
function priceRole_(role) { return role === 'admin' || role === 'editor' || role === 'finance' || role === 'viewer' || role === 'audit'; }
/* шеф-повар и аудит только читают; текст отказа зависит от кода */
function ro_(role) { return role === 'viewer' || role === 'audit'; }
function roFail_(role, what) { return fail_('viewer', role === 'audit' ? 'Это код аудита: он только смотрит и выгружает данные, ' + what + ' по нему нельзя' : 'Это код шеф-повара: он только читает' + (what === 'предлагать правки' ? ', предлагать правки по нему нельзя' : (what === 'загружать файлы' ? ', загружать файлы по нему нельзя' : ''))); }
/* закупочные цены сырья живут в отдельных полях позиции: без права на цены их вырезают. lock: вырезать ещё и цену продажи
   (в предложении кода без права на цены её быть не должно) */
function strip_(kind, json, lock) {
  if (!json || typeof json !== 'object') return json;
  var o = JSON.parse(JSON.stringify(json));
  (PRICE_KEYS[kind] || []).forEach(function (k) { delete o[k]; });
  if (lock) (LOCK_KEYS[kind] || []).forEach(function (k) { delete o[k]; });
  return o;
}
/* позиция без цен (так предлагал редактор в версиях до 8) дополняется действующими ценами из общей базы */
function fill_(kind, json, cur) {
  var o = JSON.parse(JSON.stringify(json));
  if (cur && typeof cur === 'object') (PRICE_KEYS[kind] || []).concat(LOCK_KEYS[kind] || []).forEach(function (k) { if (cur[k] !== undefined) o[k] = cur[k]; });
  return o;
}
function by_(req) {
  if (AUTH_) return String(AUTH_.name).replace(/[\r\n]+/g, ' ').trim().slice(0, 60);       // именной доступ: автор — учётная запись, а не присланное ФИО
  return String(req.by || 'без имени').replace(/[\r\n]+/g, ' ').trim().slice(0, 60) || 'без имени';
}
/* Чьи данные открывать. Именной доступ: учётная запись (присланное ФИО при этом не читается, иначе можно было бы указать чужое).
   Общий код имён не различает: там владелец — ФИО из запроса, и это сказано в справке. Но имя, занятое именным доступом, общим кодом не открывается. */
function whoIs_(by) {
  var i, l, list;
  if (AUTH_) return { acct: true, id: AUTH_.id, nm: AUTH_.nm, name: String(AUTH_.name), k: nk_(AUTH_.name) };
  l = login_(by); list = usrAll_();
  for (i = 0; l && i < list.length; i++) if (list[i].nm === l) throw err_('named', 'Это имя занято именным доступом: войдите по своему коду или впишите другое имя.');
  return { acct: false, nm: l, name: String(by || ''), k: nk_(by) };
}
function mineBy_(w, name) { return w.acct ? login_(name) === w.nm : nk_(name) === w.k; }
function note_(req) { return String(req.note || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 300); }

function handle_(req) {
  if (!ready_()) return fail_('setup', 'В скрипте не заданы коды (EDITOR_CODE и ADMIN_CODE) или два кода одинаковые: откройте скрипт, задайте их и разверните заново');
  var role = role_(req.code, req.by);
  if (!role) return fail_('code', 'Код не подходит');
  if (AUTH_ && AUTH_.st === USR_NEW && req.op !== 'auth' && req.op !== 'usrmine') return fail_('usrtemp', 'Сначала задайте свой код доступа');
  switch (req.op) {
    case 'auth':
      usrSeen_();
      var au = { ok: true, role: role, price: priceRole_(role), regs: scope_(role), rset: scopeSet_(role), uid: AUTH_ ? 'u:' + AUTH_.id : 's:' + role };
      if (AUTH_) { au.mine = true; au.name = AUTH_.name; au.temp = AUTH_.st === USR_NEW; }
      return au;
    case 'usrmine': return usrMine_(req);
    case 'usradd': case 'usrreset': case 'usroff': case 'usrrole': case 'usrdel': case 'usrregs': case 'rssc':
      if (role !== 'admin') return fail_('admin', 'Это действие доступно по коду технолога');
      if (req.op === 'usrregs') return usrRegsSet_(req);
      if (req.op === 'rssc') return rsSet_(req);
      if (req.op === 'usradd') return usrAdd_(req);
      if (req.op === 'usrreset') return usrReset_(req);
      if (req.op === 'usroff') return usrOff_(req);
      if (req.op === 'usrrole') return usrRole_(req);
      return usrDel_(req);
    case 'fcput': return fcPut_(req, role);                   // с версии 30: отчёты, планы и назначения фудкоста на сервере
    case 'fcact': return fcAct_(req, role);
    case 'fcdel': return fcDel_(req, role);
    case 'relget': case 'relput': return rel_(req, role);       // с версии 29: какой выпуск приложения человек уже прочитал («Что изменилось»); по общему коду не хранится
    case 'dirput': return dirPut_(req, role);
    case 'rvput': return rvPut_(req, role, false);
    case 'rvfinish': return rvPut_(req, role, true);
    case 'rvdel': return rvDel_(req, role);
    case 'propose':
      if (ro_(role)) return roFail_(role, 'предлагать правки');
      return propose_(req, role);
    case 'phput':
      if (ro_(role)) return roFail_(role, 'менять шапки');
      return phPut_(req, role);
    case 'bkput':                                    // копия данных своего пользователя: доступна по любому коду, кроме аудита (у него нет имени и нечего сохранять)
      if (role === 'audit') return roFail_(role, 'сохранять копии данных');
      return bkPut_(req, role);
    case 'upload':
      if (ro_(role)) return roFail_(role, 'загружать файлы');
      return upload_(req, role);
    case 'fwithdraw':
      if (ro_(role) || role === 'finance') return fail_('viewer', 'По этому коду файлы в облаке недоступны');
      return fwithdraw_(req);
    case 'rwclose':
      if (ro_(role)) return roFail_(role, 'закрывать уведомления');
      return rwClose_(req);
    case 'publish': case 'pricesPublish': case 'pagePut': case 'addr': case 'approve': case 'reject': case 'rework': case 'revert': case 'fapprove': case 'frework': case 'freject': case 'fdelete': case 'fmove': case 'frestore': case 'phdel': case 'dcreate': case 'drename': case 'ddelete': case 'rsetup': case 'layPut': case 'aikey':
      if (role !== 'admin') return fail_('admin', 'Это действие доступно по коду технолога');
      if (req.op === 'publish') return publish_(req);
      if (req.op === 'pricesPublish') return pricesPublish_(req);
      if (req.op === 'pagePut') return pagePut_(req);
      if (req.op === 'addr') return addr_(req);
      if (req.op === 'approve') return approve_(req);
      if (req.op === 'reject') return reject_(req);
      if (req.op === 'rework') return rework_(req);
      if (req.op === 'fapprove') return fapprove_(req);
      if (req.op === 'freject') return freject_(req);
      if (req.op === 'frework') return frework_(req);
      if (req.op === 'fdelete') return fdelete_(req);
      if (req.op === 'fmove') return fmove_(req);
      if (req.op === 'frestore') return frestore_(req);
      if (req.op === 'phdel') return phDel_(req);
      if (req.op === 'dcreate') return dcreate_(req);
      if (req.op === 'drename') return drename_(req);
      if (req.op === 'ddelete') return ddelete_(req);
      if (req.op === 'rsetup') return rsetup_(req);
      if (req.op === 'layPut') return layPut_(req);
      if (req.op === 'aikey') return aiKey_(req);
      return revert_(req);
  }
  return fail_('op', 'Неизвестная операция');
}

/* ---------- папки меню: общие для всех кодов ----------
   Технолог присылает список папок и сиды блюд в каждой; хранится кусками в свойствах скрипта (одно свойство — до 9 КБ, кусок 4000 знаков). Читать может любой код. */
var LAY_CHUNK = 4000, LAY_CHUNKS = 30, LAY_CATS = 60, LAY_SID = /^[\w.~-]{1,64}$/;
/* Папки меню и (с версии 25) список блюд для посетителей. Хранится одним текстом по кускам: пока ручной выбор блюд не включён, это просто список папок
   (как в прежних версиях), после включения — {c: папки, g: ид блюд, которые видят посетители}. g = null — прежнее поведение: видно каждое блюдо с ценой продажи. */
function layDoc_() {
  var pr = PropertiesService.getScriptProperties(), n = Number(pr.getProperty('layN') || 0), s = '', i;
  for (i = 0; i < n; i++) s += String(pr.getProperty('lay' + i) || '');
  var v = n ? parse_(s) : null;
  if (Array.isArray(v)) return { c: v, g: null, x: [] };
  if (v && typeof v === 'object' && Array.isArray(v.c)) return { c: v.c, g: Array.isArray(v.g) ? v.g : null, x: Array.isArray(v.x) ? v.x : [] };
  return { c: [], g: null, x: [] };
}
function layRead_() { return layDoc_().c; }
var LAY_GM_MAX = 3000;
var GM_HOLD = /проработ|внутрен/i;                       // папки, блюда из которых по умолчанию гостям не показываются (то же правило GP_WORK в калькуляторе)
function layGm_(list) {
  var out = [], dup = {};
  (Array.isArray(list) ? list : []).slice(0, LAY_GM_MAX * 2).forEach(function (x) { x = String(x == null ? '' : x); if (LAY_SID.test(x) && !dup[x]) { dup[x] = 1; out.push(x); } });
  out.sort();
  return out.slice(0, LAY_GM_MAX);
}
function layClean_(list) {
  var out = [], seen = {};
  (Array.isArray(list) ? list : []).slice(0, LAY_CATS).forEach(function (c) {
    if (!c) return;
    var n = String(c.n == null ? '' : c.n).replace(/\s+/g, ' ').trim().slice(0, 60), k = nk_(n);
    if (!n || !k || seen[k]) return;
    seen[k] = 1;
    var r = [], dup = {};
    (Array.isArray(c.r) ? c.r : []).forEach(function (x) { x = String(x == null ? '' : x); if (LAY_SID.test(x) && !dup[x]) { dup[x] = 1; r.push(x); } });
    r.sort();
    out.push({ n: n, r: r });
  });
  return out;
}
/* Меню для тех, кто ещё не вошёл по коду: только название блюда, выход порции, номер ТТК и цена продажи по регионам, папки меню и список регионов.
   Состава, сырья, закупочных цен и себестоимости здесь нет. */
function menu_() {
  var pr = PropertiesService.getScriptProperties(), rev = Number(pr.getProperty('rev') || 0), lay = Number(pr.getProperty('layRev') || 0),
    cache = CacheService.getScriptCache(), key = 'menu:' + rev + ':' + lay + ':3', hit = null, items = [], regs = [], out, doc, pub = null, cats, have = {}, hold = null;
  try { hit = cache.get(key); } catch (e0) { hit = null; }
  if (hit) { var c = parse_(hit); if (c) { c.pgb = pgBld_(); return c; } }
  doc = layDoc_();
  if (doc.g !== null) { pub = {}; doc.g.forEach(function (x) { pub[x] = 1; }); }       // технолог отметил блюда вручную: цена блюдо уже не публикует
  else {                                                                               // по умолчанию — только допущенные: не архив, не «на проработке»/внутренние, выход указан
    hold = {};
    doc.x.forEach(function (x) { hold[x] = 1; });                                        // архив технолога (список приходит из калькулятора вместе с папками)
    doc.c.forEach(function (c) { if (GM_HOLD.test(String(c.n || ''))) (c.r || []).forEach(function (x) { hold[x] = 1; }); });
  }
  readAll_('pub').forEach(function (r) {
    if (r[1] !== 'rec' || isDel_(r[6])) return;
    if (pub && !pub[String(r[0])]) return;
    var j = parse_(r[6]), p = {}, any = false;
    if (!j || typeof j !== 'object') return;
    if (hold && (j.arch || hold[String(r[0])] || !(Number(j.output) > 0))) return;
    Object.keys(j.sell && typeof j.sell === 'object' ? j.sell : {}).forEach(function (g) {
      var v = Number(j.sell[g]);
      if (REG_RE.test(g) && isFinite(v) && v > 0) { p[g] = Math.round(v * 100) / 100; any = true; }
    });
    if (!any) return;
    var it = { s: String(r[0]), n: String(r[2]).slice(0, 140), o: Number(j.output) > 0 ? Number(j.output) : 0, t: String(j.ttk && j.ttk.num || '').slice(0, 20), g: REG_RE.test(String(j.reg || '')) ? String(j.reg) : '', p: p }, ds = {}, dn = 0;
    Object.keys(j.ds && typeof j.ds === 'object' ? j.ds : {}).forEach(function (g) {      // декларация о соответствии по регионам (версия 31): номер и срок
      var x = j.ds[g];
      if (!REG_RE.test(g) || !x || typeof x !== 'object' || dn >= 16) return;
      ds[g] = { n: String(x.n || '').slice(0, 80) }; dn++;
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(x.v || ''))) ds[g].v = String(x.v);
    });
    if (dn) it.d = ds;
    items.push(it);
  });
  try { regsOf_(folders_(false)).forEach(function (g) { regs.push({ id: g.id, name: g.name }); }); } catch (e1) { regs = []; }
  if (!regs.length) regs = TREG_DEFAULT.map(function (g) { return { id: g.id, name: g.name }; });
  cats = doc.c;
  if (pub) {                                              // в ручном режиме гостям уходят только папки, в которых есть показанные блюда, и только их блюда
    items.forEach(function (it) { have[it.s] = 1; });
    cats = cats.map(function (c) { return { n: c.n, r: (c.r || []).filter(function (x) { return have[x]; }) }; }).filter(function (c) { return c.r.length; });
  }
  out = { ok: true, rev: rev, regs: regs, cats: cats, items: items, exp: !!pub };
  try { var txt = JSON.stringify(out); if (txt.length < 90000) cache.put(key, txt, 300); } catch (e2) {}
  out.pgb = pgBld_();                                    // не кладётся в кэш: номер сборки меняется при загрузке страницы, а не данных
  return out;
}

function lay_() {
  var pr = PropertiesService.getScriptProperties();
  return { ok: true, rev: Number(pr.getProperty('layRev') || 0), by: String(pr.getProperty('layBy') || ''), at: Number(pr.getProperty('layAt') || 0), cats: layRead_(), gm: layDoc_().g, arch: layDoc_().x };
}
/* Что присылает технолог: cats — папки; gm — полный список блюд для посетителей (null — вернуть показ по цене) или gmOn / gmOff — добавить / убрать блюда
   (так одновременные правки двух технологов не затирают друг друга). Чего нет в запросе, то остаётся как было. */
function layPut_(req) {
  var pr = PropertiesService.getScriptProperties(), rev = Number(pr.getProperty('layRev') || 0), old = layDoc_(),
    cats = req.cats === undefined ? old.c : layClean_(req.cats), g = old.g, set = {}, doc, s, ar = old.x, aset = {};
  /* архивные блюда: полным списком (arch) или добавить / убрать (archOn / archOff); в меню для посетителей по умолчанию они не попадают */
  if (Array.isArray(req.arch)) ar = layGm_(req.arch);
  else if (Array.isArray(req.archOn) || Array.isArray(req.archOff)) {
    ar.forEach(function (x) { aset[x] = 1; });
    layGm_(req.archOn).forEach(function (x) { aset[x] = 1; });
    layGm_(req.archOff).forEach(function (x) { delete aset[x]; });
    ar = Object.keys(aset).sort();
  }
  if (req.gm !== undefined) g = req.gm === null ? null : layGm_(req.gm);
  else if (Array.isArray(req.gmOn) || Array.isArray(req.gmOff)) {
    if (g === null) throw err_('gm', 'Ручной выбор блюд для посетителей не включён: сначала включите его');
    g.forEach(function (x) { set[x] = 1; });
    layGm_(req.gmOn).forEach(function (x) { set[x] = 1; });
    layGm_(req.gmOff).forEach(function (x) { delete set[x]; });
    g = Object.keys(set).sort();
  }
  doc = (g === null && !ar.length) ? cats : { c: cats, g: g, x: ar };
  s = JSON.stringify(doc);
  if (s.length > LAY_CHUNK * LAY_CHUNKS) throw err_('many', 'Слишком много блюд в папках меню для одного хранилища');
  if (stable_(old.c) === stable_(cats) && stable_(old.g) === stable_(g) && stable_(old.x) === stable_(ar)) return { ok: true, rev: rev, same: true, cats: cats.length, gm: g, arch: ar };
  var oldN = Number(pr.getProperty('layN') || 0), n = Math.ceil(s.length / LAY_CHUNK), i;
  for (i = 0; i < n; i++) pr.setProperty('lay' + i, s.slice(i * LAY_CHUNK, (i + 1) * LAY_CHUNK));
  for (i = n; i < oldN; i++) pr.deleteProperty('lay' + i);
  rev++;
  pr.setProperty('layN', String(n)); pr.setProperty('layRev', String(rev)); pr.setProperty('layBy', by_(req)); pr.setProperty('layAt', String(Date.now()));
  return { ok: true, rev: rev, cats: cats.length, gm: g, arch: ar };
}

/* ---------- файл с адресом подключения: маленькая таблица на Диске, которую читает калькулятор ---------- */
function ptr_(create) {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('ptrId'), book = null;
  if (id) { try { book = SpreadsheetApp.openById(id); } catch (e) { book = null; } }
  if (!book && create) {
    book = SpreadsheetApp.create(PTR_NAME);
    props.setProperty('ptrId', book.getId());
    props.setProperty('ptrUrl', book.getUrl());
  }
  return book;
}
function addr_(req) {
  var url = String(req.url || '').trim();
  if (!EXEC_RE.test(url)) throw err_('url', 'Это не адрес веб-приложения: он должен начинаться с https://script.google.com/ и оканчиваться на /exec');
  var props = PropertiesService.getScriptProperties(), fresh = !props.getProperty('ptrId'), book;
  try { book = ptr_(true); } catch (e) { throw driveErr_(e); }
  var sh = book.getSheets()[0], cur = String(sh.getRange(1, 1, 1, 1).getValues()[0][0] || ''), shared = true;
  if (cur !== url) {
    sh.getRange(1, 1, 3, 1).setValues([[url], ['Это адрес общей базы ТехнолоGии. Его обновляет скрипт, вручную не правьте. Доступ к таблице: все, у кого есть ссылка, только чтение.'], ['Обновлено: ' + new Date().toISOString()]]);
  }
  if (fresh || String(props.getProperty('ptrShared')) !== '1') {
    try {
      DriveApp.getFileById(book.getId()).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      props.setProperty('ptrShared', '1');
    } catch (e) { shared = false; }
  }
  return { ok: true, ptr: book.getUrl(), changed: cur !== url, shared: shared };
}

/* ---------- листы ---------- */
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function fmtCols_(s, key, from) {
  var d = SHEETS[key];
  /* всё, что не дата и не номер версии, хранится как текст: «=…» в названии не станет формулой */
  for (var c = from; c <= d.n; c++) {
    if (d.dates.indexOf(c) > -1) s.getRange(2, c, s.getMaxRows() - 1, 1).setNumberFormat('dd.MM.yyyy HH:mm');
    else if (!isNum_(key, c)) s.getRange(2, c, s.getMaxRows() - 1, 1).setNumberFormat('@');
  }
}
/* лист «Предложения» из прежних версий скрипта: четыре новых столбца (ответ технолога, решение, кто решил, после доработки) дописываются один раз */
function pendMigrate_(s) {
  var props = PropertiesService.getScriptProperties(), d = SHEETS.pend;
  if (props.getProperty('pend14') === '1') return;
  if (String(s.getRange(1, 11, 1, 1).getValues()[0][0] || '') === '') {
    s.getRange(1, 11, 1, d.n - 10).setValues([d.head.slice(10)]);
    s.getRange(1, 11, 1, d.n - 10).setFontWeight('bold');
  }
  fmtCols_(s, 'pend', 11);
  props.setProperty('pend14', '1');
}
/* лист «Пользователи» из прежних версий: девятый столбец «Регионы» (пусто — регионы не назначены) */
function usrMigrate_(s) {
  var props = PropertiesService.getScriptProperties(), d = SHEETS.usr;
  if (props.getProperty('usr9') === '1') return;
  if (s.getMaxColumns() < d.n) s.insertColumnsAfter(s.getMaxColumns(), d.n - s.getMaxColumns());
  if (String(s.getRange(1, 9, 1, 1).getValues()[0][0] || '') === '') { s.getRange(1, 9, 1, 1).setValues([[d.head[8]]]); s.getRange(1, 9, 1, 1).setFontWeight('bold'); }
  s.getRange(2, 9, s.getMaxRows() - 1, 1).setNumberFormat('@');
  props.setProperty('usr9', '1');
}
function sheet_(key) {
  var d = SHEETS[key], s = ss_().getSheetByName(d.name);
  if (!s) {
    s = ss_().insertSheet(d.name);
    s.appendRow(d.head);
    s.setFrozenRows(1);
    s.getRange(1, 1, 1, d.n).setFontWeight('bold');
    fmtCols_(s, key, 1);
    if (key === 'pend') PropertiesService.getScriptProperties().setProperty('pend14', '1');
    if (key === 'usr') PropertiesService.getScriptProperties().setProperty('usr9', '1');
  } else if (key === 'pend') pendMigrate_(s);
  else if (key === 'usr') usrMigrate_(s);
  return s;
}
function isNum_(key, c) { return (key === 'pub' && c === 4) || ((key === 'pend' || key === 'parch') && c === 5) || (key === 'log' && c === 7) || (key === 'dir' && c === 4) || (key === 'rev' && c === 6); }
function readAll_(key) {
  var s = sheet_(key), n = SHEETS[key].n, last = s.getLastRow();
  return last < 2 ? [] : s.getRange(2, 1, last - 1, n).getValues();
}
function ensureRows_(s, count) {
  var need = count + 1 - s.getMaxRows();
  if (need > 0) s.insertRowsAfter(s.getMaxRows(), need);
}
function writeAll_(key, rows) {
  if (!rows.length) return;
  var s = sheet_(key), n = SHEETS[key].n;
  ensureRows_(s, rows.length);
  s.getRange(2, 1, rows.length, n).setValues(rows);
}
function appendRows_(key, rows) {
  if (!rows.length) return;
  var s = sheet_(key), n = SHEETS[key].n, last = Math.max(s.getLastRow(), 1);
  ensureRows_(s, last + rows.length);
  s.getRange(last + 1, 1, rows.length, n).setValues(rows);
}
/* Листы растут (общая база, журнал предложений), а опрос идёт у каждого человека каждые 45 секунд. Поэтому горячие запросы читают только нужные столбцы
   и нужные строки, а запись меняет только изменённые строки: стоимость запроса не зависит от истории. */
function readCol_(key, col) {                 // один столбец, со второй строки
  var s = sheet_(key), last = s.getLastRow();
  return last < 2 ? [] : s.getRange(2, col, last - 1, 1).getValues().map(function (r) { return r[0]; });
}
function rowsAt_(key, idxs, total) {          // строки по номерам (с нуля); рядом стоящие читаются одним обращением, а если их много, дешевле взять лист целиком
  var s = sheet_(key), n = SHEETS[key].n, out = new Array(idxs.length), i = 0, j, q, run, all;
  if (idxs.length > 12) { all = s.getRange(2, 1, total, n).getValues(); return idxs.map(function (k) { return all[k]; }); }
  while (i < idxs.length) {
    j = i; while (j + 1 < idxs.length && idxs[j + 1] === idxs[j] + 1) j++;
    run = s.getRange(idxs[i] + 2, 1, j - i + 1, n).getValues();
    for (q = i; q <= j; q++) out[q] = run[q - i];
    i = j + 1;
  }
  return out;
}
/* Запись только изменённых строк: рядом стоящие — одним обращением. by — столбец, по возрастанию которого писать (версия): читающий в любой момент видит
   «начало» пачки, а не её середину, и его отметка «получено до версии N» никого не пропускает. jc — столбец с JSON, по его размеру решаем, что дешевле:
   несколько обращений или перезапись листа целиком (при большом числе изменённых строк). */
function writeRows_(key, rows, idxs, by, jc) {
  if (!idxs.length) return;
  var s = sheet_(key), n = SHEETS[key].n, chars = 0, i, list = idxs.slice(), runs = [], cur = null, top = 0;
  for (i = 0; i < rows.length; i++) chars += String(rows[i][jc] || '').length;
  list.sort(function (a, b) { return by === undefined ? a - b : ((Number(rows[a][by]) || 0) - (Number(rows[b][by]) || 0)) || (a - b); });
  if (list.length > 3 + Math.floor(chars / 150000)) { ensureRows_(s, rows.length); s.getRange(2, 1, rows.length, n).setValues(rows); return; }
  list.forEach(function (k) {
    if (k > top) top = k;
    if (cur && k === cur.last + 1) { cur.rows.push(rows[k]); cur.last = k; }
    else { cur = { from: k, last: k, rows: [rows[k]] }; runs.push(cur); }
  });
  ensureRows_(s, top + 1);
  runs.forEach(function (r) { s.getRange(r.from + 2, 1, r.rows.length, n).setValues(r.rows); });
}
function ms_(v) { return v instanceof Date ? v.getTime() : (Number(v) || 0); }
function parse_(s) { try { return JSON.parse(s); } catch (e) { return null; } }
/* ключи по алфавиту: одинаковое содержимое всегда даёт одинаковую строку, лишних версий не появляется */
function stable_(v) {
  if (Array.isArray(v)) return '[' + v.map(stable_).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + stable_(v[k]); }).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
function nk_(s) { return String(s == null ? '' : s).toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim(); }

function rev_() {
  var v = Number(PropertiesService.getScriptProperties().getProperty('rev') || 0), col = readCol_('pub', 4);
  col.forEach(function (c) { var x = Number(c) || 0; if (x > v) v = x; });
  return v;
}
function setRev_(n) { PropertiesService.getScriptProperties().setProperty('rev', String(n)); }
/* удалённая позиция: строка остаётся с новой версией и этим значением, чтобы удаление дошло до всех при следующем получении */
var DEL_JSON = '{"_del":1}';
function isDel_(js) { return String(js) === DEL_JSON; }

/* ---------- чтение ---------- */
function pendWaiting_() {
  var s = sheet_('pend'), last = s.getLastRow(), b, st, seen = {}, n = 0, i;
  if (last < 2) return 0;
  b = s.getRange(2, 1, last - 1, 1).getValues(); st = s.getRange(2, 8, last - 1, 1).getValues();
  for (i = 0; i < b.length; i++) if (st[i][0] === WAIT && !seen[b[i][0]]) { seen[b[i][0]] = 1; n++; }
  return n;
}
function ping_() {
  return { ok: true, v: VERSION, rev: rev_(), pending: pendWaiting_(), ready: ready_(), lay: Number(PropertiesService.getScriptProperties().getProperty('layRev') || 0), fv: Number(PropertiesService.getScriptProperties().getProperty('fv') || 0), ptr: PropertiesService.getScriptProperties().getProperty('ptrUrl') || '', pgb: pgBld_(), pga: pgAt_(), phv: Number(PropertiesService.getScriptProperties().getProperty('phv') || 0), ai: aiReady_() ? 1 : 0, aip: aiProv_(), dr: Number(PropertiesService.getScriptProperties().getProperty('dirRev') || 0), rr: Number(PropertiesService.getScriptProperties().getProperty('rvRev') || 0) };
}
function pull_(since, role) {
  var sc = scope_(role);
  /* отметка «получено до версии N» берётся из столбца версий в момент чтения; строки, которые успели измениться позже, отдаются новыми, но отметка не растёт: следующий запрос их не пропустит */
  var pr = priceRole_(role), top = Number(PropertiesService.getScriptProperties().getProperty('rev') || 0), revs = readCol_('pub', 4), total = revs.length, want = [], items = [], rows, i, rv;
  for (i = 0; i < total; i++) { rv = Number(revs[i]) || 0; if (rv > top) top = rv; if (rv > since) want.push(i); }
  rows = want.length ? rowsAt_('pub', want, total) : [];
  rows.forEach(function (r) {
    var x = Number(r[3]) || 0, j = pr ? parse_(r[6]) : strip_(r[1], parse_(r[6]));
    if (sc !== null) { j = rgView_(r[1], j, sc); if (j === null) return; }       // карта чужого региона не отдаётся совсем, у остального чужие цены вырезаны
    items.push({ sid: String(r[0]), kind: r[1], name: String(r[2]), rev: x, at: ms_(r[4]), by: String(r[5]), json: j });
  });
  return { ok: true, rev: top, total: total, items: items, regs: sc };
}
/* что сейчас лежит в общей базе по позиции (по ид, иначе по названию): чтобы дополнить предложение без цен действующими ценами */
function pubJson_(pub, kind, sid, name) {
  var i, hit = null;
  for (i = 0; i < pub.length; i++) { if (pub[i][1] === kind && String(pub[i][0]) === sid) { hit = pub[i]; break; } }
  if (!hit) for (i = 0; i < pub.length; i++) { if (pub[i][1] === kind && nk_(pub[i][2]) === nk_(name) && !isDel_(pub[i][6])) { hit = pub[i]; break; } }
  return (hit && !isDel_(hit[6])) ? parse_(hit[6]) : null;
}
/* пакеты предложений из строк листа: pick — какие строки брать. Позиции без цен (метка _np, предложения до версии 8) дополняются действующими ценами */
function pendBatches_(rows, pick, role) {
  var order = [], by = {}, pr = priceRole_(role), pub = null, sc = scope_(role);
  rows.forEach(function (r) {
    if (!pick(r)) return;
    var b = String(r[0]), j = parse_(r[9]), kind = r[1], sid = String(r[2]), nm = String(r[3]);
    var np = !!(j && j._np);
    if (np) delete j._np;
    if (j && j._rg !== undefined) delete j._rg;
    if (np || !pr) {       // у старого предложения редактора цен нет; смотрящему без права на закупочные цены они не положены
      pub = pub || readAll_('pub');
      var cur = pubJson_(pub, kind, sid, nm);
      if (!pr) j = strip_(kind, j, true);   // предложенную, ещё не принятую цену продажи такому коду не показываем: у него действующая
      j = fill_(kind, j, cur);
      if (!pr) j = strip_(kind, j);
    }
    if (sc !== null && j) { j = rgView_(kind, j, sc); if (j === null) return; }
    if (!by[b]) {
      by[b] = { batch: b, by: String(r[5]), at: ms_(r[6]), note: String(r[8] || ''), reply: String(r[10] || ''), decided: ms_(r[11]), reviewer: String(r[12] || ''), re: String(r[13] || ''), st: String(r[7] || ''), items: [] };
      order.push(b);
    }
    by[b].items.push({ kind: kind, sid: sid, name: nm, baseRev: Number(r[4]) || 0, json: j });
  });
  return order.map(function (b) { return by[b]; });
}
function pending_(role) {
  var rows = readAll_('pend'), batches = pendBatches_(rows, function (r) { return r[7] === WAIT; }, role), rework = [];
  /* повторное предложение после доработки показывает, что технолог писал в прошлый раз */
  batches.forEach(function (b) {
    if (!b.re) return;
    var i; b.prevReply = '';
    for (i = 0; i < rows.length; i++) if (String(rows[i][0]) === b.re && rows[i][10]) { b.prevReply = String(rows[i][10]); break; }
  });
  if (role === 'admin') rework = pendBatches_(rows, function (r) { return r[7] === REW; }, role);
  return { ok: true, batches: batches, rework: rework };
}
/* уведомления автору: что технолог вернул ему на доработку (автор — по ФИО, как оно записано в предложении) */
function inbox_(role, who) {
  var w = null, rows;
  try { w = whoIs_(who); } catch (e) { w = null; }                       // имя занято чужой учётной записью — уведомлений нет
  if (!w || !w.k || ro_(role)) return { ok: true, batches: [], files: [], rejected: [] };
  rows = readAll_('pend');
  var list = pendBatches_(rows, function (r) { return r[7] === REW && mineBy_(w, r[5]); }, role), files = [], limit = Date.now() - 30 * 86400000;
  list.sort(function (a, b) { return b.decided - a.decided; });
  /* отклонённое технологом за последний месяц: автор видит причину, пока не нажмёт «Понятно» */
  var rejected = pendBatches_(rows, function (r) { return r[7] === NO && mineBy_(w, r[5]) && ms_(r[11]) > limit; }, role);
  rejected.sort(function (a, b) { return b.decided - a.decided; });
  if (role === 'editor' || role === 'admin') {                       // файлы, которые технолог вернул автору (из списка файлов, он кэшируется)
    try {
      (filesAll_(false).files || []).forEach(function (x) {
        if (x.kind === 'pend' && x.st === 'rework' && mineBy_(w, x.by)) files.push({ id: x.id, name: x.name, reply: x.reply, reviewer: x.reviewer, decided: x.decided });
      });
      files.sort(function (a, b) { return b.decided - a.decided; });
    } catch (e) { files = []; }
  }
  return { ok: true, batches: list, files: files, rejected: rejected };
}
var LOG_REG_KINDS = { 'цены': 1, 'история': 1, 'регион': 1, 'файл': 1, 'папка': 1, 'доступ': 1 };
function log_(n, role) {
  n = Math.max(1, Math.min(200, n));
  var sc = role === undefined ? null : scope_(role), hid = sc !== null ? hiddenRecs_(sc) : null;
  var s = sheet_('log'), last = s.getLastRow(), from = Math.max(2, last - n + 1), out = [], i, rows = last < 2 ? [] : s.getRange(from, 1, last - from + 1, SHEETS.log.n).getValues();
  for (i = rows.length - 1; i >= 0 && out.length < n; i--) {
    var r = rows[i];
    if (sc !== null && (LOG_REG_KINDS[String(r[3])] || (String(r[3]) === 'rec' && hid[String(r[8] || '')]))) continue;      // записи про регионы, файлы и карты чужих регионов ограниченному не показываются
    out.push({ at: ms_(r[0]), by: String(r[1]), action: String(r[2]), kind: String(r[3]), name: String(r[4]), note: String(r[5] || ''), rev: Number(r[6]) || 0, sid: String(r[8] || ''), hasPrev: !!r[7] });
  }
  return { ok: true, items: out };
}
function result_(rid) {
  var v = rid ? CacheService.getScriptCache().get('r:' + rid) : null;
  return v ? { ok: true, done: true, res: JSON.parse(v) } : { ok: true, done: false };
}

/* ---------- файлы .docx на Google Диске ---------- */
function driveErr_(e) {
  var m = String(e && e.message || e);
  if (/permission|разрешени|authoriz|доступ/i.test(m)) return err_('drive', 'Скрипту нужен доступ к Google Диску. Откройте скрипт, выберите функцию «setup», нажмите «Выполнить», разрешите доступ, затем создайте новую версию развёртывания.');
  return e;
}
/* create=false: только найти (для чтения); true: создать недостающие папки */
function folders_(create) {
  var props = PropertiesService.getScriptProperties(), root = null, pend = null, id;
  function open_(key) {
    var v = props.getProperty(key), fo = null;
    if (v) { try { fo = DriveApp.getFolderById(v); if (fo.isTrashed()) fo = null; } catch (x) { fo = null; } }
    return fo;
  }
  root = open_('folder');
  if (!root) { if (!create) return null; root = DriveApp.createFolder(FOLDER_NAME); props.setProperty('folder', root.getId()); }
  pend = open_('folderPend');
  if (!pend) { if (!create) return null; pend = root.createFolder(PEND_NAME); props.setProperty('folderPend', pend.getId()); }
  return { root: root, pend: pend };
}
function inFolder_(fl, fo) {
  var it = fl.getParents();
  while (it.hasNext()) { if (it.next().getId() === fo.getId()) return true; }
  return false;
}
function cacheDrop_() {
  try { CacheService.getScriptCache().remove('fl'); } catch (e) {}
  try { var pr = PropertiesService.getScriptProperties(); pr.setProperty('fv', String((Number(pr.getProperty('fv')) || 0) + 1)); } catch (e2) {}      // версия списка файлов: калькуляторы по ней узнают, что в облаке что-то изменилось
}

/* ---------- папки регионов: «ТТК калькулятора» / регион / (подпапки библиотеки) ---------- */
var TREG_DEFAULT = [{ id: 'main', name: 'Волгоград' }, { id: 'msk', name: 'Москва' }];      // как в калькуляторе; список там можно менять
var REG_RE = /^[a-z0-9_-]{1,40}$/i;
var MAX_DIRS = 100, MAX_PER_FOLDER = 600, MAX_REGS = 20;
function dirName_(s) { return String(s == null ? '' : s).replace(/[\\\/:*?"<>|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60); }
function tregs_() { var v = parse_(PropertiesService.getScriptProperties().getProperty('tregs')); return Array.isArray(v) ? v : []; }
function tregsSet_(a) { PropertiesService.getScriptProperties().setProperty('tregs', JSON.stringify(a)); }
/* существующие папки регионов в порядке, в каком их завёл калькулятор; пропавшие (удалённые) просто не попадают в список */
function regsOf_(f) {
  if (f.regs) return f.regs;
  var out = [];
  tregs_().forEach(function (r) {
    var fo = pfOpenFolder_(r.fo);
    if (fo && inFolder_(fo, f.root)) out.push({ id: r.id, name: fo.getName(), fo: fo });
  });
  f.regs = out;
  return out;
}
function regNameTaken_(f, name, exceptId) {
  var k = nk_(name);
  if (k === nk_(PEND_NAME) || k === nk_(ARCH_NAME)) return true;
  return regsOf_(f).some(function (g) { return g.id !== exceptId && nk_(g.name) === k; });
}
/* найти (создать) папку региона id; name — название из калькулятора. Одноимённая папка, уже лежавшая в «ТТК калькулятора», становится папкой региона. */
function regEnsure_(f, id, name) {
  id = String(id == null ? '' : id);
  if (!REG_RE.test(id)) throw err_('noreg', 'Неверный регион');
  var g = regsOf_(f).filter(function (x) { return x.id === id; })[0];
  name = dirName_(name);
  if (g) return g;
  if (!name) throw err_('noreg', 'Папка региона не найдена: нажмите «Обновить список»');
  if (regNameTaken_(f, name, id)) throw err_('taken', 'Название «' + name + '» уже занято другим регионом');
  var fo = null, it = f.root.getFolders(), used = {};
  tregs_().forEach(function (r) { used[r.fo] = 1; });
  while (it.hasNext() && !fo) {
    var c = it.next();
    if (!c.isTrashed() && c.getId() !== f.pend.getId() && !used[c.getId()] && nk_(c.getName()) === nk_(name)) fo = c;
  }
  if (!fo) fo = f.root.createFolder(name);
  var st = tregs_().filter(function (r) { return r.id !== id; });
  st.push({ id: id, name: fo.getName(), fo: fo.getId() });
  tregsSet_(st);
  f.regs = null;
  appendRows_('log', [[new Date(), 'скрипт', 'папка создана', 'регион', fo.getName(), '', 0, '', fo.getId()]]);
  return regsOf_(f).filter(function (x) { return x.id === id; })[0];
}
function cleanRegs_(list) {
  var out = [], seen = {}, names = {};
  (Array.isArray(list) ? list : []).slice(0, MAX_REGS).forEach(function (g) {
    var id = String(g && g.id || ''), nm = dirName_(g && g.name);
    if (!REG_RE.test(id) || seen[id] || !nm) return;
    if (names[nk_(nm)]) nm = dirName_(nm + ' ' + id);
    seen[id] = 1; names[nk_(nm)] = 1;
    out.push({ id: id, name: nm });
  });
  return out;
}
/* технолог: привести папки регионов к списку калькулятора (создать недостающие, переименовать по названию региона) */
function rsetup_(req) {
  try {
    var f = folders_(true), list = cleanRegs_(req.regs), made = 0, ren = 0;
    if (!list.length) throw err_('noreg', 'Список регионов пуст');
    list.forEach(function (g) {
      var cur = regsOf_(f).filter(function (x) { return x.id === g.id; })[0];
      if (!cur) { regEnsure_(f, g.id, g.name); made++; return; }
      if (cur.fo.getName() !== g.name && !regNameTaken_(f, g.name, g.id)) {
        var was = cur.fo.getName();
        cur.fo.setName(g.name);
        var st = tregs_();
        st.forEach(function (r) { if (r.id === g.id) r.name = g.name; });
        tregsSet_(st);
        f.regs = null; ren++;
        appendRows_('log', [[new Date(), by_(req), 'папка переименована', 'регион', g.name, 'было: «' + was + '»', 0, '', cur.fo.getId()]]);
      }
    });
    if (made || ren) cacheDrop_();
    return { ok: true, made: made, renamed: ren, regs: regsOf_(f).map(function (g) { return { id: g.id, name: g.name }; }) };
  } catch (e) { throw e.code ? e : driveErr_(e); }
}
/* подпапки библиотеки: внутри папки региона, а также прежние подпапки «ТТК калькулятора» (reg = '', «Без региона») */
function dirs_(f) {
  var out = [], regs = regsOf_(f), skip = {}, ar = archFolder_(f, false);
  skip[f.pend.getId()] = 1;
  if (ar) skip[ar.getId()] = 1;
  regs.forEach(function (g) { skip[g.fo.getId()] = 1; });
  function scan(parent, reg) {
    var it = parent.getFolders();
    while (it.hasNext()) {
      var fo = it.next();
      if (fo.isTrashed()) continue;
      if (!reg && skip[fo.getId()]) continue;
      out.push({ id: fo.getId(), name: fo.getName(), reg: reg, fo: fo });
    }
  }
  scan(f.root, '');
  regs.forEach(function (g) { scan(g.fo, g.id); });
  var order = {}; regs.forEach(function (g, i) { order[g.id] = i + 1; });
  out.sort(function (a, b) { return ((order[a.reg] || 0) - (order[b.reg] || 0)) || String(a.name).localeCompare(String(b.name), 'ru'); });
  return out;
}
/* место для файла: reg — регион ('' — без региона), dir — подпапка ('' — прямо в папку региона); по чужому идентификатору ничего не находится */
function place_(f, reg, dir) {
  reg = String(reg == null ? '' : reg); dir = String(dir == null ? '' : dir);
  if (dir) {
    var all = dirs_(f), i;
    for (i = 0; i < all.length; i++) if (all[i].id === dir) return { fo: all[i].fo, reg: all[i].reg, dir: dir };
    throw err_('nodir', 'Папка не найдена: возможно, её уже удалили. Обновите список');
  }
  if (!reg) return { fo: f.root, reg: '', dir: '' };
  var g = regsOf_(f).filter(function (x) { return x.id === reg; })[0];
  if (!g) throw err_('noreg', 'Папка региона не найдена: нажмите «Обновить список»');
  return { fo: g.fo, reg: reg, dir: '' };
}
/* то же, но недостающую папку региона технолог получает сразу (название берётся из калькулятора) */
function target_(f, reg, regName, dir) {
  reg = String(reg == null ? '' : reg); dir = String(dir == null ? '' : dir);
  if (!dir && reg) regEnsure_(f, reg, regName);
  return place_(f, reg, dir);
}
function dirTaken_(f, reg, name, exceptId) {
  var k = nk_(name), all = dirs_(f), i;
  if (!reg && (k === nk_(PEND_NAME) || k === nk_(ARCH_NAME) || regsOf_(f).some(function (g) { return nk_(g.name) === k; }))) return true;
  for (i = 0; i < all.length; i++) if (all[i].id !== exceptId && all[i].reg === reg && nk_(all[i].name) === k) return true;
  return false;
}
/* файл только из наших папок (where: 'pend' — «На проверке», 'lib' — библиотека: корень, регионы и подпапки, 'any' — любые): по чужому идентификатору скрипт ничего не отдаёт */
function fileIn_(id, f, where) {
  id = String(id || '');
  if (!/^[\w-]{10,80}$/.test(id)) throw err_('id', 'Неверный идентификатор файла');
  var fl;
  try { fl = DriveApp.getFileById(id); } catch (e) { throw err_('nofile', 'Файл не найден'); }
  if (fl.isTrashed()) throw err_('nofile', 'Файл не найден в папке ТТК');
  var okPend = where !== 'lib' && where !== 'arch', okLib = where !== 'pend' && where !== 'arch', okArch = where === 'any' || where === 'arch', ok = false, libIds = null, it = fl.getParents(), ar = okArch ? archFolder_(f, false) : null;
  while (it.hasNext() && !ok) {
    var pid = it.next().getId();
    if (ar && pid === ar.getId()) ok = true;
    else if (okPend && pid === f.pend.getId()) ok = true;
    else if (okLib) {
      if (pid === f.root.getId()) ok = true;
      else {
        if (!libIds) { libIds = dirs_(f).map(function (d) { return d.id; }); regsOf_(f).forEach(function (g) { libIds.push(g.fo.getId()); }); }
        if (libIds.indexOf(pid) > -1) ok = true;
      }
    }
  }
  if (!ok) throw err_('nofile', 'Файл не найден в папке ТТК');
  return fl;
}
/* список файлов, регионов и папок; ответ хранится в кэше скрипта 10 минут и сбрасывается любой записью, «Обновить» (fresh) читает Диск заново.
   Коды шеф-повара и аудита получают только принятые файлы, код тер. управляющего — отказ: библиотека ему не нужна. */
function files_(fresh, role) {
  if (role === 'finance') throw err_('role', 'Библиотека ТТК в облаке для вашего кода не открывается');
  var res = filesAll_(fresh), sc = scope_(role);
  if (ro_(role) && res.files) res = { ok: true, ready: res.ready, v: res.v, files: res.files.filter(function (x) { return x.kind === 'main'; }), dirs: res.dirs, regs: res.regs, fv: res.fv };
  if (sc !== null && res.files) {       // только свои регионы; файлы и папки без региона — общие, их видят все
    res = { ok: true, ready: res.ready, v: res.v, fv: res.fv, regs: (res.regs || []).filter(function (g) { return rgHas_(sc, g.id); }), dirs: (res.dirs || []).filter(function (d) { return !d.reg || rgHas_(sc, d.reg); }),
      files: res.files.filter(function (x) { return x.kind === 'pend' ? (!x.wantReg || rgHas_(sc, x.wantReg)) : (!x.reg || rgHas_(sc, x.reg)); }), scoped: true };
  }
  return res;
}
function filesAll_(fresh) {
  var f;
  try { f = folders_(false); } catch (e) { throw driveErr_(e); }
  if (!f) return { ok: true, ready: false, v: VERSION, files: [], dirs: [], regs: [] };
  var cache = CacheService.getScriptCache();
  if (!fresh) { var c = cache.get('fl'); if (c) { try { return JSON.parse(c); } catch (x) {} } }
  var out = [], dl = [], rl = [];
  try {
    var ds = dirs_(f), rg = regsOf_(f);
    ds.forEach(function (d) { dl.push({ id: d.id, name: d.name, reg: d.reg }); });
    rg.forEach(function (g) { rl.push({ id: g.id, name: g.name }); });
    var places = [['main', '', '', f.root]];
    rg.forEach(function (g) { places.push(['main', g.id, '', g.fo]); });
    ds.forEach(function (d) { places.push(['main', d.reg, d.id, d.fo]); });
    places.push(['pend', '', '', f.pend]);
    var arF = archFolder_(f, false);
    if (arF) places.push(['arch', '', '', arF]);
    places.forEach(function (p) {
      var it = p[3].getFiles(), n = 0;
      while (it.hasNext() && n < MAX_PER_FOLDER) {
        var fl = it.next(), nm = fl.getName();
        if (!/\.docx$/i.test(nm)) continue;
        var meta = parse_(fl.getDescription() || '') || {}, pend = p[0] === 'pend', am = p[0] === 'arch' ? (meta.arch || {}) : null;
        out.push({ id: fl.getId(), name: nm, size: fl.getSize(), at: fl.getLastUpdated().getTime(), by: String(meta.by || ''), kind: p[0], reg: am ? String(am.reg || '') : p[1], dir: am ? String(am.dir || '') : p[2],
          arch: am ? { at: Number(am.at) || 0, by: String(am.by || ''), why: String(am.why || ''), name: String(am.name || '') } : undefined,
          rep: pend && meta.rep ? String(meta.rep) : '',
          want: pend ? String(meta.dir || '') : '', wantReg: pend ? String(meta.reg || '') : '',
          st: pend && meta.st === 'rework' ? 'rework' : '', reply: pend && meta.st === 'rework' ? String(meta.reply || '') : '',
          reviewer: pend && meta.st === 'rework' ? String(meta.reviewer || '') : '', decided: pend && meta.st === 'rework' ? Number(meta.decided) || 0 : 0 });
        n++;
      }
    });
  } catch (e) { throw driveErr_(e); }
  out.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'ru'); });
  var res = { ok: true, ready: true, v: VERSION, files: out, dirs: dl, regs: rl, fv: Number(PropertiesService.getScriptProperties().getProperty('fv') || 0) };
  try { cache.put('fl', JSON.stringify(res), 600); } catch (x) {}     // слишком большой ответ (больше 100 КБ) не кэшируется
  return res;
}
/* регион файла библиотеки: папка региона или её подпапка; «На проверке» — регион, который указал автор; архив — регион, откуда файл ушёл; '' — файл без региона (общий) */
function fileRegion_(f, fl) {
  var meta = parse_(fl.getDescription() || '') || {}, it = fl.getParents(), pid, ar = archFolder_(f, false);
  while (it.hasNext()) {
    pid = it.next().getId();
    if (ar && pid === ar.getId()) return REG_RE.test(String((meta.arch || {}).reg || '')) ? String(meta.arch.reg) : '';
    if (pid === f.pend.getId()) return REG_RE.test(String(meta.reg || '')) ? String(meta.reg) : '';
  }
  return whereOf_(f, fl).reg || '';
}
function file_(id, role) {
  try {
    if (role === 'finance') throw err_('role', 'Библиотека ТТК в облаке для вашего кода не открывается');
    var f = folders_(false);
    if (!f) throw err_('nofolder', 'Папка с файлами ещё не создана: выполните «setup» в скрипте');
    var fl = fileIn_(id, f, ro_(role) ? 'lib' : 'any'), sc = scope_(role);          // шеф-повар и аудит: только принятые файлы
    var frg = sc !== null ? fileRegion_(f, fl) : '';
    if (frg && !rgHas_(sc, frg)) throw err_('nofile', 'Файл не найден в папке ТТК');       // файл чужого региона: так же, как будто его нет
    if (fl.getSize() > MAX_DOCX) throw err_('size', 'Файл больше 3 МБ');
    return { ok: true, name: fl.getName(), b64: Utilities.base64Encode(fl.getBlob().getBytes()) };
  } catch (e) { throw e.code ? e : driveErr_(e); }
}
function upload_(req, role) {
  var name = String(req.name || '').replace(/[\\\/:*?"<>|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!/\.docx$/i.test(name)) throw err_('ext', 'Нужен файл Word с расширением .docx');
  name = name.slice(0, -5).trim().slice(0, 140).trim() + '.docx';            // длинное имя укорачиваем, не теряя расширения
  if (name === '.docx') throw err_('ext', 'У файла нет имени');
  var b64 = String(req.b64 || '');
  if (!b64) throw err_('empty', 'Файл пустой');
  if (b64.length > Math.ceil(MAX_DOCX * 4 / 3) + 16) throw err_('size', 'Файл больше 3 МБ');
  var bytes;
  try { bytes = Utilities.base64Decode(b64); } catch (e) { throw err_('b64', 'Файл повредился при передаче, повторите'); }
  if (bytes.length > MAX_DOCX) throw err_('size', 'Файл больше 3 МБ');
  if (bytes.length < 100 || bytes[0] !== 80 || bytes[1] !== 75) throw err_('docx', 'Это не файл .docx');
  var now = new Date(), by = by_(req), admin = role === 'admin', want = req.dir == null ? '' : String(req.dir), wantReg = req.reg == null ? '' : String(req.reg);
  try {
    var f = folders_(true), target, sugDir = '', sugReg = '', pl, where = '';
    if (admin) {                                                    // технолог кладёт сразу в выбранный регион и папку
      pl = target_(f, wantReg, req.regName, want);
      target = pl.fo;
      where = pl.reg ? regsOf_(f).filter(function (g) { return g.id === pl.reg; }).map(function (g) { return g.name; })[0] || '' : '';
    } else {                                                        // редактор: в «На проверке», выбранный регион и папка — пожелание технологу
      target = f.pend;
      var scU = scope_(role);
      if (wantReg && !rgHas_(scU, wantReg)) throw noReg_();
      if (REG_RE.test(wantReg)) sugReg = wantReg;
      try { pl = place_(f, wantReg, want); if (pl.reg && !rgHas_(scU, pl.reg)) throw noReg_(); sugDir = pl.dir; if (pl.reg) sugReg = pl.reg; } catch (x) { if (x && x.code === 'region') throw x; sugDir = ''; }
      var cnt = 0, pi = f.pend.getFiles();                          // «На проверке» не должна разрастаться бесконечно
      while (pi.hasNext()) { pi.next(); cnt++; }
      if (cnt >= 100) throw err_('full', 'В папке «На проверке» уже 100 файлов: попросите технолога разобрать их');
    }
    var repId = '', archived = [];
    if (req.rep) { try { repId = fileIn_(req.rep, f, 'lib').getId(); } catch (xr) { repId = ''; } }     // файл, который исправляет эта версия
    var it = target.getFilesByName(name), same = [];
    while (it.hasNext()) same.push(it.next());
    if (admin) {                                                    // технолог: прежние версии уходят в архив, новая встаёт на их место
      same.forEach(function (o) { archived.push(archive_(f, o, by, 'заменён новой версией', whereOf_(f, o))); });
      oldsFor_(f, repId, name, pl.reg, '').forEach(function (o) { archived.push(archive_(f, o, by, 'заменён новой версией', whereOf_(f, o))); });
    } else same.forEach(function (o) { o.setTrashed(true); });     // «На проверке»: файл с тем же именем автора заменяется
    var fl = target.createFile(Utilities.newBlob(bytes, DOCX_MIME, name));
    fl.setDescription(JSON.stringify({ by: by, at: now.getTime(), dir: sugDir, reg: sugReg, rep: admin ? '' : repId }));
    appendRows_('log', [[now, by, admin ? 'файл добавлен' : 'файл предложен', 'файл', name, (note_(req) || (where ? 'Регион: «' + where + '».' : '')) + (archived.length ? ' В архив: ' + archived.join(', ') + '.' : ''), 0, '', fl.getId()]]);
    cacheDrop_();
    return { ok: true, id: fl.getId(), kind: admin ? 'main' : 'pend', name: name, archived: archived.length };
  } catch (e) { throw e.code ? e : driveErr_(e); }
}
/* ---------- архив прежних версий: «ТТК калькулятора» / «Архив» ----------
   Когда исправленная ТТК заменяет прежний файл, прежний не удаляется, а уходит в «Архив» с пометкой, откуда он и кто заменил. */
var ARCH_NAME = 'Архив';
var TTK_STOP = { 'ттк': 1, 'г': 1, 'гр': 1, 'мл': 1, 'кг': 1, 'л': 1, 'шт': 1, 'порц': 1, 'порция': 1, 'выход': 1, 'docx': 1 };
function ttkKey_(name) {
  return nk_(String(name || '').replace(/\.docx$/i, '').replace(/[0-9]+(?:[.,][0-9]+)?/g, ' ')).split(' ').filter(function (w) { return w && !TTK_STOP[w]; }).join(' ');
}
function ttkNum_(name) { var m = /№\s*(\d+)/.exec(String(name || '')); return m ? m[1] : ''; }
/* размер порции из названия: все числа, кроме номера ТТК («100 гр» → 100, «250/10» → 250/10) */
function ttkSize_(name) { return (String(name || '').replace(/\.docx$/i, '').replace(/№\s*\d+/g, ' ').match(/\d+(?:[.,]\d+)?/g) || []).join('/').replace(/,/g, '.'); }
/* тот же файл ТТК: то же блюдо и тот же номер; если номера нет у одного из двух, совпасть должна и порция */
function ttkSame_(a, b) {
  var ka = ttkKey_(a), kb = ttkKey_(b), na = ttkNum_(a), nb = ttkNum_(b), sa, sb;
  if (!ka || ka !== kb) return false;
  if (na && nb) return na === nb;
  sa = ttkSize_(a); sb = ttkSize_(b);
  return !sa || !sb || sa === sb;
}
function archFolder_(f, create) {
  var fo = openFolder_('folderArch');
  if (!fo && create) { fo = f.root.createFolder(ARCH_NAME); PropertiesService.getScriptProperties().setProperty('folderArch', fo.getId()); }
  return fo;
}
/* где лежит файл библиотеки: регион и папка (для пометки в архиве и для возврата) */
function whereOf_(f, fl) {
  var it = fl.getParents(), res = { reg: '', dir: '' }, regs = regsOf_(f), ds = null;
  while (it.hasNext()) {
    var pid = it.next().getId(), i;
    for (i = 0; i < regs.length; i++) if (regs[i].fo.getId() === pid) return { reg: regs[i].id, dir: '' };
    if (!ds) ds = dirs_(f);
    for (i = 0; i < ds.length; i++) if (ds[i].id === pid) return { reg: ds[i].reg, dir: ds[i].id };
  }
  return res;
}
function archive_(f, fl, by, why, where) {
  var ar = archFolder_(f, true), nm = fl.getName(), meta = parse_(fl.getDescription() || '') || {}, now = new Date();
  var stamp = now.toISOString().slice(0, 16).replace('T', ' ').replace(':', '-');
  meta.arch = { at: now.getTime(), by: String(by || ''), why: String(why || ''), reg: (where && where.reg) || '', dir: (where && where.dir) || '', name: nm };
  fl.setDescription(JSON.stringify(meta));
  fl.setName(nm.replace(/\.docx$/i, '') + ' (до ' + stamp + ').docx');
  fl.moveTo(ar);
  return nm;
}
/* файлы библиотеки региона reg ('' — без региона: корень и прежние папки), у которых то же блюдо и номер ТТК, что у файла name */
function similarIn_(f, name, reg, exceptId) {
  var out = [], seen = {};
  if (!ttkKey_(name)) return out;
  var places = [];
  if (reg) { regsOf_(f).forEach(function (g) { if (g.id === reg) places.push(g.fo); }); }
  else places.push(f.root);
  dirs_(f).forEach(function (d) { if ((d.reg || '') === (reg || '')) places.push(d.fo); });
  places.forEach(function (fo) {
    var it = fo.getFiles(), n = 0;
    while (it.hasNext() && n < MAX_PER_FOLDER) {
      var fl = it.next(), nm = fl.getName(), id = fl.getId();
      n++;
      if (!/\.docx$/i.test(nm) || id === exceptId || seen[id]) continue;
      if (ttkSame_(name, nm)) { seen[id] = 1; out.push(fl); }
    }
  });
  return out;
}
/* что заменяет новый файл: явно названный прежний файл или единственный похожий в регионе (если похожих несколько, ничего не трогаем) */
function oldsFor_(f, repId, name, reg, exceptId) {
  var out = [];
  if (repId && repId !== exceptId) { try { var r = fileIn_(repId, f, 'lib'); if (!r.isTrashed()) out.push(r); } catch (x) {} }
  if (out.length) return out;
  var sim = similarIn_(f, name, reg || '', exceptId);
  return sim.length === 1 ? sim : [];
}
/* технолог: вернуть файл из архива на прежнее место (текущая версия на этом месте уходит в архив) */
function frestore_(req) {
  try {
    var f = folders_(true), fl = fileIn_(req.id, f, 'arch'), meta = parse_(fl.getDescription() || '') || {}, am = meta.arch || {}, now = new Date(), adm = by_(req), pl, orig = String(am.name || '').trim();
    if (!orig) orig = fl.getName().replace(/ \(до [^)]*\)(\.docx)$/i, '$1');
    try { pl = place_(f, am.reg || '', am.dir || ''); } catch (x) { pl = { fo: f.root, reg: '', dir: '' }; }
    var cur = pl.fo.getFilesByName(orig), list = [];
    while (cur.hasNext()) list.push(cur.next());
    list.forEach(function (o) { archive_(f, o, adm, 'заменён файлом из архива', whereOf_(f, o)); });
    delete meta.arch;
    fl.setDescription(JSON.stringify(meta));
    fl.setName(orig);
    fl.moveTo(pl.fo);
    appendRows_('log', [[now, adm, 'файл возвращён из архива', 'файл', orig, placeNote_(f, pl).trim(), 0, '', fl.getId()]]);
    cacheDrop_();
    return { ok: true, name: orig };
  } catch (e) { throw e.code ? e : driveErr_(e); }
}

/* ---------- история цен: общая для всех кодов ----------
   Записи загрузок из 1С (период, регион, объект, цены и закупки по строкам) лежат файлами в папке «История цен ТехнолоГии» на Диске, по файлу на регион, период и объект
   (объект — склад из выгрузки; у прежних записей объекта нет и имя без хвоста): их видят все, кто вошёл по коду, независимо от того, кто загрузил выгрузку.
   Заменённая или удалённая запись попадает в корзину Диска и хранится там 30 дней. */
var PH_NAME = 'История цен ТехнолоГии', MAX_PH = 3 * 1024 * 1024, MAX_PH_LIST = 1500, PH_RE = /^ph_(.+?)_(\d{8})_(\d{8})(?:_(o[a-z0-9]{3,24}))?$/i;
function phIdOk_(id) { return /^ph_[a-z0-9_-]{1,40}_\d{8}_\d{8}(?:_o[a-z0-9]{3,24})?$/i.test(String(id || '')); }
function phFolder_(create) {
  var fo = openFolder_('phRoot');
  if (!fo && create) { try { fo = DriveApp.createFolder(PH_NAME); } catch (e) { throw driveErr_(e); } PropertiesService.getScriptProperties().setProperty('phRoot', fo.getId()); }
  return fo;
}
function phBump_() {
  var pr = PropertiesService.getScriptProperties(); pr.setProperty('phv', String((Number(pr.getProperty('phv')) || 0) + 1));
  try { var ca = CacheService.getScriptCache(), k = Number(ca.get('phl')) || 0, keys = ['phl']; for (var i = 0; i < k; i++) keys.push('phl' + i); ca.removeAll(keys); } catch (e) {}
}
/* список в кэше кусками: одно значение кэша не больше 100 КБ, а записей может быть сотни (объекты × месяцы) */
function phCacheGet_(ca, v) {
  try {
    var k = Number(ca.get('phl')) || 0, keys = [], i;
    if (!k) return null;
    for (i = 0; i < k; i++) keys.push('phl' + i);
    var got = ca.getAll(keys), txt = '';
    for (i = 0; i < k; i++) { if (typeof got['phl' + i] !== 'string') return null; txt += got['phl' + i]; }
    var c = parse_(txt);
    return (c && c.v === v) ? c : null;
  } catch (e) { return null; }
}
function phCachePut_(ca, out) {
  try {
    var txt = JSON.stringify(out), parts = {}, k = 0, step = 30000;
    for (var i = 0; i < txt.length; i += step) { parts['phl' + k] = txt.substr(i, step); k++; }
    if (k > 20) return;
    ca.putAll(parts, 600); ca.put('phl', String(k), 600);
  } catch (e) {}
}
function phList_() {
  try {
    var pr = PropertiesService.getScriptProperties(), v = Number(pr.getProperty('phv') || 0), cache = CacheService.getScriptCache();
    var hit = phCacheGet_(cache, v);
    if (hit) return hit;
    var fo = phFolder_(false), items = [];
    if (fo) {
      var it = fo.getFiles();
      while (it.hasNext() && items.length < MAX_PH_LIST) {
        var fl = it.next(), nm = fl.getName(), id = nm.replace(/\.json$/i, '');
        if (!/\.json$/i.test(nm) || !phIdOk_(id)) continue;
        var meta = parse_(fl.getDescription() || '') || {}, m = PH_RE.exec(id);
        items.push({ id: id, region: m[1], from: m[2], to: m[3], obj: m[4] || '', at: Number(meta.at) || fl.getLastUpdated().getTime(), by: String(meta.by || ''), n: Number(meta.n) || 0, size: fl.getSize() });
      }
    }
    items.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
    var out = { ok: true, v: v, items: items };
    phCachePut_(cache, out);
    return out;
  } catch (e) { throw e.code ? e : driveErr_(e); }
}
function phRegion_(id) { var m = PH_RE.exec(String(id || '')); return m ? m[1] : ''; }
function phListFor_(role) {
  var res = phList_(), sc = scope_(role);
  if (sc === null || !res.items) return res;
  return { ok: true, v: res.v, items: res.items.filter(function (x) { return rgHas_(sc, x.region); }) };
}
function phGet_(id, role) {
  try {
    if (!phIdOk_(id)) throw err_('id', 'Неверный идентификатор записи');
    if (role !== undefined && !rgHas_(scope_(role), phRegion_(id))) throw err_('nofile', 'Запись истории не найдена');
    var fo = phFolder_(false);
    if (!fo) throw err_('nofile', 'История цен ещё не загружена');
    var it = fo.getFilesByName(id + '.json');
    if (!it.hasNext()) throw err_('nofile', 'Запись истории не найдена');
    var fl = it.next(), rec = parse_(fl.getBlob().getDataAsString('UTF-8'));
    if (!rec || typeof rec !== 'object') throw err_('bad', 'Запись истории повреждена');
    return { ok: true, id: id, rec: rec };
  } catch (e) { throw e.code ? e : driveErr_(e); }
}
function phPut_(req, role) {
  try {
    var id = String(req.id || ''), rec = req.rec;
    if (!phIdOk_(id)) throw err_('id', 'Неверный идентификатор записи');
    if (!rgHas_(scope_(role), phRegion_(id))) throw noReg_();
    if (!rec || typeof rec !== 'object' || !Array.isArray(rec.it) || !rec.it.length || rec.it.length > 4000) throw err_('rec', 'В записи истории нет цен');
    var txt = JSON.stringify(rec);
    if (txt.length > MAX_PH) throw err_('size', 'Запись истории больше 3 МБ');
    var fo = phFolder_(true), now = new Date(), by = by_(req), nm = id + '.json';
    var it = fo.getFilesByName(nm);
    while (it.hasNext()) it.next().setTrashed(true);
    var fl = fo.createFile(Utilities.newBlob(txt, 'application/json', nm));
    fl.setDescription(JSON.stringify({ by: by, at: now.getTime(), n: rec.it.length }));
    phBump_();
    appendRows_('log', [[now, by, 'история цен загружена', 'история', id, 'Позиций: ' + rec.it.length + '.', 0, '', fl.getId()]]);
    return { ok: true, id: id, n: rec.it.length };
  } catch (e) { throw e.code ? e : driveErr_(e); }
}
function phDel_(req) {
  try {
    var id = String(req.id || ''), fo = phFolder_(false), n = 0;
    if (!phIdOk_(id)) throw err_('id', 'Неверный идентификатор записи');
    if (fo) { var it = fo.getFilesByName(id + '.json'); while (it.hasNext()) { it.next().setTrashed(true); n++; } }
    if (n) { phBump_(); appendRows_('log', [[new Date(), by_(req), 'история цен удалена', 'история', id, '', 0, '', '']]); }
    return { ok: true, id: id, n: n };
  } catch (e) { throw e.code ? e : driveErr_(e); }
}

/* перенос файла в папку target; одноимённый файл там уходит в архив */
function putFile_(fl, target, f, by, why) {
  var it = target.getFilesByName(fl.getName()), list = [];
  while (it.hasNext()) { var o = it.next(); if (o.getId() !== fl.getId()) list.push(o); }
  list.forEach(function (o) { archive_(f, o, by, why || 'заменён новой версией', whereOf_(f, o)); });
  fl.moveTo(target);
}
function placeNote_(f, pl) {
  var rn = pl.reg ? (regsOf_(f).filter(function (g) { return g.id === pl.reg; }).map(function (g) { return g.name; })[0] || '') : '';
  var dn = '';
  if (pl.dir) dirs_(f).forEach(function (d) { if (d.id === pl.dir) dn = d.name; });
  return (rn ? ' Регион: «' + rn + '».' : '') + (dn ? ' Папка: «' + dn + '».' : '');
}
/* байты .docx из base64 с теми же проверками, что при загрузке */
function docxBytes_(b64) {
  b64 = String(b64 || '');
  if (!b64) throw err_('empty', 'Файл пустой');
  if (b64.length > Math.ceil(MAX_DOCX * 4 / 3) + 16) throw err_('size', 'Файл больше 3 МБ');
  var bytes;
  try { bytes = Utilities.base64Decode(b64); } catch (e) { throw err_('b64', 'Файл повредился при передаче, повторите'); }
  if (bytes.length > MAX_DOCX) throw err_('size', 'Файл больше 3 МБ');
  if (bytes.length < 100 || bytes[0] !== 80 || bytes[1] !== 75) throw err_('docx', 'Это не файл .docx');
  return bytes;
}
/* принять файл: в выбранный регион и папку; b64 — файл, который технолог пересобрал после правок карты (тогда в библиотеку идёт он, а присланный убирается) */
function fapprove_(req) {
  try {
    var f = folders_(true), fl = fileIn_(req.id, f, 'pend'), name = fl.getName(), meta = parse_(fl.getDescription() || '') || {}, now = new Date(), pl, edited = !!req.b64, bytes;
    if (edited) bytes = docxBytes_(req.b64);
    if (req.dir === undefined && req.reg === undefined) {            // без выбора технолога — пожелание автора, если такой регион и папка ещё есть
      try { pl = place_(f, meta.reg || '', meta.dir || ''); } catch (x) { pl = { fo: f.root, reg: '', dir: '' }; }
    } else pl = target_(f, req.reg, req.regName, req.dir);
    var adm = by_(req), info = JSON.stringify({ by: String(meta.by || ''), at: Number(meta.at) || now.getTime(), dir: '', reg: '' }), archived = [];
    var repId = ''; if (meta.rep) { try { repId = fileIn_(meta.rep, f, 'lib').getId(); } catch (xr) { repId = ''; } }
    if (edited) {
      var it = pl.fo.getFilesByName(name);
      while (it.hasNext()) { var so = it.next(); archived.push(archive_(f, so, adm, 'заменён исправленной версией', whereOf_(f, so))); }
      var nf = pl.fo.createFile(Utilities.newBlob(bytes, DOCX_MIME, name));
      nf.setDescription(info);
      fl.setTrashed(true);
      fl = nf;
    } else {
      var it2 = pl.fo.getFilesByName(name), so2;
      while (it2.hasNext()) { so2 = it2.next(); if (so2.getId() !== fl.getId()) { archived.push(archive_(f, so2, adm, 'заменён исправленной версией', whereOf_(f, so2))); } }
      fl.moveTo(pl.fo);
      fl.setDescription(info);                                      // статус «на доработке» и пожелания автора остаются только у файла на проверке
    }
    oldsFor_(f, repId, name, pl.reg, fl.getId()).forEach(function (o) { archived.push(archive_(f, o, adm, 'заменён исправленной версией', whereOf_(f, o))); });
    var note = 'принял: ' + adm + (edited ? ' (с правками технолога)' : '') + (note_(req) ? '. ' + note_(req) : '') + placeNote_(f, pl) + (archived.length ? ' В архив: ' + archived.join(', ') + '.' : '');
    appendRows_('log', [[now, String(meta.by || adm), edited ? 'файл принят с правками' : 'файл принят', 'файл', name, note, 0, '', fl.getId()]]);
    cacheDrop_();
    return { ok: true, name: name, edited: edited, archived: archived.length };
  } catch (e) { throw e.code ? e : driveErr_(e); }
}
/* вернуть файл автору на доработку: остаётся в «На проверке» с комментарием технолога (комментарий обязателен) */
function frework_(req) {
  try {
    var reply = note_(req);
    if (reply.length < 3) throw err_('note', 'Напишите комментарий: что нужно исправить');
    var f = folders_(true), fl = fileIn_(req.id, f, 'pend'), name = fl.getName(), meta = parse_(fl.getDescription() || '') || {}, now = new Date(), adm = by_(req);
    meta.st = 'rework'; meta.reply = reply; meta.reviewer = adm; meta.decided = now.getTime();
    fl.setDescription(JSON.stringify(meta));
    appendRows_('log', [[now, String(meta.by || adm), 'файл возвращён на доработку', 'файл', name, 'вернул: ' + adm + '. ' + reply, 0, '', fl.getId()]]);
    cacheDrop_();
    return { ok: true, name: name };
  } catch (e) { throw e.code ? e : driveErr_(e); }
}
/* автор снимает свой файл с проверки (удаляется из «На проверке») */
function fwithdraw_(req) {
  try {
    var f = folders_(true), fl = fileIn_(req.id, f, 'pend'), name = fl.getName(), meta = parse_(fl.getDescription() || '') || {}, now = new Date(), who = by_(req);
    if (nk_(String(meta.by || '')) !== nk_(who)) throw err_('own', 'Снять с проверки можно только свой файл');
    fl.setTrashed(true);
    appendRows_('log', [[now, who, 'файл снят с проверки', 'файл', name, '', 0, '', fl.getId()]]);
    cacheDrop_();
    return { ok: true, name: name };
  } catch (e) { throw e.code ? e : driveErr_(e); }
}
function freject_(req) {
  try {
    var f = folders_(true), fl = fileIn_(req.id, f, 'pend'), name = fl.getName(), meta = parse_(fl.getDescription() || '') || {}, now = new Date();
    fl.setTrashed(true);
    var adm = by_(req), note = 'отклонил: ' + adm + (note_(req) ? '. ' + note_(req) : '');
    appendRows_('log', [[now, String(meta.by || adm), 'файл отклонён', 'файл', name, note, 0, '', fl.getId()]]);
    cacheDrop_();
    return { ok: true, name: name };
  } catch (e) { throw e.code ? e : driveErr_(e); }
}
function fdelete_(req) {
  try {
    var f = folders_(true), fl = fileIn_(req.id, f, 'lib'), name = fl.getName(), now = new Date();
    fl.setTrashed(true);
    appendRows_('log', [[now, by_(req), 'файл удалён', 'файл', name, note_(req), 0, '', fl.getId()]]);
    cacheDrop_();
    return { ok: true, name: name };
  } catch (e) { throw e.code ? e : driveErr_(e); }
}
function fmove_(req) {
  try {
    var f = folders_(true), fl = fileIn_(req.id, f, 'lib'), name = fl.getName(), pl = target_(f, req.reg, req.regName, req.dir), now = new Date();
    if (inFolder_(fl, pl.fo)) return { ok: true, name: name, same: true };
    putFile_(fl, pl.fo, f, by_(req), 'заменён перемещённым файлом');
    appendRows_('log', [[now, by_(req), 'файл перемещён', 'файл', name, (placeNote_(f, pl) || ' Без региона и папки.').trim(), 0, '', fl.getId()]]);
    cacheDrop_();
    return { ok: true, name: name };
  } catch (e) { throw e.code ? e : driveErr_(e); }
}
function dcreate_(req) {
  try {
    var f = folders_(true), name = dirName_(req.name), now = new Date(), reg = req.reg == null ? '' : String(req.reg), parent;
    if (!name) throw err_('name', 'Введите название папки');
    parent = reg ? regEnsure_(f, reg, req.regName).fo : f.root;
    if (dirTaken_(f, reg, name, '')) throw err_('taken', 'Папка с таким названием уже есть (или название зарезервировано)');
    if (dirs_(f).filter(function (d) { return d.reg === reg; }).length >= MAX_DIRS) throw err_('many', 'Можно создать не больше ' + MAX_DIRS + ' папок');
    var fo = parent.createFolder(name);
    appendRows_('log', [[now, by_(req), 'папка создана', 'папка', name, reg ? 'Регион: «' + parent.getName() + '».' : '', 0, '', fo.getId()]]);
    cacheDrop_();
    return { ok: true, id: fo.getId(), name: name, reg: reg };
  } catch (e) { throw e.code ? e : driveErr_(e); }
}
function drename_(req) {
  try {
    var f = folders_(true), now = new Date();
    if (!req.id) throw err_('nodir', 'Эту папку переименовать нельзя');
    var pl = place_(f, '', req.id), fo = pl.fo, name = dirName_(req.name);
    if (!name) throw err_('name', 'Введите название папки');
    if (dirTaken_(f, pl.reg, name, fo.getId())) throw err_('taken', 'Папка с таким названием уже есть (или название зарезервировано)');
    var was = fo.getName();
    if (was !== name) {
      fo.setName(name);
      appendRows_('log', [[now, by_(req), 'папка переименована', 'папка', name, 'было: «' + was + '»', 0, '', fo.getId()]]);
    }
    cacheDrop_();
    return { ok: true, id: fo.getId(), name: name };
  } catch (e) { throw e.code ? e : driveErr_(e); }
}
function ddelete_(req) {
  try {
    var f = folders_(true), now = new Date();
    if (!req.id) throw err_('nodir', 'Эту папку удалить нельзя');
    var fo = place_(f, '', req.id).fo;
    if (fo.getFiles().hasNext() || fo.getFolders().hasNext()) throw err_('notempty', 'В папке есть файлы: сначала перенесите их в другую папку или удалите');
    var name = fo.getName();
    fo.setTrashed(true);
    appendRows_('log', [[now, by_(req), 'папка удалена', 'папка', name, '', 0, '', fo.getId()]]);
    cacheDrop_();
    return { ok: true, name: name };
  } catch (e) { throw e.code ? e : driveErr_(e); }
}

/* ---------- файлы цен по регионам: «Цены ТехнолоGии» / регион / (таблицы, Excel, «Архив») ---------- */
var PF_NAME = 'Цены ТехнолоGии';          // латинская G, как в названии калькулятора
var PF_ARCH = 'Архив';
var PF_PUB = 'Цены продажи', PF_PRV = 'Себестоимость и закупка';
var MAX_PF = 6 * 1024 * 1024, MAX_PF_ROWS = 6000, MAX_PF_COLS = 20;
var XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
var PF_FMT = { text: '@', money: '#,##0.00', pct: '0.0', int: '0', g: '' };       // g: общий формат (число как есть)
/* листы, из которых скрипт читает прежнее состояние (заголовки столбцов строки 4) */
var PF_SHEET = { sell: 'Цены продажи', sellLog: 'Изменения цен', ing: 'Сырьё', dish: 'Блюда', prvLog: 'Изменения' };
var PF_HEAD = { name: ['Блюдо', 'Сырьё'], cost: 'Себестоимость порции, ₽', sell: 'Цена продажи, ₽', price: 'Цена, ₽/кг' };

/* «Что изменилось» (версия 29): номер последнего прочитанного выпуска хранится за именной учётной записью (проект = этот скрипт).
   По общему коду имени нет: запись не ведётся, приложение помнит ознакомление на этом устройстве. Номер только растёт. */
function rel_(req, role) {
  var key, cur, v;
  if (!AUTH_) return { ok: true, shared: true };
  key = 'rl:' + AUTH_.id;
  cur = parse_(PropertiesService.getScriptProperties().getProperty(key)) || {};
  if (req.op === 'relput') {
    v = Math.floor(Number(req.v));
    if (!(v >= 0 && v < 100000)) throw err_('rel', 'Некорректный номер выпуска');
    if (!(v > (Number(cur.v) || 0))) return { ok: true, v: Number(cur.v) || 0, at: Number(cur.at) || 0 };
    cur = { v: v, at: Date.now() };
    PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(cur));
  }
  return { ok: true, v: Number(cur.v) || 0, at: Number(cur.at) || 0 };
}
/* ---------- Фудкост: отчёты, планы, назначения (версия 30) ----------
   Документы лежат файлами в папке «Фудкост ТехнолоГии» на Диске: b_… — загрузка отчёта с её строками (после записи не меняется, удаляется меткой), s_… — снимок исходных данных одной версии плана (не меняется),
   m_main — сопоставления номенклатуры и настройки расчёта, p_… — план мероприятий (версии только добавляются; выполнение — по мероприятиям).
   Доступ проверяется здесь, а не в приложении: чтение и запись документов — по роли и по региону документа; исполнитель, назначенный по идентификатору
   учётной записи, видит свои мероприятия и меняет их статус, результат и комментарии, даже если регион ему не назначен. Каждая запись увеличивает rev:
   запись по устаревшему rev отклоняется (err «newer»), и приложение получает свежий документ. Заменённый файл попадает в корзину Диска на 30 дней. */
var FC_NAME = 'Фудкост ТехнолоГии', MAX_FC = 5 * 1024 * 1024, MAX_FC_LIST = 3000, FC_RE = /^(b|p|m|s)_[a-z0-9_-]{1,70}$/i;
var FC_WRITE = { admin: 1, editor: 1, finance: 1 };
function fcIdOk_(id) { return FC_RE.test(String(id || '')); }
function fcFolder_(create) {
  var fo = openFolder_('fcRoot');
  if (!fo && create) { try { fo = DriveApp.createFolder(FC_NAME); } catch (e) { throw driveErr_(e); } PropertiesService.getScriptProperties().setProperty('fcRoot', fo.getId()); }
  return fo;
}
function fcMe_() { return AUTH_ ? AUTH_.id : ''; }
function fcAnyReg_(role) { var sc = scope_(role); return sc === null || sc.length > 0; }
function fcRegOk_(role, reg) { return rgHas_(scope_(role), reg || 'main'); }
function fcFile_(id) { var fo = fcFolder_(false), it; if (!fo) return null; it = fo.getFilesByName(id + '.json'); return it.hasNext() ? it.next() : null; }
function fcRead_(id) {
  var fl = fcFile_(id), d;
  if (!fl) return null;
  d = parse_(fl.getBlob().getDataAsString('UTF-8'));
  if (!d || typeof d !== 'object') throw err_('bad', 'Документ повреждён');
  return d;
}
function fcAsgOf_(d) {
  var out = [], seen = {};
  if (d.type !== 'p' || !d.data || !d.data.plan) return out;
  var st = d.data.plan.state || {};
  Object.keys(st).forEach(function (k) { var a = st[k] && st[k].asg; if (a && a.t === 'user' && a.id && !seen[a.id]) { seen[a.id] = 1; out.push(String(a.id)); } });
  return out.slice(0, 60);
}
function fcMeta_(d) {
  var m = { t: d.type, reg: d.reg || '', obj: d.obj || '', on: String(d.objName || '').slice(0, 80), rev: d.rev, at: d.at, by: String(d.by || '').slice(0, 60), del: d.del ? 1 : 0, asg: fcAsgOf_(d) };
  if (d.type === 'p' && d.data && d.data.plan) { m.from = d.data.plan.from; m.to = d.data.plan.to; m.n = (d.data.plan.versions || []).length; }
  if (d.type === 'b' && d.data && d.data.batch) { m.from = d.data.batch.from; m.to = d.data.batch.to; m.bt = d.data.batch.type; }
  return m;
}
function fcBump_() { var pr = PropertiesService.getScriptProperties(); pr.setProperty('fcv', String((Number(pr.getProperty('fcv')) || 0) + 1)); }
function fcSave_(d) {
  var txt = JSON.stringify(d), fo, nm = d.id + '.json', it, fl;
  if (txt.length > MAX_FC) throw err_('size', 'Документ больше 5 МБ: на Диск он не помещается');
  try {
    fo = fcFolder_(true);
    it = fo.getFilesByName(nm);
    while (it.hasNext()) it.next().setTrashed(true);
    fl = fo.createFile(Utilities.newBlob(txt, 'application/json', nm));
    fl.setDescription(JSON.stringify(fcMeta_(d)));
  } catch (e) { throw e.code ? e : driveErr_(e); }
  fcBump_();
}
/* можно ли этому человеку видеть документ (и в каком виде): 'full', 'mine' (только свои мероприятия) или '' */
function fcView_(role, d) {
  if (d.type === 'm') return fcAnyReg_(role) ? 'full' : '';
  if (fcRegOk_(role, d.reg)) return 'full';
  if (d.type === 'p' && fcMe_() && fcAsgOf_(d).indexOf(fcMe_()) > -1) return 'mine';
  return '';
}
function fcMine_(d) {
  var me = fcMe_(), p = d.data.plan, st = {}, mids = {}, o = JSON.parse(JSON.stringify(d));
  Object.keys(p.state || {}).forEach(function (k) { var a = p.state[k] && p.state[k].asg; if (a && a.t === 'user' && a.id === me) { st[k] = p.state[k]; mids[k] = 1; } });
  o.data.plan.state = st;
  o.data.plan.versions = (p.versions || []).map(function (v) {
    return { n: v.n, at: v.at, fp: v.fp, items: (v.items || []).filter(function (i) { return mids[i.id]; }), mine: 1 };
  });
  o.limited = true;
  return o;
}
function fcIdx_(role) {
  var fo = fcFolder_(false), items = [], it, fl, nm, id, m;
  if (fo) {
    it = fo.getFiles();
    while (it.hasNext() && items.length < MAX_FC_LIST) {
      fl = it.next(); nm = fl.getName(); id = nm.replace(/\.json$/i, '');
      if (!/\.json$/i.test(nm) || !fcIdOk_(id)) continue;
      m = parse_(fl.getDescription() || '');
      if (!m) continue;
      if (m.t === 'm' ? !fcAnyReg_(role) : (!fcRegOk_(role, m.reg) && !(m.t === 'p' && fcMe_() && (m.asg || []).indexOf(fcMe_()) > -1))) continue;
      items.push({ id: id, t: m.t, reg: m.reg, obj: m.obj, on: m.on, rev: m.rev, at: m.at, by: m.by, del: m.del, from: m.from, to: m.to, n: m.n, bt: m.bt, mine: m.t === 'p' && !fcRegOk_(role, m.reg) ? 1 : 0 });
    }
  }
  items.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
  return { ok: true, v: Number(PropertiesService.getScriptProperties().getProperty('fcv') || 0), items: items, me: fcMe_(), write: !!FC_WRITE[role] };
}
function fcGet_(id, role) {
  try {
    if (!fcIdOk_(id)) throw err_('id', 'Неверный идентификатор документа');
    var d = fcRead_(id), v;
    if (!d) throw err_('nofile', 'Документ не найден');
    v = fcView_(role, d);
    if (!v) throw err_('nofile', 'Документ не найден');
    return { ok: true, doc: v === 'mine' ? fcMine_(d) : d };
  } catch (e) { throw e.code ? e : driveErr_(e); }
}
function fcUsers_(role) {
  if (!FC_WRITE[role]) return fail_('role', 'Список сотрудников доступен технологу, редактору и тер. управляющему');
  return { ok: true, users: usrAll_().filter(function (u) { return u.st !== USR_OFF; }).map(function (u) { return { id: u.id, name: u.name, role: u.role }; }) };
}
/* мероприятия, назначенные мне: по именной учётной записи, по всем планам */
function fcMineList_(role) {
  var me = fcMe_(), idx, out = [];
  if (!me) return { ok: true, items: [], shared: true };
  idx = fcIdx_(role);
  idx.items.forEach(function (x) {
    if (x.t !== 'p' || x.del) return;
    var d = fcRead_(x.id), p, v, ids = {};
    if (!d || !d.data || !d.data.plan) return;
    p = d.data.plan; v = (p.versions || [])[(p.versions || []).length - 1];
    if (!v) return;
    (v.items || []).forEach(function (i) {
      var s = (p.state || {})[i.id];
      if (s && s.asg && s.asg.t === 'user' && s.asg.id === me) out.push({ plan: x.id, obj: p.objName, from: p.from, to: p.to, mid: i.id, title: i.title, pri: i.pri, st: s.st, due: s.due || s.dueSug || '', act: i.act });
    });
  });
  return { ok: true, items: out };
}
function fcCleanOps_(data) {
  if (!data || typeof data !== 'object' || !data.batch || typeof data.batch !== 'object' || !data.ops || typeof data.ops !== 'object') throw err_('doc', 'В загрузке нет строк');
  var n = 0;
  ['receipts', 'moves', 'revision', 'sales', 'writeoff', 'output'].forEach(function (t) { if (data.ops[t] && !Array.isArray(data.ops[t])) throw err_('doc', 'Неверный состав загрузки'); n += (data.ops[t] || []).length; });
  if (n > 60000) throw err_('size', 'В загрузке больше 60 000 строк');
  return data;
}
function fcPut_(req, role) {
  try {
    var id = String(req.id || ''), type = id.charAt(0), cur, base = Number(req.base) || 0, d, reg = String(req.reg || '').slice(0, 40), data = req.data, by = by_(req), now = Date.now();
    if (!fcIdOk_(id)) throw err_('id', 'Неверный идентификатор документа');
    if (!FC_WRITE[role]) return roFail_(role === 'viewer' || role === 'audit' ? role : 'viewer', 'менять отчёты и планы');
    if (type !== 'm' && !/^[a-z0-9_-]{1,40}$/i.test(reg)) throw err_('reg', 'Не указан регион документа');
    if (type !== 'm' && !fcRegOk_(role, reg)) throw noReg_();
    cur = fcRead_(id);
    if (cur && cur.type !== type) throw err_('id', 'Идентификатор занят документом другого вида');
    if (cur && type !== 'm' && cur.reg !== reg) throw noReg_();
    if (type === 's') {
      if (!data || typeof data !== 'object' || !data.snap || typeof data.snap !== 'object' || typeof data.snap.ops !== 'object') throw err_('doc', 'В снимке нет данных');
      if (cur) return { ok: true, same: true, rev: cur.rev };                       // снимок версии не меняется
      d = { id: id, type: 's', reg: reg, obj: String(req.obj || '').slice(0, 40), objName: String(req.objName || '').slice(0, 80), rev: 1, at: now, by: by, uid: fcMe_(), data: { snap: data.snap } };
    } else if (type === 'b') {
      data = fcCleanOps_(data);
      if (cur && !cur.del) return { ok: true, same: true, rev: cur.rev };            // загрузка не меняется: повторная отправка ничего не делает
      if (cur && cur.del) return { ok: true, deleted: true, rev: cur.rev };
      d = { id: id, type: 'b', reg: reg, obj: String(req.obj || '').slice(0, 40), objName: String(req.objName || '').slice(0, 80), rev: 1, at: now, by: by, uid: fcMe_(), data: data };
    } else if (type === 'm') {
      if (!data || typeof data !== 'object' || typeof data.map !== 'object' || typeof data.cfg !== 'object') throw err_('doc', 'Неверные сопоставления');
      if (cur && cur.rev !== base) return { ok: false, err: 'newer', msg: 'На сервере более свежие сопоставления', doc: cur };
      d = { id: id, type: 'm', reg: '', obj: '', objName: '', rev: (cur ? cur.rev : 0) + 1, at: now, by: by, uid: fcMe_(), data: { map: data.map, cfg: data.cfg } };
    } else {
      d = fcPutPlan_(cur, req, role, reg, by, now, base);
      if (d.ok === false) return d;
    }
    fcSave_(d);
    if (type === 'p') appendRows_('log', [[new Date(now), by, 'план фудкоста сохранён', 'фудкост', id, 'Версий: ' + (d.data.plan.versions || []).length + '.', 0, '', '']]);
    return { ok: true, id: id, rev: d.rev, at: now };
  } catch (e) { throw e.code ? e : driveErr_(e); }
}
/* план: версии только добавляются; состояние выполнения существующих мероприятий здесь не меняется (его меняет fcact) */
function fcPutPlan_(cur, req, role, reg, by, now, base) {
  var p = req.data && req.data.plan, sv, i, k, v, st = {}, add = 0, nv;
  if (!p || typeof p !== 'object' || !Array.isArray(p.versions) || !p.versions.length || p.versions.length > 200 || typeof p.state !== 'object') throw err_('doc', 'Неверный план');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.from)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(p.to))) throw err_('doc', 'У плана нет периода');
  if (cur) {
    if (cur.rev !== base) return { ok: false, err: 'newer', msg: 'План уже изменён с другого устройства', doc: cur };
    sv = cur.data.plan.versions;
    if (p.versions.length < sv.length) return { ok: false, err: 'newer', msg: 'На сервере больше версий плана', doc: cur };
    for (i = 0; i < sv.length; i++) if (sv[i].n !== p.versions[i].n || sv[i].fp !== p.versions[i].fp) return { ok: false, err: 'newer', msg: 'Версии плана на сервере другие', doc: cur };
    nv = sv.concat(p.versions.slice(sv.length));
    st = JSON.parse(JSON.stringify(cur.data.plan.state || {}));
    add = nv.length - sv.length;
  } else nv = p.versions;
  for (k in p.state) if (!st[k] && p.state[k] && typeof p.state[k] === 'object') {
    v = p.state[k];
    if (v.asg && v.asg.t === 'user' && !fcUserOk_(v.asg.id)) throw err_('asg', 'Исполнитель не найден среди сотрудников');
    v.rev = 0;
    st[k] = v;
  }
  return { id: String(req.id), type: 'p', reg: reg, obj: String(p.obj || '').slice(0, 40), objName: String(p.objName || '').slice(0, 80), rev: (cur ? cur.rev : 0) + 1, at: now, by: by, uid: fcMe_(),
    data: { plan: { id: String(req.id), lid: String(p.lid || cur && cur.data.plan.lid || '').slice(0, 60), obj: p.obj, objName: p.objName, from: p.from, to: p.to, createdAt: cur ? cur.data.plan.createdAt : p.createdAt, versions: nv, state: st } } };
}
function fcUserOk_(uid) { var l = usrAll_(), i; for (i = 0; i < l.length; i++) if (l[i].id === String(uid) && l[i].st !== USR_OFF) return true; return false; }
/* выполнение одного мероприятия: {id, mid, base (rev мероприятия), set:{asg,due,st,result,real}, cm:[…], hist:[…]} */
var FC_STS = { 'new': 1, work: 1, done: 1, checked: 1, closed: 1, arch: 1 };
function fcAct_(req, role) {
  try {
    var id = String(req.id || ''), mid = String(req.mid || ''), d, p, s, set = req.set || {}, mine, full, me = fcMe_(), by = by_(req), now = Date.now(), k;
    if (!fcIdOk_(id) || id.charAt(0) !== 'p' || !/^m_[a-z0-9]{3,40}$/i.test(mid)) throw err_('id', 'Неверный идентификатор');
    d = fcRead_(id);
    if (!d || d.type !== 'p') throw err_('nofile', 'План не найден');
    full = FC_WRITE[role] && fcRegOk_(role, d.reg);
    p = d.data.plan; s = p.state[mid];
    if (!s) throw err_('nomid', 'Мероприятия нет в плане');
    mine = !!(me && s.asg && s.asg.t === 'user' && s.asg.id === me);
    if (!full && !mine) { if (fcRegOk_(role, d.reg)) return roFail_(role === 'audit' ? 'audit' : 'viewer', 'менять мероприятия'); throw err_('nofile', 'План не найден'); }
    if (!full) { for (k in set) if (['st', 'result'].indexOf(k) < 0) throw err_('denied', 'Исполнитель меняет только статус, результат и комментарии'); }
    if ((Number(req.base) || 0) !== (Number(s.rev) || 0)) return { ok: false, err: 'newer', msg: 'Мероприятие уже изменено другим пользователем', m: s, rev: d.rev };
    if ('st' in set) { if (!FC_STS[set.st]) throw err_('st', 'Неверный статус'); s.st = set.st; }
    if ('result' in set) s.result = String(set.result || '').slice(0, 600);
    if ('due' in set) { if (set.due && !/^\d{4}-\d{2}-\d{2}$/.test(String(set.due))) throw err_('due', 'Неверная дата'); s.due = String(set.due || ''); }
    if ('real' in set) { var x = set.real === null || set.real === '' ? null : Number(set.real); s.real = (x === null || !(x >= 0)) ? null : x; }
    if ('asg' in set) {
      var a = set.asg;
      if (a === null) s.asg = null;
      else if (a && a.t === 'user') { if (!fcUserOk_(a.id)) throw err_('asg', 'Исполнитель не найден среди сотрудников'); s.asg = { t: 'user', id: String(a.id), name: String(a.name || '').slice(0, 80) }; }
      else if (a && a.t === 'manual') s.asg = { t: 'manual', name: String(a.name || '').replace(/\s+/g, ' ').trim().slice(0, 80) };
      else throw err_('asg', 'Неверный исполнитель');
    }
    ['cm', 'hist'].forEach(function (f) {
      var list = Array.isArray(req[f]) ? req[f].slice(0, 20) : [], have = {};
      s[f] = s[f] || [];
      s[f].forEach(function (x) { have[x.k] = 1; });
      list.forEach(function (x) { if (x && /^[\w-]{4,40}$/.test(String(x.k)) && !have[x.k]) { s[f].push({ k: String(x.k), at: String(x.at || '').slice(0, 10), by: String(x.by || by).slice(0, 60), uid: me, t: String(x.t || '').slice(0, 300) }); have[x.k] = 1; } });
      if (s[f].length > 400) s[f] = s[f].slice(-400);
    });
    s.rev = (Number(s.rev) || 0) + 1; s.at = now;
    d.rev += 1; d.at = now; d.by = by;
    fcSave_(d);
    return { ok: true, m: s, rev: d.rev };
  } catch (e) { throw e.code ? e : driveErr_(e); }
}
function fcDel_(req, role) {
  try {
    var id = String(req.id || ''), d, nd;
    if (!fcIdOk_(id) || id.charAt(0) !== 'b') throw err_('id', 'Удалять можно только загрузку отчёта');
    if (!FC_WRITE[role]) return roFail_(role, 'удалять загрузки');
    d = fcRead_(id);
    if (!d) return { ok: true, n: 0 };
    if (!fcRegOk_(role, d.reg)) throw noReg_();
    if (d.del) return { ok: true, n: 0, rev: d.rev };
    nd = { id: id, type: 'b', reg: d.reg, obj: d.obj, objName: d.objName, rev: d.rev + 1, at: Date.now(), by: by_(req), uid: fcMe_(), del: 1, data: { batch: { id: id, from: d.data.batch.from, to: d.data.batch.to, type: d.data.batch.type }, ops: {} } };
    fcSave_(nd);
    appendRows_('log', [[new Date(), by_(req), 'загрузка фудкоста удалена', 'фудкост', id, '', 0, '', '']]);
    return { ok: true, n: 1, rev: nd.rev };
  } catch (e) { throw e.code ? e : driveErr_(e); }
}

function pfProps_() { return PropertiesService.getScriptProperties(); }
function pfRegs_() { var v = parse_(pfProps_().getProperty('pfRegs')); return Array.isArray(v) ? v : []; }
function pfGet_(id) { return parse_(pfProps_().getProperty('pf:' + id)); }
function pfSet_(id, st) {
  var regs = pfRegs_();
  pfProps_().setProperty('pf:' + id, JSON.stringify(st));
  if (regs.indexOf(id) < 0) { regs.push(id); pfProps_().setProperty('pfRegs', JSON.stringify(regs)); }
}
function openFolder_(key) {
  var v = pfProps_().getProperty(key), fo = null;
  if (v) { try { fo = DriveApp.getFolderById(v); if (fo.isTrashed()) fo = null; } catch (x) { fo = null; } }
  return fo;
}
function pfOpenFile_(id) {
  var fl = null;
  if (id) { try { fl = DriveApp.getFileById(id); if (fl.isTrashed()) fl = null; } catch (x) { fl = null; } }
  return fl;
}
function sheetUrl_(id) { return id ? 'https://docs.google.com/spreadsheets/d/' + id + '/edit' : ''; }

/* ----- проверка присланных таблиц: заголовок, примечание, шапка, строки; ячейка — число или текст ----- */
function cleanTables_(list, what) {
  if (!Array.isArray(list) || !list.length || list.length > 6) throw err_('tables', 'Нет таблиц для файла «' + what + '»');
  var seen = {};
  return list.map(function (t) {
    t = t || {};
    var name = String(t.name || '').replace(/[\[\]:*?\/\\\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!name || seen[nk_(name)]) throw err_('tables', 'У листа файла «' + what + '» нет названия или оно повторяется');
    seen[nk_(name)] = 1;
    var head = Array.isArray(t.head) ? t.head.map(function (x) { return String(x == null ? '' : x).slice(0, 120); }) : [];
    if (!head.length || head.length > MAX_PF_COLS) throw err_('tables', 'Лист «' + name + '»: неверное число столбцов');
    var rows = Array.isArray(t.rows) ? t.rows : [];
    if (rows.length > MAX_PF_ROWS) throw err_('many', 'Лист «' + name + '»: больше ' + MAX_PF_ROWS + ' строк');
    var nc = head.length;
    rows = rows.map(function (r) {
      var out = [], j;
      for (j = 0; j < nc; j++) {
        var v = Array.isArray(r) ? r[j] : '';
        if (typeof v === 'number') v = isFinite(v) ? v : '';
        else v = v == null ? '' : String(v).slice(0, 2000);
        out.push(v);
      }
      return out;
    });
    var fmt = [], widths = [], j;
    for (j = 0; j < nc; j++) {
      fmt.push(Object.prototype.hasOwnProperty.call(PF_FMT, (t.fmt || [])[j]) ? (t.fmt || [])[j] : 'text');
      widths.push(Math.max(40, Math.min(600, Number((t.widths || [])[j]) || 110)));
    }
    return { name: name, title: String(t.title || '').slice(0, 200), note: String(t.note || '').slice(0, 400), head: head, rows: rows, fmt: fmt, widths: widths };
  });
}
function ensureCols_(sh, n) {
  var need = n - sh.getMaxColumns();
  if (need > 0) sh.insertColumnsAfter(sh.getMaxColumns(), need);
}
function putTable_(sh, t) {
  var nc = t.head.length, total = 4 + t.rows.length, blank = [], j;
  for (j = 0; j < nc; j++) blank.push('');
  var grid = [[t.title].concat(blank.slice(1)), [t.note].concat(blank.slice(1)), blank.slice(), t.head.slice()].concat(t.rows);
  sh.clear();
  var need = total - sh.getMaxRows();
  if (need > 0) sh.insertRowsAfter(sh.getMaxRows(), need);
  ensureCols_(sh, nc);
  for (j = 0; j < nc; j++) {
    if (t.rows.length && PF_FMT[t.fmt[j]]) sh.getRange(5, j + 1, t.rows.length, 1).setNumberFormat(PF_FMT[t.fmt[j]]);   // текст остаётся текстом: «=…» в названии не станет формулой
    sh.setColumnWidth(j + 1, t.widths[j]);
  }
  sh.getRange(1, 1, total, nc).setValues(grid);
  sh.getRange(1, 1, 1, 1).setFontWeight('bold').setFontSize(13);
  sh.getRange(4, 1, 1, nc).setFontWeight('bold').setBackground('#e8eef7');
  sh.setFrozenRows(4);
}
function writeBook_(book, tables) {
  var keep = {};
  tables.forEach(function (t) {
    keep[t.name] = 1;
    var sh = book.getSheetByName(t.name) || book.insertSheet(t.name);
    putTable_(sh, t);
  });
  book.getSheets().forEach(function (sh) { if (!keep[sh.getName()]) book.deleteSheet(sh); });
}

/* ----- папки региона ----- */
function pfFolders_(id, name, st) {
  var props = pfProps_(), root = openFolder_('pfRoot');
  if (!root) { root = DriveApp.createFolder(PF_NAME); props.setProperty('pfRoot', root.getId()); }
  var fo = st.fo ? pfOpenFolder_(st.fo) : null;
  if (!fo) fo = root.createFolder(name);
  else if (fo.getName() !== name) fo.setName(name);         // регион переименовали: папка следует за названием
  var arch = st.arch ? pfOpenFolder_(st.arch) : null;
  if (!arch) arch = fo.createFolder(PF_ARCH);
  st.fo = fo.getId(); st.arch = arch.getId();
  return { root: root, fo: fo, arch: arch };
}
function pfOpenFolder_(id) {
  var fo = null;
  try { fo = DriveApp.getFolderById(id); if (fo.isTrashed()) fo = null; } catch (x) { fo = null; }
  return fo;
}
function pfShare_(fl, pub) {
  try {
    if (pub) fl.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    else fl.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    return true;
  } catch (e) { return !pub; }       // закрытый файл и так закрыт, а вот открыть ссылку не вышло: об этом скажем в ответе
}
/* Google Таблица: по сохранённому идентификатору, иначе создаётся заново (в папке региона) */
function pfBook_(st, key, name, fo, tables, pub) {
  var book = null, shared = true, fresh = false;
  if (st[key]) { try { book = SpreadsheetApp.openById(st[key]); if (DriveApp.getFileById(st[key]).isTrashed()) book = null; } catch (x) { book = null; } }
  if (!book) {
    book = SpreadsheetApp.create(name); fresh = true;
    DriveApp.getFileById(book.getId()).moveTo(fo);
  }
  if (book.getName() !== name) book.rename(name);
  writeBook_(book, tables);
  if (fresh || st[key + 'Sh'] !== 1) { shared = pfShare_(DriveApp.getFileById(book.getId()), pub); st[key + 'Sh'] = shared ? 1 : 0; }
  st[key] = book.getId();
  return shared;
}
/* файл Excel: прежний с тем же именем уходит в корзину, новый получает описание (вид и регион) */
function pfXlsx_(folder, name, bytes, kind, regId, pub, extra) {
  var it = folder.getFilesByName(name);
  while (it.hasNext()) it.next().setTrashed(true);
  var fl = folder.createFile(Utilities.newBlob(bytes, XLSX_MIME, name));
  var meta = { pf: 1, k: kind, reg: regId };
  if (extra) Object.keys(extra).forEach(function (k) { meta[k] = extra[k]; });
  fl.setDescription(JSON.stringify(meta));
  return { file: fl, shared: pfShare_(fl, pub) };
}
function xlsxBytes_(b64, what) {
  var bytes;
  try { bytes = Utilities.base64Decode(String(b64 || '')); } catch (e) { throw err_('b64', 'Файл «' + what + '» повредился при передаче, повторите'); }
  if (bytes.length < 200 || bytes[0] !== 80 || bytes[1] !== 75) throw err_('xlsx', 'Файл «' + what + '» не похож на Excel');
  return bytes;
}

/* ----- запись: таблицы + Excel в папку региона, копия за месяц в «Архив» ----- */
function pricesPublish_(req) {
  var reg = req.region || {}, id = String(reg.id || '');
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(id)) throw err_('region', 'Неверный идентификатор региона');
  var name = dirName_(reg.name) || id, hash = String(req.hash || '');
  if (!/^[\w-]{4,40}$/.test(hash)) throw err_('hash', 'Неверная контрольная сумма');
  var pub = cleanTables_(req.pub, PF_PUB), prv = cleanTables_(req.prv, PF_PRV);
  var xp = String(req.xlsxPub || ''), xv = String(req.xlsxPrv || '');
  if (xp.length + xv.length > MAX_PF * 4 / 3) throw err_('size', 'Файлы цен слишком большие для одной отправки');
  var bp = xlsxBytes_(xp, PF_PUB), bv = xlsxBytes_(xv, PF_PRV);
  var st = pfGet_(id) || {}, now = new Date(), by = by_(req);
  if (!req.force && st.hash === hash && st.ps && st.vs && pfOpenFile_(st.ps) && pfOpenFile_(st.vs)) return { ok: true, same: true, info: pfInfo_(id, st, 'admin') };
  var ym = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM'), shared = true, f;
  try {
    f = pfFolders_(id, name, st);
    var nPub = PF_PUB + ' — ' + name, nPrv = PF_PRV + ' — ' + name;
    shared = pfBook_(st, 'ps', nPub, f.fo, pub, true) && shared;
    pfBook_(st, 'vs', nPrv, f.fo, prv, false);
    var x1 = pfXlsx_(f.fo, nPub + '.xlsx', bp, 'pub', id, true), x2 = pfXlsx_(f.fo, nPrv + '.xlsx', bv, 'prv', id, false);
    shared = x1.shared && shared;
    st.px = x1.file.getId(); st.vx = x2.file.getId(); st.pxn = nPub + '.xlsx'; st.vxn = nPrv + '.xlsx';
    var a1 = pfXlsx_(f.arch, ym + ' · ' + nPub + '.xlsx', bp, 'pub', id, true, { ym: ym }), a2 = pfXlsx_(f.arch, ym + ' · ' + nPrv + '.xlsx', bv, 'prv', id, false, { ym: ym });
    shared = a1.shared && shared;
  } catch (e) { throw e.code ? e : driveErr_(e); }
  st.name = name; st.hash = hash; st.at = now.getTime(); st.by = by; st.ym = ym; st.shared = shared ? 1 : 0;
  st.n = { dishes: Math.max(0, Number(req.nDishes) || 0), ings: Math.max(0, Number(req.nIngs) || 0), sold: Math.max(0, Number(req.nSold) || 0) };
  pfSet_(id, st);
  appendRows_('log', [[now, by, 'цены обновлены', 'цены', name, 'блюд с ценой продажи: ' + st.n.sold + ', сырья с ценой: ' + st.n.ings, 0, '', '']]);
  return { ok: true, same: false, shared: shared, info: pfInfo_(id, st, 'admin') };
}

/* ----- чтение ----- */
function pfInfo_(id, st, role) {
  var pr = priceRole_(role), adm = role === 'admin';
  var o = { id: id, name: String(st.name || id), at: Number(st.at) || 0, by: String(st.by || ''), ym: String(st.ym || ''), n: st.n || {}, shared: st.shared !== 0,
    pub: { sheet: sheetUrl_(st.ps), x: String(st.px || ''), xn: String(st.pxn || '') } };
  if (pr) o.prv = { x: String(st.vx || ''), xn: String(st.vxn || '') };
  if (adm) {
    o.hash = String(st.hash || '');
    o.prv.sheet = sheetUrl_(st.vs);
    o.folder = st.fo ? 'https://drive.google.com/drive/folders/' + st.fo : '';
    o.archive = st.arch ? 'https://drive.google.com/drive/folders/' + st.arch : '';
  }
  return o;
}
function prices_(role) {
  var out = [], sc = scope_(role);
  pfRegs_().forEach(function (id) { var st = pfGet_(id); if (st && st.ps && rgHas_(sc, id)) out.push(pfInfo_(id, st, role)); });
  return { ok: true, v: VERSION, regions: out };
}
function archiveFiles_(st) {
  var out = [], fo = st.arch ? pfOpenFolder_(st.arch) : null;
  if (!fo) return out;
  var it = fo.getFiles();
  while (it.hasNext()) {
    var fl = it.next(), meta = parse_(fl.getDescription() || '') || {};
    if (!meta.pf) continue;
    out.push({ id: fl.getId(), name: fl.getName(), ym: String(meta.ym || ''), k: meta.k === 'prv' ? 'prv' : 'pub', at: fl.getLastUpdated().getTime() });
  }
  out.sort(function (a, b) { return a.ym < b.ym ? 1 : a.ym > b.ym ? -1 : (a.k < b.k ? -1 : 1); });
  return out;
}
function parch_(id, role) {
  var st = pfGet_(id), pr = priceRole_(role);
  if (!st || !rgHas_(scope_(role), id)) return { ok: true, files: [] };
  return { ok: true, files: archiveFiles_(st).filter(function (f) { return pr || f.k === 'pub'; }) };
}
/* файл Excel только из папок цен; закрытые (себестоимость) только коду с правом на цены */
function pfile_(id, role) {
  id = String(id || '');
  if (!/^[\w-]{10,80}$/.test(id)) throw err_('id', 'Неверный идентификатор файла');
  var fl = pfOpenFile_(id);
  if (!fl) throw err_('nofile', 'Файл не найден');
  var meta = parse_(fl.getDescription() || '') || {}, ok = false, regs = pfRegs_(), it = fl.getParents();
  if (meta.pf) {
    while (it.hasNext() && !ok) {
      var pid = it.next().getId();
      regs.forEach(function (r) { var st = pfGet_(r); if (st && (st.fo === pid || st.arch === pid) && rgHas_(scope_(role), r)) ok = true; });
    }
  }
  if (!ok) throw err_('nofile', 'Файл не найден в папках цен');
  if (meta.k === 'prv' && !priceRole_(role)) throw err_('role', 'Себестоимость и закупочные цены доступны только по верному коду');
  if (fl.getSize() > MAX_PF) throw err_('size', 'Файл слишком большой');
  return { ok: true, name: fl.getName(), b64: Utilities.base64Encode(fl.getBlob().getBytes()) };
}
/* прежнее состояние файлов региона: по нему калькулятор считает «было → стало» и дописывает журнал изменений (только технологу) */
function pfSheetRows_(book, name, heads) {
  var sh = book.getSheetByName(name);
  if (!sh) return { cols: {}, rows: [] };
  var last = sh.getLastRow();
  if (last < 5) return { cols: {}, rows: [] };
  var hdr = sh.getRange(4, 1, 1, Math.min(sh.getMaxColumns(), MAX_PF_COLS)).getValues()[0], cols = {};
  while (hdr.length && hdr[hdr.length - 1] === '') hdr.pop();          // пустые столбцы справа не читаем
  if (!hdr.length) return { cols: {}, rows: [] };
  Object.keys(heads).forEach(function (k) { var a = [].concat(heads[k]), i; for (i = 0; i < a.length; i++) { var j = hdr.indexOf(a[i]); if (j > -1) { cols[k] = j; break; } } });
  return { cols: cols, rows: sh.getRange(5, 1, last - 4, hdr.length).getValues() };
}
function pprev_(id, h, role) {
  if (role !== 'admin') throw err_('admin', 'Это действие доступно по коду технолога');
  var st = pfGet_(id);
  if (!st || !st.ps || !st.vs || !pfOpenFile_(st.ps) || !pfOpenFile_(st.vs)) return { ok: true, has: false };   // файлов нет (удалили на Диске): пишем заново
  if (h && st.hash === h) return { ok: true, has: true, same: true, at: Number(st.at) || 0 };
  var out = { ok: true, has: true, same: false, at: Number(st.at) || 0, pub: { sell: [], log: [] }, prv: { ing: [], dish: [], log: [] } };
  try {
    var pb = SpreadsheetApp.openById(st.ps), vb = SpreadsheetApp.openById(st.vs), t;
    t = pfSheetRows_(pb, PF_SHEET.sell, { n: PF_HEAD.name[0], v: PF_HEAD.sell });
    if (t.cols.n !== undefined && t.cols.v !== undefined) t.rows.forEach(function (r) { if (r[t.cols.n] !== '') out.pub.sell.push([String(r[t.cols.n]), Number(r[t.cols.v]) || 0]); });
    t = pfSheetRows_(pb, PF_SHEET.sellLog, { n: 'Дата' });
    out.pub.log = t.rows.filter(function (r) { return r[0] !== ''; }).slice(0, 1000).map(function (r) { return r.map(cellOut_); });
    t = pfSheetRows_(vb, PF_SHEET.ing, { n: PF_HEAD.name[1], v: PF_HEAD.price });
    if (t.cols.n !== undefined && t.cols.v !== undefined) t.rows.forEach(function (r) { if (r[t.cols.n] !== '') out.prv.ing.push([String(r[t.cols.n]), Number(r[t.cols.v]) || 0]); });
    t = pfSheetRows_(vb, PF_SHEET.dish, { n: PF_HEAD.name[0], c: PF_HEAD.cost, s: PF_HEAD.sell });
    if (t.cols.n !== undefined && t.cols.c !== undefined) t.rows.forEach(function (r) { if (r[t.cols.n] !== '') out.prv.dish.push([String(r[t.cols.n]), r[t.cols.c] === '' ? null : Number(r[t.cols.c]), t.cols.s !== undefined && r[t.cols.s] !== '' ? Number(r[t.cols.s]) : null]); });
    t = pfSheetRows_(vb, PF_SHEET.prvLog, { n: 'Дата' });
    out.prv.log = t.rows.filter(function (r) { return r[0] !== ''; }).slice(0, 1000).map(function (r) { return r.map(cellOut_); });
  } catch (e) { throw e.code ? e : driveErr_(e); }
  return out;
}
/* ---------- копия данных пользователя на Диске: чтобы в любом браузере были те же данные ----------
   Папка «Копии данных ТехнолоGии» на Диске владельца скрипта. Копия именного пользователя принадлежит его учётной записи: сервер определяет владельца по входу (ФИО и код), присланное
   в запросе ФИО не читается, поэтому чужую копию открыть нельзя, даже зная ФИО. Общий код людей не различает (он один на всех с этой ролью),
   там копия принадлежит паре «роль + ФИО из запроса» и защищена только тем, что ФИО знает сам сотрудник; для личных данных заведите именной доступ.
   Хранится одна текущая и одна предыдущая. Номер версии не даёт перезаписать более новую копию из другого браузера по ошибке. */
var BK_NAME = 'Копии данных ТехнолоGии';                      // латинская G, как в названии калькулятора
var MAX_BK = 8 * 1024 * 1024;                                       // длина присланной копии (base64)
function hash_(s) {
  var a = 2166136261, b = 5381, i, c;
  s = String(s);
  for (i = 0; i < s.length; i++) { c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619) >>> 0; b = (Math.imul(b, 33) ^ c) >>> 0; }
  return ('0000000' + a.toString(16)).slice(-8) + ('0000000' + b.toString(16)).slice(-8);
}
function bkTok_(t) { t = String(t == null ? '' : t); return /^[\w-]{16,64}$/.test(t) ? t : ''; }
function bkKey_(role, w) { return 'bk:' + hash_(w.acct ? 'u|' + w.id + '|' + role : role + '|t|' + w.t); }      // именной доступ — учётная запись и роль, общий код — роль и секрет устройства (ФИО владельца не подтверждает)
/* прежний ключ копии именного пользователя (до привязки к учётной записи): роль и ФИО, как они были записаны */
function bkOldKeys_(role, w, by) {
  var names = [w.k], out = [], i;
  if (by && login_(by) === w.nm && nk_(by) !== w.k) names.push(nk_(by));
  for (i = 0; i < names.length; i++) out.push('bk:' + hash_(role + '|' + (names[i] || 'без имени')));
  return out;
}
/* кто владеет копией: именной доступ — учётная запись; общий код — только тот, кто знает секрет устройства (случайная строка, которую калькулятор хранит у себя) */
function bkWho_(by, tok) {
  var w = whoIs_(by);
  if (!w.acct) { w.t = bkTok_(tok); if (!w.t) throw err_('bkt', 'Копия данных общего кода привязана к устройству: обновите страницу калькулятора и повторите'); }
  return w;
}
function bkSt_(role, by, tok) {
  var w = bkWho_(by, tok), pr = pfProps_(), st = parse_(pr.getProperty(bkKey_(role, w))), ok, i;
  if (!st && w.acct) {                                              // копия, записанная до привязки к учётной записи: её хозяин читает её, при записи она переедет
    ok = bkOldKeys_(role, w, by);
    for (i = 0; i < ok.length && !st; i++) { st = parse_(pr.getProperty(ok[i])); if (st) st.old = ok[i]; }
  }
  return st;
}
function bkFolder_(create) {
  var fo = openFolder_('bkRoot');
  if (!fo && create) { fo = DriveApp.createFolder(BK_NAME); pfProps_().setProperty('bkRoot', fo.getId()); }
  return fo;
}
function bkPub_(m, role) { return m ? { rev: m.rev, at: m.at, by: m.by, dev: m.dev, label: m.label, n: m.n, enc: m.enc, size: m.size, blocked: role === undefined ? undefined : bkBlocked_(m, role) } : null; }
/* регионы, которые существуют в скрипте: основной, папки регионов и регионы файлов цен */
function knownRegs_() {
  var out = ['main'];
  tregs_().forEach(function (g) { if (out.indexOf(g.id) < 0) out.push(g.id); });
  pfRegs_().forEach(function (id) { if (out.indexOf(id) < 0) out.push(id); });
  return out;
}
/* копия, снятая с регионами, которых у человека теперь нет, ему не отдаётся: в ней могут быть чужие цены и карты. Копия, снятая до проверки регионов (или технологом),
   могла содержать любой регион, поэтому её получает только тот, у кого назначены все известные регионы */
function bkBlocked_(m, role) {
  var sc = scope_(role), need;
  if (sc === null) return false;
  need = (m && Array.isArray(m.rg)) ? m.rg : knownRegs_();
  return !need.every(function (g) { return sc.indexOf(g) > -1; });
}
function bkInfo_(role, by, tok) {
  var st = bkSt_(role, by, tok), cur = st && st.cur && pfOpenFile_(st.cur.id) ? st.cur : null, prev = st && st.prev && pfOpenFile_(st.prev.id) ? st.prev : null;
  return { ok: true, has: !!cur, cur: bkPub_(cur, role), prev: bkPub_(prev, role), rev: cur ? cur.rev : 0 };
}
function bkGet_(role, by, which, tok) {
  var st = bkSt_(role, by, tok), m = st && (which === 'prev' ? st.prev : st.cur), fl = m && pfOpenFile_(m.id);
  if (!fl) throw err_('nocopy', which === 'prev' ? 'Предыдущей копии на Диске нет' : 'Копии ваших данных на Диске пока нет');
  if (bkBlocked_(m, role)) throw err_('region', 'В этой копии есть данные регионов, к которым у вас сейчас нет доступа. Сохраните новую копию: она будет только с вашими регионами');
  var out = bkPub_(m, role);
  out.ok = true;
  try { out.data = Utilities.base64Encode(fl.getBlob().getBytes()); } catch (e) { throw driveErr_(e); }
  return out;
}
function bkPut_(req, role) {
  var by = by_(req), data = String(req.data || ''), enc = req.enc === 'gz' ? 'gz' : '', base = Number(req.base) || 0, bytes, st, cur, rev, fo, fl, m, n = req.n || {}, w, oldKey;
  if (!data) throw err_('empty', 'Пустая копия');
  if (data.length > MAX_BK) throw err_('size', 'Копия больше 8 МБ: сохранить её на Диск нельзя');
  try { bytes = Utilities.base64Decode(data); } catch (e) { throw err_('b64', 'Копия повредилась при передаче, повторите'); }
  if (enc ? !(bytes.length > 20 && (bytes[0] & 255) === 31 && (bytes[1] & 255) === 139) : (bytes.length < 2 || (bytes[0] & 255) !== 123)) throw err_('fmt', 'Копия не похожа на данные калькулятора');
  w = bkWho_(req.by, req.bkt);
  st = bkSt_(role, req.by, req.bkt) || { rev: 0 };
  oldKey = st.old || ''; delete st.old;
  cur = st.cur && pfOpenFile_(st.cur.id) ? st.cur : null;
  if (cur && cur.rev !== base && !req.force) return { ok: false, err: 'newer', msg: 'На Диске более свежая копия, записанная из другого браузера', cur: bkPub_(cur, role) };
  rev = (Number(st.rev) || 0) + 1;
  try {
    fo = bkFolder_(true);
    fl = fo.createFile(Utilities.newBlob(bytes, enc ? 'application/gzip' : 'application/json', 'Копия · ' + dirName_(by).slice(0, 30) + ' · ' + role + ' · v' + rev + (enc ? '.json.gz' : '.json')));
  } catch (e) { throw driveErr_(e); }
  m = { id: fl.getId(), rev: rev, at: Date.now(), by: by, dev: String(req.dev || '').replace(/[^\w-]/g, '').slice(0, 40), label: String(req.label || '').replace(/[\r\n]+/g, ' ').slice(0, 80),
    n: { ings: Number(n.ings) || 0, recipes: Number(n.recipes) || 0 }, enc: enc, size: bytes.length, rg: scope_(role) === null ? '*' : scope_(role).slice().sort() };
  fl.setDescription(JSON.stringify({ bk: 1, role: role, rev: rev }));
  if (st.prev && st.prev.id) { var old = pfOpenFile_(st.prev.id); if (old) old.setTrashed(true); }
  st.prev = cur; st.cur = m; st.rev = rev;
  pfProps_().setProperty(bkKey_(role, w), JSON.stringify(st));
  if (oldKey) pfProps_().deleteProperty(oldKey);                   // прежняя запись по ФИО больше не нужна: копия теперь за учётной записью
  return { ok: true, rev: rev, at: m.at };
}

/* ---------- страница калькулятора по адресу скрипта: мини-приложение без файла и установки ----------
   Технолог один раз загружает готовый файл калькулятора (вкладка «Личный кабинет» → «Страница по ссылке»); скрипт кладёт его на Диск
   и отдаёт всем, кто открыл адрес /exec в браузере. Коды в страницу не вшиты: человек вводит ФИО и код при первом открытии. */
var PG_FOLDER = 'Страница калькулятора', PG_NAME = 'Страница калькулятора.html';
var MAX_PG = 6 * 1024 * 1024;
var PG_MARK = 'window.KBZHU_' + 'RELEASE=1;';           // метка «чистой» сборки: без цен; страницу без неё не принимаем
function pgInfoRaw_() { return parse_(pfProps_().getProperty('page')); }
function pgFile_() { var st = pgInfoRaw_(); return st && st.id ? pfOpenFile_(st.id) : null; }
/* номер сборки загруженной страницы (в файле: window.KBZHU_BUILD=ГГГГММДДччмм;): по нему все видят, что вышла новая версия приложения */
var PG_BLD_RE = new RegExp('window\\.KBZHU_' + 'BUILD=(\\d{6,14});');
function pgBld_() { var st = pgInfoRaw_(); return st && st.id ? Number(st.bld) || 0 : 0; }
function pgAt_() { var st = pgInfoRaw_(); return st && st.id ? Number(st.at) || 0 : 0; }
function pageInfo_() {
  var st = pgInfoRaw_(), fl = pgFile_();
  return { ok: true, has: !!fl, at: fl ? st.at : 0, by: fl ? st.by : '', size: fl ? st.size : 0, bld: fl ? Number(st.bld) || 0 : 0 };
}
function servePage_() {
  var html = '', fl = null;
  try { fl = pgFile_(); if (fl) html = fl.getBlob().getDataAsString('UTF-8'); } catch (e) { html = ''; }
  if (!html) {
    html = '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ТехнолоGия</title></head>' +
      '<body style="font:16px system-ui,sans-serif;max-width:34em;margin:12vh auto;padding:0 18px;line-height:1.5"><h1 style="font-size:22px">ТехнолоGия</h1>' +
      '<p>Страница калькулятора ещё не загружена. Откройте файл калькулятора, перейдите на вкладку «Личный кабинет» и в блоке «Страница по ссылке» загрузите файл. После этого калькулятор будет открываться по этому адресу.</p></body></html>';
  }
  return HtmlService.createHtmlOutput(html).setTitle('ТехнолоGия')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function pagePut_(req) {
  var html = String(req.html || ''), st = pgInfoRaw_() || {}, fo, fl, old;
  if (html.length < 50000 || html.indexOf('<script') < 0 || html.indexOf('</script>') < 0) throw err_('page', 'Это не файл калькулятора: страница слишком короткая или без разметки');
  if (html.length > MAX_PG) throw err_('size', 'Страница больше 6 МБ: загрузить её нельзя');
  if (html.indexOf(PG_MARK) < 0) throw err_('release', 'Это не готовый файл калькулятора для рассылки: в нём нет метки чистой сборки, а в такой странице могут оказаться цены. Загрузите файл «КБЖУ_калькулятор_автономный.html» целиком.');
  try {
    fo = openFolder_('pgRoot');
    if (!fo) { fo = DriveApp.createFolder(PG_FOLDER); pfProps_().setProperty('pgRoot', fo.getId()); }
    fl = fo.createFile(Utilities.newBlob(html, 'text/html', PG_NAME));
  } catch (e) { throw driveErr_(e); }
  fl.setDescription(JSON.stringify({ pg: 1 }));
  if (st.id) { old = pfOpenFile_(st.id); if (old) old.setTrashed(true); }
  st = { id: fl.getId(), at: Date.now(), by: by_(req), size: html.length, bld: Number((PG_BLD_RE.exec(html) || [])[1]) || 0 };
  pfProps_().setProperty('page', JSON.stringify(st));
  return { ok: true, at: st.at, size: st.size, bld: st.bld };
}

function cellOut_(v) { return typeof v === 'number' ? v : (v instanceof Date ? v.getTime() : String(v == null ? '' : v)); }

/* ---------- запись ---------- */
function cleanItems_(items) {
  if (!Array.isArray(items) || !items.length) throw err_('items', 'Нет данных для записи');
  if (items.length > 500) throw err_('many', 'Слишком много позиций за один раз (больше 500), отправьте частями');
  return items.map(function (it) {
    var kind = it && it.kind;
    if (kind !== 'ing' && kind !== 'rec') throw err_('kind', 'Неизвестный вид позиции');
    var sid = String(it.sid || '');
    if (!/^[\w-]{3,40}$/.test(sid)) throw err_('sid', 'Неверный идентификатор позиции');
    var name = String(it.name || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
    if (!name) throw err_('name', 'У позиции нет названия');
    if (!it.json || typeof it.json !== 'object' || Array.isArray(it.json)) throw err_('json', 'У позиции «' + name + '» нет данных');
    if (it.json._del) it.json = { _del: 1 };
    var js = JSON.stringify(it.json);
    if (js.length > 40000) throw err_('size', 'Позиция «' + name + '» слишком большая для одной ячейки таблицы');
    return { kind: kind, sid: sid, name: name, base: Number(it.baseRev) || 0, json: it.json };
  });
}
function newBatch_() { return 'b' + Utilities.getUuid().replace(/-/g, '').slice(0, 8); }

/* комментарий технолога и автора: до 1000 знаков, переносы строк остаются */
function text_(v, n) { return String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim().slice(0, n || 1000); }

function propose_(req, role) {
  var items = cleanItems_(req.items), batch = newBatch_(), by = by_(req), note = note_(req), now = new Date(), sc = scope_(role);
  /* код без права на цены менять их не может: закупочные цены и цена продажи из присланного вырезаются, а при приёме подставятся действующие (метка _np) */
  if (!priceRole_(role)) items.forEach(function (it) { if (it.json._del) return; it.json = strip_(it.kind, it.json, true); it.json._np = 1; });
  /* ограниченные регионы: чужое не затирается (берётся из базы), в чужой регион писать нельзя; при приёме слияние повторится с тем, что будет в базе тогда (метка _rg) */
  if (sc !== null) {
    var pubNow = readAll_('pub');
    items.forEach(function (it) {
      var curJ = pubJson_(pubNow, it.kind, it.sid, it.name);
      if (it.json._del) { if (it.kind === 'rec' && curJ && curJ.reg && !rgHas_(sc, curJ.reg)) throw noReg_(); return; }
      it.json = rgMerge_(it.kind, it.json, curJ, sc);
      it.json._rg = sc.slice();
    });
  }
  /* повторная отправка после доработки: прежнее предложение (того же автора, та же позиция или тот же пакет) закрывается, новое помнит, откуда оно */
  var rows = readAll_('pend'), re = String(req.re || '').replace(/[^\w-]/g, '').slice(0, 20), prev = '', touched = false, ak = nk_(by), want = {};
  items.forEach(function (it) { want[it.kind + '|' + it.sid] = 1; });
  var tIdx = [];
  rows.forEach(function (r, k) {
    if (r[7] !== REW || nk_(r[5]) !== ak) return;
    if (String(r[0]) === re || want[r[1] + '|' + String(r[2])]) { r[7] = REP; prev = prev || String(r[0]); touched = true; tIdx.push(k); }
  });
  if (touched) writeRows_('pend', rows, tIdx, undefined, 9);
  appendRows_('pend', items.map(function (it) {
    return [batch, it.kind, it.sid, it.name, it.base, by, now, WAIT, note, JSON.stringify(it.json), '', '', '', prev];
  }));
  appendRows_('log', [[now, by, prev ? 'предложено повторно' : 'предложено', '', items[0].name + (items.length > 1 ? ' и ещё ' + (items.length - 1) : ''), note, 0, '', '']]);
  return { ok: true, batch: batch, count: items.length, again: !!prev };
}

/* в рецептуре подменяем ид сырья, если оно слилось с уже существующим (одинаковое название) */
function remapRows_(json, remap) {
  if (!json || !Array.isArray(json.rows)) return json;
  json.rows.forEach(function (r) { if (r && remap[r.ing]) r.ing = remap[r.ing]; });
  return json;
}

/* Общая запись: сырьё раньше рецептов. Позиция с новым ид, но уже существующим названием обновляет существующую.
   Позиция с json {_del:1} удаляет: строка остаётся с новой версией и меткой «удалено» (DEL_JSON), её получат все. Сырьё, которое ещё
   используется в живых ТТК общей базы, удалить нельзя; ТТК удаляется раньше сырья из того же пакета. */
function apply_(items, by, action, note, guard) {
  var rows = readAll_('pub'), idx = {}, byName = {}, dead = {}, top = Number(PropertiesService.getScriptProperties().getProperty('rev') || 0), now = new Date(), logs = [], remap = {}, changed = 0, touched = {};
  rows.forEach(function (r, i) {
    r[3] = Number(r[3]) || 0; if (r[3] > top) top = r[3]; idx[r[1] + '|' + r[0]] = i;
    if (isDel_(r[6])) dead[r[1] + '|' + r[0]] = 1; else byName[r[1] + '|' + nk_(r[2])] = String(r[0]);   // удалённые под тем же названием не усыновляют новые
  });
  var dels = items.filter(function (x) { return x.json && x.json._del; }), live = items.filter(function (x) { return !(x.json && x.json._del); });
  var sorted = live.filter(function (x) { return x.kind === 'ing'; }).concat(live.filter(function (x) { return x.kind === 'rec'; }));
  /* автопубликация (guard): позиция, которую после чтения успели изменить или удалить, не перезаписывается, а возвращается в skipped */
  var skipped = [];
  if (guard) {
    sorted = sorted.filter(function (it) {
      var i = idx[it.kind + '|' + it.sid], ex;
      if (i === undefined) { ex = byName[it.kind + '|' + nk_(it.name)]; if (ex) i = idx[it.kind + '|' + ex]; }
      if (i !== undefined && (Number(rows[i][3]) || 0) > (Number(it.base) || 0)) { skipped.push({ kind: it.kind, sid: it.sid, name: it.name }); return false; }
      return true;
    });
  }
  /* что удаляется: сырьё не должно оставаться в живых ТТК */
  var delIng = {}, delRec = {}, used = {};
  dels.forEach(function (x) { if (idx[x.kind + '|' + x.sid] !== undefined && !dead[x.kind + '|' + x.sid]) (x.kind === 'ing' ? delIng : delRec)[x.sid] = 1; });
  if (Object.keys(delIng).length) {
    var liveRec = {};
    live.forEach(function (x) { if (x.kind === 'rec') liveRec[x.sid] = 1; });
    var chk = function (recName, j) {
      ((j && Array.isArray(j.rows)) ? j.rows : []).forEach(function (x) { if (x && delIng[x.ing]) used[String(rows[idx['ing|' + x.ing]][2])] = recName; });
    };
    rows.forEach(function (r) {      // ТТК общей базы, которые остаются как есть
      if (r[1] === 'rec' && !dead['rec|' + r[0]] && !delRec[String(r[0])] && !liveRec[String(r[0])]) chk(String(r[2]), parse_(r[6]));
    });
    live.forEach(function (x) { if (x.kind === 'rec') chk(x.name, x.json); });   // и те, что приходят в этом же пакете (в новом составе)
  }
  var usedNames = Object.keys(used);
  if (usedNames.length) throw err_('inuse', 'Это сырьё ещё используется в ТТК общей базы: ' + usedNames.slice(0, 4).map(function (n) { return '«' + n + '» (в «' + used[n] + '»)'; }).join(', ') + (usedNames.length > 4 ? '…' : '') + '. Сначала удалите ТТК или уберите сырьё из рецептуры и опубликуйте.');
  sorted.forEach(function (it) {
    var sid = it.sid, key = it.kind + '|' + sid, nm = it.name;
    if (idx[key] === undefined) {
      var ex = byName[it.kind + '|' + nk_(it.name)];
      if (ex) { remap[sid] = ex; sid = ex; key = it.kind + '|' + sid; nm = String(rows[idx[key]][2]); }   // то же название: остаётся прежняя запись
    }
    var json = JSON.parse(JSON.stringify(it.json)), i = idx[key];
    if (json._rg !== undefined) {                                   // предложение человека с ограниченными регионами: чужие регионы остаются как в базе сейчас
      var sc0 = regIds_(json._rg), cur0 = (i !== undefined && !dead[key]) ? parse_(rows[i][6]) : null;
      delete json._rg;
      json = rgMerge_(it.kind, json, cur0, sc0);
    }
    if (json._np) { delete json._np; json = fill_(it.kind, json, (i !== undefined && !dead[key]) ? parse_(rows[i][6]) : null); }   // без цен: действующие остаются
    if (it.kind === 'rec') remapRows_(json, remap);
    json.name = nm;
    var js = stable_(json);
    if (i !== undefined) {
      var cur = rows[i];
      if (String(cur[6]) === js && String(cur[2]) === nm) return;
      top++;
      logs.push([now, by, dead[key] ? 'возврат' : action, it.kind, nm, note, top, String(cur[6]), sid]);
      rows[i] = [sid, it.kind, nm, top, now, by, js]; touched[i] = 1;
      delete dead[key];
    } else {
      top++;
      rows.push([sid, it.kind, nm, top, now, by, js]);
      idx[key] = rows.length - 1; touched[idx[key]] = 1; byName[it.kind + '|' + nk_(nm)] = sid;
      logs.push([now, by, action, it.kind, nm, note, top, '', sid]);
    }
    changed++;
  });
  /* удаления: ТТК раньше сырья; того, чего нет в общей базе или что уже удалено, не трогаем */
  dels.filter(function (x) { return x.kind === 'rec'; }).concat(dels.filter(function (x) { return x.kind === 'ing'; })).forEach(function (it) {
    var key = it.kind + '|' + it.sid, i = idx[key];
    if (i === undefined || dead[key]) return;
    var cur = rows[i];
    top++;
    logs.push([now, by, 'удалено', it.kind, String(cur[2]), note, top, String(cur[6]), it.sid]);
    rows[i] = [it.sid, it.kind, String(cur[2]), top, now, by, DEL_JSON]; touched[i] = 1;
    dead[key] = 1;
    changed++;
  });
  /* рецептура не должна ссылаться на сырьё, которого нет в общей базе */
  var lost = {};
  sorted.forEach(function (it) {
    if (it.kind !== 'rec') return;
    (it.json.rows || []).forEach(function (r) {
      var id = remap[r.ing] || r.ing;
      if (id && (idx['ing|' + id] === undefined || dead['ing|' + id])) lost[r['in'] || id] = 1;
    });
  });
  var names = Object.keys(lost);
  if (names.length) throw err_('dangling', 'В рецептурах есть сырьё, которого нет в общей базе: ' + names.slice(0, 5).join(', ') + (names.length > 5 ? '…' : '') + '. Отправьте его вместе с ТТК');
  writeRows_('pub', rows, Object.keys(touched).map(Number), 3, 6);
  appendRows_('log', logs);
  setRev_(top);
  var done = { ok: true, changed: changed, rev: top, remap: remap };
  if (guard) done.skipped = skipped;
  return done;
}

function publish_(req) {
  return apply_(cleanItems_(req.items), by_(req), 'опубликовано', note_(req), !!Number(req.guard));
}

/* статусы, из которых технолог может принять или отклонить пакет: ждёт проверки или лежит на доработке */
function open_(r) { return r[7] === WAIT || r[7] === REW; }
/* Принятые и снятые предложения остаются в листе «Предложения» ещё две недели, отклонённые — месяц (автор видит причину), потом уходят в лист «Архив предложений»:
   рабочий лист не растёт, скрипт не читает историю. Предложения, которые ждут проверки или лежат на доработке, не уходят никогда. Не чаще раза в 12 часов. */
var PEND_TIDY_AT = 300, PEND_TIDY_EVERY = 12 * 3600000, DAY_ = 86400000;
function pendTidy_(force) {
  var pr = PropertiesService.getScriptProperties(), last, rows, keep = [], arch = [], ref = {}, now = Date.now(), s;
  if (!force && now - (Number(pr.getProperty('pendTidy')) || 0) < PEND_TIDY_EVERY) return 0;
  s = sheet_('pend'); last = s.getLastRow();
  if (last - 1 < PEND_TIDY_AT) return 0;
  pr.setProperty('pendTidy', String(now));
  rows = readAll_('pend');
  rows.forEach(function (r) { if ((r[7] === WAIT || r[7] === REW) && r[13]) ref[String(r[13])] = 1; });   // пакет, после которого сделано это предложение: подсказка технологу «что вы писали в прошлый раз»
  rows.forEach(function (r) {
    var st = r[7], at = ms_(r[11]) || ms_(r[6]), old = false;
    if (st === OK || st === WD || st === REP) old = now - at > 14 * DAY_ && !ref[String(r[0])];
    else if (st === NO) old = now - at > 31 * DAY_;
    (old ? arch : keep).push(r);
  });
  if (!arch.length) return 0;
  appendRows_('parch', arch);                                  // сначала в архив, потом из рабочего листа: при сбое строка не пропадёт (в худшем случае окажется в двух местах)
  if (keep.length) s.getRange(2, 1, keep.length, SHEETS.pend.n).setValues(keep);
  s.getRange(keep.length + 2, 1, rows.length - keep.length, SHEETS.pend.n).clearContent();
  return arch.length;
}
function approve_(req) {
  var rows = readAll_('pend'), sel = [], i, now = new Date();
  rows.forEach(function (r, k) { if (String(r[0]) === String(req.batch) && open_(r)) sel.push(k); });
  if (!sel.length) throw err_('nobatch', 'Предложение не найдено или уже обработано');
  var items = sel.map(function (k) { return { kind: rows[k][1], sid: String(rows[k][2]), name: String(rows[k][3]), json: parse_(rows[k][9]) }; });
  /* технолог открыл ТТК, поправил и публикует свою версию: вместо присланных позиций применяются присланные им (в том числе новое сырьё) */
  var edited = Array.isArray(req.items) && req.items.length > 0;
  if (edited) items = cleanItems_(req.items);
  var author = String(rows[sel[0]][5]), adm = by_(req), note = 'принял: ' + adm + (edited ? ' (с правками технолога)' : '') + (note_(req) ? '. ' + note_(req) : '');
  var res = apply_(cleanItems_(items), author, 'принято', note);
  for (i = 0; i < sel.length; i++) { rows[sel[i]][7] = OK; rows[sel[i]][8] = String(rows[sel[i]][8] || '') + ' | ' + note; rows[sel[i]][11] = now; rows[sel[i]][12] = adm; }
  writeRows_('pend', rows, sel, undefined, 9);
  pendTidy_();
  res.count = sel.length;
  return res;
}

function reject_(req) {
  var rows = readAll_('pend'), sel = [], now = new Date();
  rows.forEach(function (r, k) { if (String(r[0]) === String(req.batch) && open_(r)) sel.push(k); });
  if (!sel.length) throw err_('nobatch', 'Предложение не найдено или уже обработано');
  var adm = by_(req), note = 'отклонил: ' + adm + (note_(req) ? '. ' + note_(req) : ''), why = text_(req.note, 1000);
  var author = String(rows[sel[0]][5]), first = String(rows[sel[0]][3]);
  sel.forEach(function (k) { rows[k][7] = NO; rows[k][8] = String(rows[k][8] || '') + ' | ' + note; rows[k][10] = why; rows[k][11] = now; rows[k][12] = adm; });
  writeRows_('pend', rows, sel, undefined, 9);
  appendRows_('log', [[now, author, 'отклонено', '', first + (sel.length > 1 ? ' и ещё ' + (sel.length - 1) : ''), note, 0, '', '']]);
  pendTidy_();
  return { ok: true, count: sel.length };
}

/* на доработку: технолог возвращает пакет автору с обязательным комментарием; автор увидит его в уведомлениях (inbox) */
function rework_(req) {
  var note = text_(req.note, 1000);
  if (note.length < 3) throw err_('note', 'Напишите комментарий: что нужно исправить. Без него отправить на доработку нельзя.');
  var rows = readAll_('pend'), sel = [], now = new Date();
  rows.forEach(function (r, k) { if (String(r[0]) === String(req.batch) && r[7] === WAIT) sel.push(k); });
  if (!sel.length) throw err_('nobatch', 'Предложение не найдено или уже обработано');
  var adm = by_(req), author = String(rows[sel[0]][5]), first = String(rows[sel[0]][3]);
  sel.forEach(function (k) { rows[k][7] = REW; rows[k][10] = note; rows[k][11] = now; rows[k][12] = adm; });
  writeRows_('pend', rows, sel, undefined, 9);
  appendRows_('log', [[now, author, 'на доработку', '', first + (sel.length > 1 ? ' и ещё ' + (sel.length - 1) : ''), note.replace(/\n+/g, ' ').slice(0, 300), 0, '', '']]);
  return { ok: true, count: sel.length };
}

/* автор убирает возвращённое на доработку из уведомлений (доделывать не будет) */
function rwClose_(req) {
  var rows = readAll_('pend'), sel = [], ak = nk_(by_(req));
  rows.forEach(function (r, k) { if (String(r[0]) === String(req.batch) && (r[7] === REW || r[7] === NO) && nk_(r[5]) === ak) sel.push(k); });
  if (!sel.length) throw err_('nobatch', 'Это предложение не найдено или уже обработано');
  sel.forEach(function (k) { rows[k][7] = WD; });
  writeRows_('pend', rows, sel, undefined, 9);
  return { ok: true, count: sel.length };
}

function hist_(kind, sid) {
  if (kind !== 'ing' && kind !== 'rec') throw err_('kind', 'Неизвестный вид позиции');
  if (!/^[\w-]{3,40}$/.test(sid)) throw err_('sid', 'Неверный идентификатор позиции');
  var kinds = readCol_('log', 4), sids = readCol_('log', 9), idxs = [], i;
  for (i = 0; i < sids.length; i++) { if (String(sids[i]) === sid && String(kinds[i]) === kind) idxs.push(i); }
  idxs = idxs.slice(-40);
  var rows = idxs.length ? rowsAt_('log', idxs, sids.length) : [], out = [];
  for (i = rows.length - 1; i >= 0; i--) {
    var r = rows[i];
    out.push({ at: ms_(r[0]), by: String(r[1]), action: String(r[2]), note: String(r[5] || ''), rev: Number(r[6]) || 0, hasPrev: !!r[7] });
  }
  return { ok: true, items: out };
}
function revert_(req) {
  var rows = readAll_('log'), want = Number(req.rev) || 0, row = null, i;
  for (i = rows.length - 1; i >= 0; i--) { if (Number(rows[i][6]) === want && rows[i][7]) { row = rows[i]; break; } }
  if (!row) throw err_('noprev', 'Прежнего значения нет: возвращать нечего');
  var prev = parse_(row[7]);
  if (!prev) throw err_('noprev', 'Прежнее значение не читается');
  var item = { kind: row[3], sid: String(row[8]), name: String(prev.name || row[4]), json: prev };
  return apply_(cleanItems_([item]), by_(req), 'возврат', 'вернул прежнее значение (версия ' + want + ')');
}

/* ---------- справочники: точки и юридические лица (версия 26) ----------
   Лист «Справочники»: одна строка на запись, данные — JSON. Точка: название, регион, адрес, юридическое лицо, признак «работает». Юридическое лицо:
   короткое название, полное (для шапок карт и отчётов), должность и ФИО руководителя, ИНН, КПП, ОГРН, адрес, регионы, где оно используется
   (пусто — везде), признак «работает». Записи не удаляются, а отключаются: прежние ревизии остаются понятными. Читают все коды; точку в своём регионе
   заводят технолог, редактор и тер. управляющий, менять точки и вести юридические лица может только технолог. Каждая запись имеет номер версии: если за
   то время, пока вы её правили, её изменил другой, сохранение не затирает его, а возвращает свежую запись. */
var DIR_MAX = 600;
function dirStr_(v, n) { return String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
function dirRead_() {
  var out = [];
  readAll_('dir').forEach(function (r, k) {
    if (r[0] && r[1]) out.push({ n: k + 2, kind: String(r[0]), id: String(r[1]), name: String(r[2]), ver: Number(r[3]) || 0, at: ms_(r[4]), by: String(r[5]), j: parse_(r[6]) || {} });
  });
  return out;
}
function dirRevNo_() { return Number(PropertiesService.getScriptProperties().getProperty('dirRev') || 0); }
function dirBump_() { var p = PropertiesService.getScriptProperties(), n = dirRevNo_() + 1; p.setProperty('dirRev', String(n)); return n; }
function dirPub_(x) {
  var o = {}, k;
  for (k in x.j) o[k] = x.j[k];
  o.id = x.id; o.kind = x.kind; o.ver = x.ver; o.at = x.at; o.by = x.by;
  return o;
}
function dirView_(role) {
  var sc = scope_(role), pts = [], les = [];
  dirRead_().forEach(function (x) {
    if (x.kind === 'pt') { if (rgHas_(sc, x.j.region)) pts.push(dirPub_(x)); }
    else if (x.kind === 'le') {
      var g = regIds_(x.j.regs);
      if (sc === null || !g.length || g.some(function (id) { return sc.indexOf(id) > -1; })) les.push(dirPub_(x));
    }
  });
  return { ok: true, rev: dirRevNo_(), pts: pts, les: les };
}
function dirPut_(req, role) {
  var kind = String(req.kind || ''), id = String(req.id || ''), base = Number(req.base) || 0, j0 = (req.j && typeof req.j === 'object') ? req.j : {}, sc = scope_(role),
    rows = dirRead_(), cur = null, j = {}, now = new Date(), by = by_(req), i, row, rv;
  if (kind !== 'pt' && kind !== 'le') throw err_('kind', 'Неизвестный справочник');
  if (role !== 'admin' && role !== 'editor' && role !== 'finance') throw err_('role', 'По этому коду справочники только читаются');
  if (kind === 'le' && role !== 'admin') throw err_('admin', 'Юридические лица ведёт технолог');
  if (id) {
    if (!/^[\w-]{3,40}$/.test(id)) throw err_('id', 'Неверный идентификатор записи');
    for (i = 0; i < rows.length; i++) if (rows[i].kind === kind && rows[i].id === id) { cur = rows[i]; break; }
    if (!cur) throw err_('nodoc', 'Записи уже нет в справочнике');
  }
  if (!cur && rows.length >= DIR_MAX) throw err_('many', 'В справочнике слишком много записей');
  j.name = dirStr_(j0.name, 80);
  if (!j.name) throw err_('name', kind === 'pt' ? 'Укажите название точки' : 'Укажите название юридического лица');
  j.active = j0.active !== false;
  if (kind === 'pt') {
    j.region = String(j0.region || '');
    if (!REG_RE.test(j.region)) throw err_('region', 'Выберите регион точки');
    j.address = dirStr_(j0.address, 200);
    j.le = String(j0.le || '');
    if (j.le && !rows.some(function (x) { return x.kind === 'le' && x.id === j.le; })) throw err_('le', 'Такого юридического лица нет в справочнике');
    if (cur) { if (role !== 'admin') throw err_('admin', 'Менять точку может технолог'); }
    else if (!rgHas_(sc, j.region)) throw noReg_();
    if (rows.some(function (x) { return x.kind === 'pt' && x.id !== id && x.j.region === j.region && nk_(x.name) === nk_(j.name); })) throw err_('dup', 'В этом регионе уже есть точка «' + j.name + '»');
  } else {
    j.org = dirStr_(j0.org, 200) || j.name;
    j.head = dirStr_(j0.head, 80); j.headName = dirStr_(j0.headName, 80);
    j.inn = String(j0.inn == null ? '' : j0.inn).replace(/\s+/g, '');
    j.kpp = String(j0.kpp == null ? '' : j0.kpp).replace(/\s+/g, '');
    j.ogrn = String(j0.ogrn == null ? '' : j0.ogrn).replace(/\s+/g, '');
    if (j.inn && !/^(\d{10}|\d{12})$/.test(j.inn)) throw err_('inn', 'ИНН: 10 цифр у организации, 12 у предпринимателя');
    if (j.kpp && !/^\d{9}$/.test(j.kpp)) throw err_('kpp', 'КПП: 9 цифр');
    if (j.ogrn && !/^(\d{13}|\d{15})$/.test(j.ogrn)) throw err_('ogrn', 'ОГРН: 13 цифр, у предпринимателя ОГРНИП — 15');
    j.addr = dirStr_(j0.addr, 200);
    j.regs = regIds_(j0.regs);
    if (rows.some(function (x) { return x.kind === 'le' && x.id !== id && nk_(x.name) === nk_(j.name); })) throw err_('dup', 'Юридическое лицо «' + j.name + '» уже есть в справочнике');
  }
  if (cur && cur.ver !== base) return { ok: false, err: 'conflict', msg: 'Запись успели изменить: показана свежая версия', cur: dirPub_(cur) };
  id = id || (kind === 'pt' ? 'p' : 'l') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  row = [kind, id, j.name, cur ? cur.ver + 1 : 1, now, by, JSON.stringify(j)];
  if (cur) sheet_('dir').getRange(cur.n, 1, 1, SHEETS.dir.n).setValues([row]); else appendRows_('dir', [row]);
  rv = dirBump_();
  appendRows_('log', [[now, by, cur ? 'справочник изменён' : 'справочник дополнен', 'справочник', (kind === 'pt' ? 'Точка: ' : 'Юридическое лицо: ') + j.name, '', 0, '', id]]);
  return { ok: true, rev: rv, item: dirPub_({ kind: kind, id: id, ver: row[3], at: now.getTime(), by: by, j: j }) };
}

/* ---------- ревизии (версия 26) ----------
   Лист «Ревизии»: одна строка на ревизию. Столбцы: ид, номер, регион, точка, статус («draft» — черновик, «done» — завершена), версия, когда и кем изменено, дата ревизии,
   сводка (итоги для списка) и данные (JSON, режутся на четыре ячейки). Строка ревизии: название сырья, единица, учётный остаток (b), факт (f), учётная цена за единицу (p).
   Пустой факт — «не посчитано», не ноль; неизвестная цена — не ноль. Разница = факт − учёт, сумма = разница × цена; недостача (минус) и излишек (плюс) считаются
   отдельно. Завершить можно, только когда посчитаны все строки; завершённую ревизию изменить нельзя, а в ней остаётся снимок точки, юридического лица и итогов
   на момент завершения: правки справочников старые отчёты не меняют. Каждая запись имеет номер версии: параллельная правка не затирается, а возвращается как конфликт. */
var RV_MAX_LINES = 1500, RV_CELL = 45000, RV_CHUNKS = 4, RV_UNITS = ['кг', 'г', 'л', 'мл', 'шт', 'уп'];
function rvRead_() {
  var out = [];
  readAll_('rev').forEach(function (r, k) {
    if (!r[0]) return;
    out.push({ n: k + 2, id: String(r[0]), num: String(r[1]), region: String(r[2]), point: String(r[3]), status: String(r[4]), ver: Number(r[5]) || 0, at: ms_(r[6]), by: String(r[7]), date: String(r[8]), sum: parse_(r[9]) || {}, raw: [r[10], r[11], r[12], r[13]] });
  });
  return out;
}
function rvDoc_(x) { return parse_(x.raw.map(function (v) { return String(v == null ? '' : v); }).join('')) || {}; }
function rvPack_(doc) {
  var txt = JSON.stringify(doc), parts = [], i;
  if (txt.length > RV_CELL * RV_CHUNKS) throw err_('size', 'Ревизия слишком большая для одной записи: разделите её на две');
  for (i = 0; i < RV_CHUNKS; i++) parts.push(txt.slice(i * RV_CELL, (i + 1) * RV_CELL));
  return parts;
}
function rvRevNo_() { return Number(PropertiesService.getScriptProperties().getProperty('rvRev') || 0); }
function rvBump_() { var p = PropertiesService.getScriptProperties(), n = rvRevNo_() + 1; p.setProperty('rvRev', String(n)); return n; }
function rvNum_(v, what, min) {
  if (v === null || v === undefined || v === '') return null;
  var x = typeof v === 'number' ? v : Number(String(v).replace(/\s+/g, '').replace(',', '.'));
  if (!isFinite(x)) throw err_('num', 'Не число: ' + what);
  if (min !== undefined && x < min) throw err_('num', what + ': не может быть меньше ' + min);
  return Math.round(x * 1e6) / 1e6;
}
function rvLine_(l, k) {
  l = (l && typeof l === 'object') ? l : {};
  var name = dirStr_(l.n, 200), unit = String(l.u == null ? '' : l.u).trim();
  if (!name) throw err_('line', 'Строка ' + (k + 1) + ': нет названия сырья');
  if (RV_UNITS.indexOf(unit) < 0) throw err_('unit', 'Строка ' + (k + 1) + ' («' + name + '»): единица «' + unit + '» не подходит, нужна одна из: ' + RV_UNITS.join(', '));
  var o = { n: name, u: unit, g: rvNum_(l.g, 'масса единицы', 0), b: rvNum_(l.b, 'учётный остаток'), f: rvNum_(l.f, 'факт', 0), p: rvNum_(l.p, 'цена', 0) };
  if ((unit === 'шт' || unit === 'уп') && !(o.g > 0)) { /* масса штуки нужна только для пересчёта в вес; сама ревизия считается в штуках */ }
  if (l.s && /^[\w-]{3,40}$/.test(String(l.s))) o.s = String(l.s);
  var c = dirStr_(l.c, 200); if (c) o.c = c;
  return o;
}
/* Пустой учётный остаток — не ноль: разница и сумма не определены. Сумма строки округляется до копеек, итог — сумма округлённых сумм
   (то же правило, что revTotals и revSum в калькуляторе). */
function rvR2_(v) { return Math.round(v * 100 + (v < 0 ? -1e-9 : 1e-9)) / 100; }
function rvTotals_(lines) {
  var t = { n: lines.length, cnt: 0, skip: 0, noBook: 0, short: 0, over: 0, sumShort: 0, sumOver: 0, noPrice: 0 };
  lines.forEach(function (l) {
    if (l.f === null) { t.skip++; return; }
    t.cnt++;
    if (l.b === null) { t.noBook++; return; }
    var d = Math.round((l.f - l.b) * 1e6) / 1e6;
    if (d === 0) return;
    if (d < 0) t.short++; else t.over++;
    if (l.p === null) { t.noPrice++; return; }
    var sm = rvR2_(d * l.p);
    if (d < 0) t.sumShort += sm; else t.sumOver += sm;
  });
  t.sumShort = rvR2_(t.sumShort); t.sumOver = rvR2_(t.sumOver);
  return t;
}
/* чего не хватает строкам, чтобы ревизию можно было завершить; слова те же, что в калькуляторе (revIssues) */
function rvIssues_(lines) {
  var nb = [], nf = [], np = [], out = [];
  function lst(a) { return a.slice(0, 5).join(', ') + (a.length > 5 ? ' и ещё ' + (a.length - 5) : ''); }
  lines.forEach(function (l, i) {
    var tag = '№' + (i + 1) + ' «' + l.n + '»';
    if (l.b === null) nb.push(tag);
    if (l.f === null) nf.push(tag);
    if (l.b !== null && l.f !== null && l.p === null && Math.round((l.f - l.b) * 1e6) !== 0) np.push(tag);
  });
  if (nb.length) out.push({ code: 'nobook', msg: 'не указан учётный остаток (ноль, если на учёте пусто): ' + lst(nb) });
  if (nf.length) out.push({ code: 'notcounted', msg: 'не введён факт (ноль, если сырья нет): ' + lst(nf) });
  if (np.length) out.push({ code: 'noprice', msg: 'нет цены у строк с отклонением: ' + lst(np) });
  return out;
}
function rvClean_(d, now) {
  d = (d && typeof d === 'object') ? d : {};
  var lines = Array.isArray(d.lines) ? d.lines : [], date = String(d.date || '').trim();
  if (lines.length > RV_MAX_LINES) throw err_('many', 'В ревизии больше ' + RV_MAX_LINES + ' строк: разделите её');
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw err_('date', 'Дата ревизии: ГГГГ-ММ-ДД');
  if (!date) date = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return { num: dirStr_(d.num, 30), date: date, point: String(d.point || ''), region: String(d.region || ''), resp: dirStr_(d.resp, 100), note: String(d.note == null ? '' : d.note).replace(/\r\n?/g, '\n').trim().slice(0, 1000), lines: lines.map(rvLine_) };
}
function rvPubRow_(x) { return { id: x.id, num: x.num, region: x.region, point: x.point, status: x.status === 'done' ? 'done' : 'draft', ver: x.ver, at: x.at, by: x.by, date: x.date, sum: x.sum }; }
function rvList_(role) {
  var sc = scope_(role), out = [];
  rvRead_().forEach(function (x) { if (rgHas_(sc, x.region)) out.push(rvPubRow_(x)); });
  out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.at - a.at); });
  return { ok: true, rev: rvRevNo_(), items: out.slice(0, 1000) };
}
function rvGet_(id, role) {
  var sc = scope_(role), rows = rvRead_(), i;
  for (i = 0; i < rows.length; i++) if (rows[i].id === id && rgHas_(sc, rows[i].region)) { var o = rvPubRow_(rows[i]); o.doc = rvDoc_(rows[i]); return { ok: true, rv: o }; }
  throw err_('norev', 'Ревизия не найдена');
}
/* номер ревизии: РЕГИОН-ГГГГ-001, по порядку внутри региона и года; технолог и редактор могут задать свой, он должен быть уникальным */
function rvAutoNum_(region, date, rows) {
  var pr = PropertiesService.getScriptProperties(), yy = String(date).slice(0, 4), key = 'rvn:' + region + ':' + yy, seq = Number(pr.getProperty(key)) || 0,
    pfx = region.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'REV', head = pfx + '-' + yy + '-', num, s;
  /* счётчик не должен отставать от уже выданных номеров: берём наибольший существующий */
  rows.forEach(function (x) {
    if (x.region === region && String(x.num).indexOf(head) === 0) { var m = /^(\d+)$/.exec(String(x.num).slice(head.length)); if (m && Number(m[1]) > seq) seq = Number(m[1]); }
  });
  /* номера не короче трёх цифр, после 999 — 1000, 1001 … без обрезания; перебор всегда конечен: seq растёт, строк конечное число */
  do { seq++; s = String(seq); while (s.length < 3) s = '0' + s; num = head + s; } while (rows.some(function (x) { return x.num === num; }));
  pr.setProperty(key, String(seq));
  return num;
}
function rvPut_(req, role, finish) {
  if (role !== 'admin' && role !== 'editor' && role !== 'finance') throw err_('role', 'По этому коду ревизии только читаются');
  var now = new Date(), sc = scope_(role), id = String(req.id || ''), base = Number(req.base) || 0, d = rvClean_(req.doc, now), rows = rvRead_(), dir = dirRead_(), cur = null, pt = null, le = null, by = by_(req), i, snap = null, row, st, tot, un;
  if (!REG_RE.test(d.region)) throw err_('region', 'Выберите регион ревизии');
  if (!rgHas_(sc, d.region)) throw noReg_();
  dir.forEach(function (x) { if (x.kind === 'pt' && x.id === d.point) pt = x; });
  if (!pt) throw err_('point', 'Выберите точку из справочника');
  if (pt.j.region !== d.region) throw err_('point', 'Точка относится к другому региону');
  if (id) {
    for (i = 0; i < rows.length; i++) if (rows[i].id === id) { cur = rows[i]; break; }
    if (!cur || !rgHas_(sc, cur.region)) throw err_('norev', 'Ревизия не найдена');
    if (cur.status === 'done') throw err_('done', 'Ревизия завершена: изменить её нельзя');
  } else if (pt.j.active === false) throw err_('point', 'Точка отключена: выберите работающую');
  if (cur && cur.ver !== base) return { ok: false, err: 'conflict', msg: 'Ревизию успели изменить: показана свежая версия', cur: rvPubRow_(cur), doc: rvDoc_(cur) };
  if (d.num && rows.some(function (x) { return x.id !== id && x.region === d.region && x.num === d.num; })) throw err_('dup', 'Ревизия с номером «' + d.num + '» в этом регионе уже есть');
  if (!d.num) d.num = cur ? cur.num : rvAutoNum_(d.region, d.date, rows);
  if (finish) {
    if (!d.lines.length) throw err_('empty', 'В ревизии нет строк');
    un = rvIssues_(d.lines);
    if (un.length) throw err_(un[0].code, 'Чтобы завершить: ' + un.map(function (x) { return x.msg; }).join('; ') + '.');
    if (!d.resp) throw err_('resp', 'Укажите ответственное лицо');
    dir.forEach(function (x) { if (x.kind === 'le' && x.id === pt.j.le) le = x; });
    snap = {
      v: 2, at: now.getTime(), by: by, num: d.num, date: d.date, resp: d.resp, note: d.note,
      region: { id: d.region, name: (tregs_().filter(function (g) { return g.id === d.region; })[0] || {}).name || dirStr_(req.regName, 80) || d.region },
      point: { id: pt.id, name: pt.j.name, address: pt.j.address || '', le: pt.j.le || '' },
      le: le ? { id: le.id, name: le.j.name, org: le.j.org || le.j.name, head: le.j.head || '', headName: le.j.headName || '', inn: le.j.inn || '', kpp: le.j.kpp || '', ogrn: le.j.ogrn || '', addr: le.j.addr || '' } : null,
      tot: rvTotals_(d.lines)
    };
  }
  tot = rvTotals_(d.lines);
  st = finish ? 'done' : 'draft';
  var doc = { v: 1, date: d.date, point: d.point, region: d.region, resp: d.resp, note: d.note, lines: d.lines };
  if (snap) doc.snap = snap;
  var sum = { n: tot.n, cnt: tot.cnt, skip: tot.skip, noBook: tot.noBook, short: tot.short, over: tot.over, sumShort: tot.sumShort, sumOver: tot.sumOver, noPrice: tot.noPrice, resp: d.resp };
  id = id || 'v' + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  row = [id, d.num, d.region, d.point, st, cur ? cur.ver + 1 : 1, now, by, d.date, JSON.stringify(sum)].concat(rvPack_(doc));
  if (cur) sheet_('rev').getRange(cur.n, 1, 1, SHEETS.rev.n).setValues([row]); else appendRows_('rev', [row]);
  rvBump_();
  appendRows_('log', [[now, by, finish ? 'ревизия завершена' : (cur ? 'ревизия сохранена' : 'ревизия начата'), 'ревизия', d.num + ' · ' + pt.j.name, '', 0, '', id]]);
  return { ok: true, id: id, num: d.num, ver: row[5], at: now.getTime(), by: by, status: st, sum: sum, rev: rvRevNo_() };
}
function rvDel_(req, role) {
  if (role !== 'admin' && role !== 'editor' && role !== 'finance') throw err_('role', 'По этому коду ревизии только читаются');
  var sc = scope_(role), id = String(req.id || ''), base = Number(req.base) || 0, rows = rvRead_(), cur = null, i;
  for (i = 0; i < rows.length; i++) if (rows[i].id === id) { cur = rows[i]; break; }
  if (!cur || !rgHas_(sc, cur.region)) throw err_('norev', 'Ревизия не найдена');
  if (cur.status === 'done') throw err_('done', 'Завершённую ревизию удалить нельзя: она остаётся в истории');
  if (cur.ver !== base) return { ok: false, err: 'conflict', msg: 'Черновик успели изменить: показана свежая версия', cur: rvPubRow_(cur), doc: rvDoc_(cur) };
  sheet_('rev').deleteRow(cur.n);
  rvBump_();
  appendRows_('log', [[new Date(), by_(req), 'черновик ревизии удалён', 'ревизия', cur.num, '', 0, '', id]]);
  return { ok: true, id: id, rev: rvRevNo_() };
}

/* ---------- помощник ИИ ----------
   Калькулятор присылает готовый запрос (system и user), скрипт обращается к выбранному ИИ-сервису с ключом из свойств скрипта и возвращает текст.
   Сервис и ключ задаёт технолог в калькуляторе («Личный кабинет» → «ИИ-помощник»); ключ хранится только здесь и никуда не отдаётся.
   Подходит любой сервис с форматом OpenAI (OpenRouter, Groq, Mistral, DeepSeek, свой адрес), отдельно поддержан GigaChat.
   Доступно кодам технолога и редактора. Один раз из редактора запустите функцию aiSetup: Google попросит разрешить доступ к внешним адресам. */
var AI_PROVS = {
  openrouter: { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1/chat/completions', model: 'openrouter/free' },
  groq: { name: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  mistral: { name: 'Mistral', url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-small-latest' },
  deepseek: { name: 'DeepSeek', url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
  giga: { name: 'GigaChat', url: 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions', model: 'GigaChat-2' },
  custom: { name: 'Свой сервис', url: '', model: '' }
};
var AI_DEFAULT = 'openrouter';
var AI_AUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
var AI_SCOPES = ['GIGACHAT_API_PERS', 'GIGACHAT_API_B2B', 'GIGACHAT_API_CORP'];
var AI_MODELS = ['GigaChat-2', 'GigaChat-2-Pro', 'GigaChat-2-Max'];
var AI_HOURLY = 120;           // запросов к ИИ в час на весь скрипт

function aiProp_(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function aiProv_() {
  var p = aiProp_('aiProv');
  if (AI_PROVS.hasOwnProperty(p)) return p;
  return aiProp_('gigaAuth') ? 'giga' : AI_DEFAULT;       // ключ GigaChat из версии 17 продолжает работать
}
function aiKeyName_(p) { return p === 'giga' ? 'gigaAuth' : 'aik_' + p; }
function aiModelName_(p) { return p === 'giga' ? 'gigaModel' : 'aim_' + p; }
function aiUrlOk_(u) { return /^https:\/\/(?!localhost|127\.|10\.|192\.168\.|169\.254\.|\[)[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(:\d{2,5})?(\/[\w\-.~%\/]*)?$/i.test(u); }
function aiReady_() {
  var p = aiProv_();
  if (!aiProp_(aiKeyName_(p))) return false;
  return p !== 'custom' || aiUrlOk_(aiProp_('aiUrl'));
}
function aiHost_(p) {
  var u = p === 'custom' ? aiProp_('aiUrl') : AI_PROVS[p].url, m = /^https:\/\/[^\/]+\//.exec(u + '/');
  return m ? m[0] : 'https://openrouter.ai/';
}
function aiSetup() {
  var p = aiProv_(), msg;
  try { msg = 'ответ сервера ' + UrlFetchApp.fetch(aiHost_(p), { muteHttpExceptions: true }).getResponseCode(); }
  catch (e) { msg = 'проверка не прошла: ' + String(e && e.message || e); }
  Logger.log('Доступ к внешним адресам разрешён. ' + AI_PROVS[p].name + ': ' + msg + '. Теперь вставьте ключ в калькуляторе: «Личный кабинет» → «ИИ-помощник».');
}
function aiInfo_(role) {
  var p = aiProv_(), o = { ok: true, ready: aiReady_(), prov: p, pname: AI_PROVS[p].name };
  if (role === 'admin') {
    var k = {}, q; for (q in AI_PROVS) if (AI_PROVS.hasOwnProperty(q)) k[q] = !!aiProp_(aiKeyName_(q));
    o.keys = k;
    o.model = aiProp_(aiModelName_(p)) || AI_PROVS[p].model;
    o.scope = aiProp_('gigaScope') || AI_SCOPES[0]; o.lax = aiProp_('gigaLax') === '1'; o.url = aiProp_('aiUrl');
  }
  return o;
}
function aiKey_(req) {
  var pr = PropertiesService.getScriptProperties(), cache = CacheService.getScriptCache(), p = req.prov === undefined ? aiProv_() : String(req.prov);
  if (!AI_PROVS.hasOwnProperty(p)) return fail_('aikey', 'Неизвестный ИИ-сервис.');
  if (req.clear) { pr.deleteProperty(aiKeyName_(p)); cache.remove('ai:tok'); return { ok: true, ai: aiInfo_('admin') }; }
  var key = String(req.key == null ? '' : req.key).replace(/^\s*(?:Basic|Bearer)\s+/i, '').replace(/\s+/g, '');
  if (key) {
    if (!/^[A-Za-z0-9+\/=_.:-]{16,600}$/.test(key)) return fail_('aikey', 'Это не похоже на ключ: он состоит из латинских букв, цифр и знаков - _ без пробелов. Скопируйте ключ целиком.');
    pr.setProperty(aiKeyName_(p), key); cache.remove('ai:tok');
  }
  if (req.scope !== undefined) {
    if (AI_SCOPES.indexOf(req.scope) < 0) return fail_('aikey', 'Неизвестный тип доступа.');
    pr.setProperty('gigaScope', req.scope); cache.remove('ai:tok');
  }
  if (req.model !== undefined) {
    var m = String(req.model).trim();
    if (p === 'giga' ? AI_MODELS.indexOf(m) < 0 : (m && !/^[\w.:\/@+-]{2,100}$/.test(m))) return fail_('aikey', 'Неверное название модели.');
    if (m) pr.setProperty(aiModelName_(p), m); else pr.deleteProperty(aiModelName_(p));
  }
  if (req.url !== undefined) {
    var u = String(req.url).trim();
    if (u && !aiUrlOk_(u)) return fail_('aikey', 'Адрес должен начинаться с https:// и вести на сервис с форматом OpenAI, например https://api.example.com/v1/chat/completions.');
    if (u) pr.setProperty('aiUrl', u); else pr.deleteProperty('aiUrl');
  }
  if (req.lax !== undefined) pr.setProperty('gigaLax', req.lax ? '1' : '0');
  if (req.prov !== undefined) pr.setProperty('aiProv', p);
  return { ok: true, ai: aiInfo_('admin') };
}
function aiFetch_(url, o, p) {
  o.muteHttpExceptions = true;
  if (p === 'giga' && aiProp_('gigaLax') === '1') o.validateHttpsCertificates = false;
  try {
    var r = UrlFetchApp.fetch(url, o);
    return { code: r.getResponseCode(), body: r.getContentText() };
  } catch (e) {
    var m = String(e && e.message || e);
    if (/certificate|SSL|PKIX|handshake/i.test(m)) {
      if (p === 'giga') throw err_('tls', 'Скрипт не доверяет сертификату Сбера. Технолог может разрешить подключение без проверки сертификата: «Личный кабинет» → «ИИ-помощник».');
      throw err_('tls', 'Не удалось установить защищённое соединение с «' + AI_PROVS[p].name + '».');
    }
    throw err_('net', 'Не удалось связаться с «' + AI_PROVS[p].name + '»: ' + m.slice(0, 200));
  }
}
function aiHttpErr_(code, body, auth, p, model) {
  var d = parse_(body), n = '«' + AI_PROVS[p].name + '»', x = d && (d.error && (d.error.message || d.error) || d.message || d.detail);
  var t = x && typeof x !== 'object' ? ' (' + String(x).slice(0, 160) + ')' : '';
  if (code === 401 || code === 403 || (auth && code === 400)) return err_('aikey', n + ' не принял ключ: проверьте ключ' + (p === 'giga' ? ' и тип доступа (физлица, ИП, юрлица)' : '') + t + '.');
  if (code === 402) return err_('pay', 'В ' + n + ' закончились средства или бесплатный лимит.');
  if (code === 429) return err_('rate', n + ': слишком много запросов или исчерпан дневной лимит бесплатного тарифа. Повторите позже.');
  if (code === 404) return err_('model', n + ': не найдена модель «' + String(model || '') + '». Выберите другую в «Личном кабинете» → «ИИ-помощник».');
  return err_('ai', n + ' ответил ошибкой ' + code + t + '.');
}
function aiToken_(force) {                     // только GigaChat: ключ меняется на токен на 30 минут
  var cache = CacheService.getScriptCache(), tk = force ? '' : cache.get('ai:tok');
  if (tk) return tk;
  var r = aiFetch_(AI_AUTH_URL, {
    method: 'post', contentType: 'application/x-www-form-urlencoded',
    headers: { Authorization: 'Basic ' + aiProp_('gigaAuth'), RqUID: Utilities.getUuid(), Accept: 'application/json' },
    payload: 'scope=' + (aiProp_('gigaScope') || AI_SCOPES[0])
  }, 'giga');
  var d = parse_(r.body);
  if (r.code !== 200 || !d || !d.access_token) throw aiHttpErr_(r.code, r.body, true, 'giga', '');
  var ttl = Math.floor(((Number(d.expires_at) || 0) - Date.now()) / 1000) - 90;
  cache.put('ai:tok', d.access_token, Math.max(60, Math.min(1500, ttl)));
  return d.access_token;
}
function aiText_(d) {
  var c = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content, t;
  if (Array.isArray(c)) c = c.map(function (x) { return x && x.text ? x.text : (typeof x === 'string' ? x : ''); }).join('');
  t = String(c || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  return t;
}
function aiChat_(system, user, temp, max) {
  var p = aiProv_(), cfg = AI_PROVS[p], msgs = [], model = aiProp_(aiModelName_(p)) || cfg.model, url = p === 'custom' ? aiProp_('aiUrl') : cfg.url, r, again = false, tries = 0, key = aiProp_(aiKeyName_(p));
  if (system) msgs.push({ role: 'system', content: system });
  msgs.push({ role: 'user', content: user });
  var o = { model: model, messages: msgs, temperature: temp, max_tokens: max, stream: false };
  for (;;) {
    r = aiFetch_(url, { method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + (p === 'giga' ? aiToken_(again) : key), Accept: 'application/json' }, payload: JSON.stringify(o) }, p);
    if (r.code === 401 && p === 'giga' && !again) { again = true; continue; }     // токен мог устареть: берём новый и повторяем один раз
    if (r.code === 400 && p !== 'giga' && tries < 2) {                           // часть моделей не принимает max_tokens или temperature
      var b = String(r.body);
      if (/max_completion_tokens/i.test(b) && o.max_tokens !== undefined) { o.max_completion_tokens = o.max_tokens; delete o.max_tokens; tries++; continue; }
      if (/temperature/i.test(b) && o.temperature !== undefined) { delete o.temperature; tries++; continue; }
    }
    break;
  }
  if (r.code !== 200) throw aiHttpErr_(r.code, r.body, false, p, model);
  var d = parse_(r.body), text = aiText_(d);
  if (!text && p !== 'giga') {                                                   // у бесплатных сервисов бывают пустые ответы: один повтор
    r = aiFetch_(url, { method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' }, payload: JSON.stringify(o) }, p);
    if (r.code !== 200) throw aiHttpErr_(r.code, r.body, false, p, model);
    d = parse_(r.body); text = aiText_(d);
  }
  if (!text) throw err_('ai', '«' + cfg.name + '» вернул пустой ответ. Повторите запрос' + (p === 'openrouter' && model === 'openrouter/free' ? ' или выберите конкретную модель из списка бесплатных.' : '.'));
  return { text: text, model: String(d.model || model), tokens: d.usage ? Number(d.usage.total_tokens) || 0 : 0 };
}
/* бесплатные модели OpenRouter: список открыт без ключа, кладём в кэш на 6 часов */
function aiModels_() {
  var cache = CacheService.getScriptCache(), c = cache.get('ai:models'), r, d, out = [];
  if (c) return JSON.parse(c);
  r = aiFetch_('https://openrouter.ai/api/v1/models', { method: 'get', headers: { Accept: 'application/json' } }, 'openrouter');
  d = parse_(r.body);
  if (r.code !== 200) throw aiHttpErr_(r.code, r.body, false, 'openrouter', '');
  if (!d || !Array.isArray(d.data)) throw err_('ai', 'Список моделей пришёл в неожиданном виде. Попробуйте позже или введите название модели вручную.');
  d.data.forEach(function (m) {
    var pr = m && m.pricing || {}, mod = m && m.architecture && m.architecture.output_modalities;
    if (!m || !m.id || !/:free$/.test(String(m.id))) return;
    if (Number(pr.prompt) !== 0 || Number(pr.completion) !== 0) return;
    if (Array.isArray(mod) && mod.indexOf('text') < 0) return;
    out.push({ id: String(m.id), name: String(m.name || m.id).slice(0, 80), ctx: Number(m.context_length) || 0 });
  });
  out.sort(function (a, b) { return b.ctx - a.ctx; });
  out = { ok: true, models: out.slice(0, 60) };
  cache.put('ai:models', JSON.stringify(out), 21600);
  return out;
}
function aiRun_(req, role) {
  if (!role) return fail_('code', 'Код не подходит');
  if (role !== 'admin' && role !== 'editor') return fail_('viewer', 'ИИ-помощник доступен технологу и редактору.');
  if (!aiReady_()) return fail_('aikey', 'ИИ не настроен: технолог вводит ключ в «Личном кабинете» → «ИИ-помощник».');
  var system = String(req.system || '').slice(0, 6000), user = String(req.user || '').slice(0, 12000);
  if (!user.trim()) return fail_('ai', 'Пустой запрос');
  var cache = CacheService.getScriptCache(), hk = 'ain:' + Math.floor(Date.now() / 3600000), n = Number(cache.get(hk) || 0);
  if (n >= AI_HOURLY) return fail_('rate', 'За последний час сделано много запросов к ИИ. Повторите позже.');
  cache.put(hk, String(n + 1), 4000);
  var t = Number(req.temp); if (!isFinite(t)) t = 0.3;
  var o = aiChat_(system, user, Math.max(0, Math.min(1, t)), Math.max(100, Math.min(2000, Number(req.max) || 1200)));
  return { ok: true, text: o.text, model: o.model, tokens: o.tokens, prov: aiProv_() };
}
