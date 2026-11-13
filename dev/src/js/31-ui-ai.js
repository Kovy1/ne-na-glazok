/* ---------- помощник ИИ: черновик технологии (п. 4.2) и органолептики (п. 6.1) ----------
   Запрос собирает калькулятор: название блюда, состав и образцы из своих же ТТК. Через скрипт он уходит в GigaChat (ключ хранится только в скрипте).
   Ответ — черновик под полем: его можно править, вставить в карту, добавить к тексту или убрать. Без настроенного ИИ остаётся «Скопировать запрос». */
var AI_PV={
  openrouter:{n:'OpenRouter',m:'openrouter/free',to:'в OpenRouter',how:'1. Откройте openrouter.ai и войдите через почту или Google.<br>2. Раздел Keys → Create Key. Ключ начинается с sk-or-.<br>3. Вставьте его сюда. Для бесплатных моделей карта не нужна, лимит 50 запросов в день. Модель openrouter/free сама выбирает бесплатную модель; для ровного качества нажмите «Список бесплатных моделей» и выберите одну.'},
  groq:{n:'Groq',m:'llama-3.3-70b-versatile',to:'в Groq',how:'1. Откройте console.groq.com и войдите.<br>2. Раздел API Keys → Create API Key. Ключ начинается с gsk_.<br>3. Вставьте его сюда. Бесплатный тариф щедрый по лимитам, но в некоторых странах сервис недоступен.'},
  mistral:{n:'Mistral',m:'mistral-small-latest',to:'в Mistral',how:'1. Откройте console.mistral.ai и войдите.<br>2. Включите бесплатный тариф «Experiment» (могут попросить номер телефона), затем раздел API Keys.<br>3. Вставьте ключ сюда.'},
  deepseek:{n:'DeepSeek',m:'deepseek-chat',to:'в DeepSeek',how:'1. Откройте platform.deepseek.com и войдите.<br>2. Раздел API keys → Create. Платформа платная: нужен положительный баланс, запросы стоят копейки.<br>3. Вставьте ключ сюда.'},
  giga:{n:'GigaChat (Сбер)',m:'GigaChat-2',to:'в GigaChat (Сбер)',how:'1. В кабинете разработчика Сбера (developers.sber.ru) создайте проект GigaChat API и получите «Ключ авторизации».<br>2. Тип доступа выберите по своему тарифу.<br>3. Вставьте ключ сюда.'},
  custom:{n:'Свой сервис',m:'',to:'в указанный вами ИИ-сервис',how:'Подойдёт любой сервис с форматом OpenAI. Укажите полный адрес вида https://api.example.com/v1/chat/completions, ключ и название модели.'}
};
var AI_SYS='Ты технолог предприятия общественного питания в России и составляешь разделы технико-технологической карты (ТТК). Пиши по-русски, деловым стилем, как в Сборнике рецептур и типовых ТТК: безличные формулировки, глаголы в неопределённой форме («Мясо нарезать кубиками 1,5×1,5 см», «Обжарить 8–10 минут при температуре 160–180 °C»). Используй только сырьё из списка (воду, соль и перец добавлять можно). Не используй markdown, звёздочки, маркеры и нумерацию.';
var AI_ORG=[['look','Внешний вид'],['color','Цвет'],['texture','Консистенция'],['taste','Вкус и запах']];
var AI_CHATS=[{id:'deepseek',n:'DeepSeek',u:'https://chat.deepseek.com/'},{id:'qwen',n:'Qwen',u:'https://chat.qwen.ai/'},{id:'mistral',n:'Le Chat (Mistral)',u:'https://chat.mistral.ai/chat'},{id:'giga',n:'GigaChat',u:'https://giga.chat/'},{id:'alice',n:'Алиса (Яндекс)',u:'https://alice.yandex.ru/'},{id:'chatgpt',n:'ChatGPT',u:'https://chatgpt.com/'}];
function aiS(){if(!S.ai)S.ai={busy:'',err:'',errK:'',cfg:null,chat:lsGet('kbzhu:aichat')||'',wait:null,undo:null};return S.ai;}
function aiChat(){var id=aiS().chat,i;for(i=0;i<AI_CHATS.length;i++)if(AI_CHATS[i].id===id)return AI_CHATS[i];return AI_CHATS[0];}
function aiRole(){var c=S.sy.cfg;return S.mode==='local'&&syLinked()&&(c.role==='admin'||c.role==='editor');}
function aiOn(){return aiRole()&&!!(S.sy.info&&S.sy.info.ai);}
function aiPv(id){return AI_PV[id]||AI_PV.openrouter;}
function aiNow(){var i=S.sy.info;return aiPv(i&&i.aip||(S.ai&&S.ai.cfg&&S.ai.cfg.prov)||'openrouter');}
function aiOffText(){
  var i=S.sy.info;
  if(i&&(Number(i.v)||0)<18)return'Для ИИ нужна версия скрипта 18: технолог вставляет новый скрипт («Личный кабинет» → «Настройка скрипта») и создаёт новую версию развёртывания.';
  return'ИИ ещё не настроен: технолог выбирает сервис и вводит ключ в «Личном кабинете» → «ИИ-помощник».';
}
function aiDishName(r){
  var d=String(ttkVal(r,'dish')||'').trim()||String(r.name||'').trim()||'Блюдо',p=String(ttkVal(r,'portion')||'').trim();
  return d+(p?' '+p:'');
}
function aiRowsText(r){
  return ttkRowList(r).map(function(x){
    var ing=S.ings[x.ing],nm=x.tname||(ing?ing.name:'');
    return nm?'- '+nm+(x.net>0?', нетто '+dnum(x.net,2)+' г':''):'';
  }).filter(Boolean).join('\n');
}
/* похожие ТТК из своей базы: по словам в названии и общему сырью; из них берутся образцы формулировок */
function aiSimilar(r,keys){
  function words(s){return String(s||'').toLowerCase().replace(/[^а-яёa-z0-9\s]/g,' ').split(/\s+/).filter(function(w){return w.length>3;});}
  var my=words(aiDishName(r)),mine={},list=[];
  ttkRowList(r).forEach(function(x){if(x.ing)mine[x.ing]=1;});
  Object.keys(S.recipes).forEach(function(id){
    var o=S.recipes[id];
    if(o===r||!o||!o.ttk)return;
    if(!keys.some(function(k){return String(o.ttk[k]||'').trim().length>15;}))return;
    var sc=0,w=words(aiDishName(o));
    my.forEach(function(a){if(w.indexOf(a)>-1)sc+=3;});
    (o.rows||[]).forEach(function(x){if(x&&x.ing&&mine[x.ing])sc+=1;});
    list.push({o:o,sc:sc});
  });
  list.sort(function(a,b){return b.sc-a.sc;});
  return list.slice(0,3).map(function(x){return x.o;});
}
/* plain: запрос для обычного чата (ответ читает человек), иначе для вставки в карту (организолептика — JSON) */
function aiPrompt(k,plain){
  var r=curRecipe(),u='Блюдо: '+aiDishName(r)+'\nВыход одной порции: '+dnum(r.output,2)+' г\nСостав на 1 порцию:\n'+(aiRowsText(r)||'(состав пока не заполнен)')+'\n',ex;
  if(k==='tech'){
    ex=aiSimilar(r,['t42']);
    if(ex.length)u+='\nОбразцы технологии из похожих карт этой организации (только для стиля и порядка операций, состав не копируй):\n'+ex.map(function(o,i){return'['+(i+1)+'] '+aiDishName(o)+'\n'+String(o.ttk.t42).trim().slice(0,900);}).join('\n\n')+'\n';
    var cur=String(ttkVal(r,'t42')||'').trim();
    if(cur)u+='\nУже написано (учти и улучши, ничего важного не теряй):\n'+cur.slice(0,1500)+'\n';
    u+='\nНапиши раздел «4.2. Технология приготовления» подробно и конкретно: от 6 до 12 пунктов по порядку операций, каждый пункт с новой строки, без номеров. В пунктах должно быть: как обработать и нарезать каждое сырьё (форма и размер нарезки в см или мм); порядок и момент закладки продуктов; способ тепловой обработки с температурой в °C и временем в минутах (обжарка, варка, тушение, запекание); признак готовности и температура внутри продукта, где это важно; порционирование и температура подачи. Значения бери из образцов организации, если они есть, иначе ставь типовые из сборников рецептур. Пропусков и общих слов вроде «до готовности» без времени быть не должно. Пометку вида [уточнить: …] ставь только там, где значение действительно нельзя оценить по блюду. Без вступления и заключения: только пункты.';
  }else{
    ex=aiSimilar(r,['look','color','texture','taste']);
    if(ex.length)u+='\nОбразцы органолептики из похожих карт этой организации (для стиля):\n'+ex.map(function(o,i){return'['+(i+1)+'] '+aiDishName(o)+'\n'+AI_ORG.map(function(f){return f[1]+': '+String(o.ttk[f[0]]||'').trim().slice(0,200);}).join('\n');}).join('\n\n')+'\n';
    u+='\nОпиши органолептические показатели готового блюда: внешний вид, цвет, консистенцию, вкус и запах. '+(plain
      ?'Ответь четырьмя строками: «Внешний вид: …», «Цвет: …», «Консистенция: …», «Вкус и запах: …».'
      :'Верни только JSON-объект без пояснений и без markdown с ключами look (внешний вид), color (цвет), texture (консистенция), taste (вкус и запах). Каждое значение — короткая фраза в стиле образцов.');
  }
  return{system:AI_SYS,user:u};
}
function aiCleanSteps(t){
  return String(t||'').replace(/```[a-z]*/gi,'').replace(/\*\*/g,'').split(/\r?\n/).map(function(l){
    return l.replace(/^\s*#+\s*/,'').replace(/^\s*(?:[-–—•*]|\d+(?:\.\d+)*[.)])\s+/,'').trim();
  }).filter(function(l){return l&&!/^(?:4\.2\.?\s*)?технология приготовления:?$/i.test(l)&&!/^(?:конечно|вот\s|ниже\s|надеюсь|если (?:нужно|хотите|потребуется)|могу\s|\*?примечание)/i.test(l);}).join('\n').slice(0,3000);
}
/* ответ обычного чата на органолептику: четыре строки «Внешний вид: …», «Цвет: …», «Консистенция: …», «Вкус и запах: …» */
function aiParsePlain(t){
  var map=[['look',/внешний\s*вид/i],['color',/цвет/i],['texture',/консистенци/i],['taste',/вкус|запах/i]],out={},ok=false;
  String(t||'').replace(/\*\*/g,'').split(/\r?\n/).forEach(function(l){
    var m=/^\s*(?:[-–—•*]|\d+[.)])?\s*([^:：]{3,30})[:：]\s*(.+)$/.exec(l),i;
    if(!m)return;
    for(i=0;i<map.length;i++)if(map[i][1].test(m[1])){if(!out[map[i][0]]){out[map[i][0]]=m[2].replace(/\s+/g,' ').trim().slice(0,300);ok=true;}break;}
  });
  AI_ORG.forEach(function(f){if(!out[f[0]])out[f[0]]='';});
  return ok?out:null;
}
function aiParseOrgano(t){
  t=String(t||'');
  var a=t.indexOf('{'),b=t.lastIndexOf('}'),o,out={},ok=false;
  if(a<0||b<a)return null;
  try{o=JSON.parse(t.slice(a,b+1));}catch(e){return null;}
  if(!o||typeof o!=='object')return null;
  AI_ORG.forEach(function(f){
    var v=o[f[0]];
    if(Array.isArray(v))v=v.join(', ');
    v=String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,300);
    out[f[0]]=v;if(v)ok=true;
  });
  return ok?out:null;
}
function aiRequest(prompt,temp,max){
  if(!aiOn())return Promise.reject({code:'aioff',message:aiOffText()});
  return syPost('ai',{system:prompt.system,user:prompt.user,temp:temp,max:max||1200},syCode(),70);
}
function aiErrText(e){return e&&(e.code==='aiparse'||e.code==='aioff')?e.message:syErrText(e);}
/* результат (по ключу или из чата) сразу ложится в поле карты; прежний текст возвращается одной кнопкой */
function aiApply(k,payload,how){
  var a=aiS(),r=curRecipe(),keys=k==='tech'?['t42']:AI_ORG.map(function(f){return f[0];}),old={},has={};
  if(!r)return;
  keys.forEach(function(key){has[key]=!!(r.ttk&&Object.prototype.hasOwnProperty.call(r.ttk,key));old[key]=has[key]?r.ttk[key]:'';});
  a.undo={k:k,rid:S.active,keys:keys,old:old,has:has,how:how};
  if(k==='tech')setTtk(r,'t42',payload);
  else AI_ORG.forEach(function(f){if(payload[f[0]])setTtk(r,f[0],payload[f[0]]);});
  a.wait=null;a.err='';a.errK='';
  renderAll();
}
function aiUndo(){
  var a=aiS(),u=a.undo,r=curRecipe();
  if(!u||!r||u.rid!==S.active)return;
  u.keys.forEach(function(key){
    if(u.has[key])setTtk(r,key,u.old[key]);
    else if(r.ttk){delete r.ttk[key];queueSave('recipes',S.active);}
  });
  a.undo=null;renderAll();
  flash('Прежний текст возвращён.');
}
function aiGo(k){
  var a=aiS(),r=curRecipe(),rid=S.active;
  if(!r||a.busy)return;
  if(!aiOn()){flash(aiOffText());return;}
  a.busy=k;a.err='';a.errK='';aiPaint();
  aiRequest(aiPrompt(k,false),k==='tech'?0.4:0.2,k==='tech'?1800:600).then(function(res){
    var t,v;
    a.busy='';
    if(rid!==S.active){aiPaint();return;}
    if(k==='tech'){
      t=aiCleanSteps(res.text);
      if(!t)throw{code:'aiparse',message:'ИИ вернул пустой ответ. Нажмите «Предложить с ИИ» ещё раз.'};
      aiApply('tech',t,'ИИ');
    }else{
      v=aiParseOrgano(res.text)||aiParsePlain(res.text);
      if(!v)throw{code:'aiparse',message:'ИИ ответил не в том виде. Нажмите «Предложить с ИИ» ещё раз.'};
      aiApply('organo',v,'ИИ');
    }
  }).catch(function(e){a.busy='';a.err=aiErrText(e);a.errK=k;aiPaint();});
}
/* второй путь без ключа: запрос копируется, чат открывается в новой вкладке, ответ чата вставляется прямо в поле карты (Ctrl+V) */
function aiAsk(k){
  var a=aiS(),r=curRecipe(),c=aiChat(),q,text,w;
  if(!r)return;
  q=aiPrompt(k,true);text=q.system+'\n\n'+q.user;
  try{window.open(c.u,'_blank','noopener');}catch(e){}
  w=a.wait={k:k,rid:S.active,text:text,chat:c.n,copied:null};a.err='';a.errK='';a.undo=null;
  try{navigator.clipboard.writeText(text).then(function(){w.copied=true;aiPaint();},function(){w.copied=false;aiPaint();});}catch(e){w.copied=false;}
  aiPaint();
}
/* ответ чата: true, если разобран и вставлен; quiet — при вставке Ctrl+V в поле, там непонятный текст просто вставляется как обычно */
function aiChatIn(k,text,quiet){
  var a=aiS(),w=a.wait,t,v;
  function bad(m){if(!quiet){a.err=m;a.errK=k;aiPaint();}return false;}
  text=String(text||'').trim();
  if(text.length<10)return bad('В буфере обмена пусто. Скопируйте ответ чата кнопкой «Копировать» под ответом.');
  if(w&&w.text&&text.indexOf(w.text.slice(0,60))===0)return bad('В буфере сам запрос, а не ответ чата. Скопируйте ответ кнопкой «Копировать» под ответом в чате.');
  if(k==='tech'){
    t=aiCleanSteps(text);
    if(t.length<20)return bad('В ответе нет текста технологии. Скопируйте ответ чата целиком.');
    aiApply('tech',t,'чат');
  }else{
    v=aiParseOrgano(text)||aiParsePlain(text);
    if(!v)return bad('Не нашёл в ответе строки «Внешний вид:», «Цвет:», «Консистенция:», «Вкус и запах:». Скопируйте ответ чата целиком.');
    aiApply('organo',v,'чат');
  }
  return true;
}
function aiOnPaste(e){
  var a=S.ai,t=e.target,w,key,txt;
  if(!a||!a.wait||!t||!t.getAttribute||t.getAttribute('data-act')!=='ttf'||uiRO())return;
  w=a.wait;key=t.getAttribute('data-k');
  if(w.rid!==S.active||!(w.k==='tech'?key==='t42':AI_ORG.some(function(f){return f[0]===key;})))return;
  txt=(e.clipboardData&&e.clipboardData.getData('text'))||'';
  if(aiChatIn(w.k,txt,true))e.preventDefault();
}
function aiNoteHtml(k){
  var a=aiS(),w=a.wait,u=a.undo,h='';
  if(a.err&&a.errK===k)h+='<p class="hint cmsg err" role="alert">'+esc(a.err)+'</p>';
  if(w&&w.k===k&&w.rid===S.active)h+='<div class="aiwait" role="status"><p class="hint" style="margin:0 0 8px">'
    +(w.copied===false?'<b>Не удалось скопировать запрос сам.</b> Скопируйте его ниже вручную и вставьте в чат «'+esc(w.chat)+'», он открыт в новой вкладке.'
      :'<b>Запрос скопирован, чат «'+esc(w.chat)+'» открыт в новой вкладке.</b> Вставьте запрос в чат, скопируйте ответ кнопкой «Копировать» и вставьте его сюда, '+(k==='tech'?'в поле 4.2':'в любое поле органолептики')+' (Ctrl+V). Текст приведётся в порядок сам.')
    +'</p>'+(w.copied===false?'<textarea class="prose" rows="4" readonly aria-label="Запрос для чата" onfocus="this.select()">'+esc(w.text)+'</textarea>':'')
    +'<div class="btns"><button class="btn mini" data-act="aiClip" data-k="'+k+'" data-edit>Вставить из буфера обмена</button><button class="btn mini" data-act="aiWaitX" data-k="'+k+'">Отмена</button></div></div>';
  if(u&&u.k===k&&u.rid===S.active)h+='<p class="hint cmsg ok" role="status">Текст вставлен ('+u.how+'). Проверьте режимы, температуры и сроки. <button class="btn mini" data-act="aiUndo" data-k="'+k+'" data-edit>Вернуть прежний</button></p>';
  return h;
}
function aiBarHtml(k){
  var a=aiS(),h='<div class="aibar" id="ai-'+k+'"><div class="btns">';
  if(aiRole())h+='<button class="btn mini" data-act="aiGo" data-k="'+k+'" data-edit'+(a.busy?' disabled':'')+'>'+(a.busy===k?'ИИ думает…':'Предложить с ИИ')+'</button>';
  h+='<button class="btn mini" data-act="aiAsk" data-k="'+k+'" title="Скопировать запрос и открыть чат в новой вкладке">Спросить в чате</button>'
    +'<select class="aisel" data-act="aiChatSel" aria-label="Какой чат открыть">'+AI_CHATS.map(function(c){return'<option value="'+c.id+'"'+(c.id===aiChat().id?' selected':'')+'>'+esc(c.n)+'</option>';}).join('')+'</select></div>';
  h+='<p class="hint">'+(aiOn()?'«Предложить с ИИ» вставит текст в поле сразу. Название и состав блюда отправятся '+aiNow().to+'.'
    :(aiRole()?esc(aiOffText())+' ':'')+'«Спросить в чате» работает без настройки: запрос копируется, чат открывается, ответ вставляется в поле.')+'</p>';
  return h+aiNoteHtml(k)+'</div>';
}
function aiPaint(){
  ['tech','organo'].forEach(function(k){var el=$('#ai-'+k);if(el)el.outerHTML=aiBarHtml(k);});
  if(uiRO())$$('#view .aibar [data-edit]').forEach(function(el){el.disabled=true;});
}
/* правка поля вручную после вставки: «Вернуть прежний» уже не нужна, чтобы не затереть вашу правку */
function aiInput(act,t){
  var u=S.ai&&S.ai.undo;
  if(act==='ttf'&&u&&u.keys.indexOf(t.getAttribute('data-k'))>-1){S.ai.undo=null;aiPaint();}
  return false;
}
/* настройка ключа (технолог): вкладка «Личный кабинет» */
function aiLoad(){
  var i=S.sy.info;
  if(!(syLinked()&&syAdmin()&&i&&(Number(i.v)||0)>=18))return Promise.resolve();
  return syGet({a:'aiinfo'}).then(function(d){var a=aiS();a.cfg=d;a.sel=a.sel||d.prov;i.ai=d.ready?1:0;i.aip=d.prov;aiBoxPaint(true);},function(){});
}
/* keep: перерисовка не от действия человека (пришли данные с сервера): набранное в полях не теряем */
function aiBoxPaint(keep){
  var el=$('#aiBox'),ids=['ai-key','ai-model','ai-url','ai-scope'],v={},f=document.activeElement&&document.activeElement.id,x;
  if(!el)return;
  if(keep)ids.forEach(function(id){x=$('#'+id);if(x&&x.value)v[id]=x.value;});
  el.outerHTML=syAiHtml();
  if(keep){ids.forEach(function(id){x=$('#'+id);if(x&&v[id]!==undefined)x.value=v[id];});if(f&&ids.indexOf(f)>-1&&$('#'+f))$('#'+f).focus();}
}
function syAiHtml(){
  if(!(S.mode==='local'&&syLinked()&&syAdmin()))return'';
  var a=aiS(),c=a.cfg||{},i=S.sy.info||{},on=!!i.ai,sel=a.sel||c.prov||'openrouter',pv=aiPv(sel),cur=sel===(c.prov||'openrouter'),hasKey=!!(c.keys&&c.keys[sel]),md=cur?(c.model||pv.m):'';
  function opt(v,l,cv){return'<option value="'+v+'"'+(cv===v?' selected':'')+'>'+esc(l)+'</option>';}
  var h='<section class="card" id="aiBox"><h2>ИИ-помощник</h2>'
    +'<p class="hint" style="margin-top:0">Предлагает черновик технологии (п. 4.2) и органолептики (п. 6.1) в карте ТТК. Запрос уходит из скрипта в выбранный ИИ-сервис: в него попадают название блюда, состав и образцы из ваших ТТК. Ключ хранится только в скрипте. Помощник доступен технологу и редактору.</p>';
  if((Number(i.v)||0)<18)return h+'<p class="hint cmsg warn">В таблице стоит скрипт версии '+esc(String(i.v||'?'))+'. Для помощника нужна версия 18: вставьте новый скрипт («Настройка скрипта») и создайте новую версию развёртывания. Затем один раз запустите в редакторе функцию aiSetup и разрешите доступ к внешним адресам.</p></section>';
  h+='<p class="hint cmsg '+(on?'ok':'warn')+'">'+(on?'Помощник включён: '+esc(aiPv(c.prov||'openrouter').n)+(c.model?', модель '+esc(c.model):'')+'.':'Помощник выключен: для выбранного сервиса нет ключа.')+'</p>'
    +'<div class="fgrid"><label class="field w180"><span class="lbl">ИИ-сервис</span><select id="ai-prov" data-act="aiProv">'+['openrouter','groq','mistral','deepseek','giga','custom'].map(function(k){return opt(k,AI_PV[k].n+(c.keys&&c.keys[k]?' ✓':''),sel);}).join('')+'</select></label>'
    +'<label class="field grow"><span class="lbl">Ключ</span><input type="password" id="ai-key" autocomplete="off" spellcheck="false" placeholder="'+(hasKey?'Ключ сохранён. Чтобы заменить, вставьте новый':'Вставьте ключ')+'"></label></div>';
  if(sel==='giga'){
    h+='<div class="fgrid"><label class="field w180"><span class="lbl">Тип доступа</span><select id="ai-scope">'+opt('GIGACHAT_API_PERS','Физлицо',c.scope||'GIGACHAT_API_PERS')+opt('GIGACHAT_API_B2B','ИП и юрлицо (пакеты)',c.scope)+opt('GIGACHAT_API_CORP','Юрлицо (постоплата)',c.scope)+'</select></label>'
      +'<label class="field w150"><span class="lbl">Модель</span><select id="ai-model">'+opt('GigaChat-2','GigaChat 2 (Lite)',md||'GigaChat-2')+opt('GigaChat-2-Pro','GigaChat 2 Pro',md)+opt('GigaChat-2-Max','GigaChat 2 Max',md)+'</select></label></div>';
  }else{
    if(sel==='custom')h+='<div class="fgrid"><label class="field grow"><span class="lbl">Адрес сервиса</span><input type="text" id="ai-url" autocomplete="off" spellcheck="false" placeholder="https://api.example.com/v1/chat/completions" value="'+esc(c.url||'')+'"></label></div>';
    h+='<div class="fgrid"><label class="field grow"><span class="lbl">Модель</span><input type="text" id="ai-model" list="ai-mlist" autocomplete="off" spellcheck="false" placeholder="'+esc(pv.m||'название модели')+'" value="'+esc(md)+'"><datalist id="ai-mlist">'+(a.models||[]).map(function(m){return'<option value="'+esc(m.id)+'">'+esc(m.name)+'</option>';}).join('')+'</datalist></label></div>';
  }
  h+='<div class="btns"><button class="btn primary" data-act="aiKeySave">Сохранить и включить</button><button class="btn" data-act="aiTest"'+(on?'':' disabled')+'>Проверить ИИ</button>'
    +(sel==='openrouter'?'<button class="btn" data-act="aiModels">Список бесплатных моделей</button>':'')
    +(hasKey?'<button class="btn danger" data-act="aiKeyDel">Убрать ключ</button>':'')+'</div>';
  if(sel==='giga')h+='<label class="trem"><input type="checkbox" data-act="aiLax"'+(c.lax?' checked':'')+'>Не проверять сертификат Сбера (включайте, только если «Проверить ИИ» пишет про сертификат)</label>';
  h+=syMsgHtml('ai')+'<details class="pgroup"><summary>Как получить ключ: '+esc(pv.n)+'</summary><p class="hint">'+pv.how+'</p></details></section>';
  return h;
}
function aiSaved(res,msg){
  var a=aiS();
  if(res&&res.ai){a.cfg=res.ai;a.sel=res.ai.prov;if(S.sy.info){S.sy.info.ai=res.ai.ready?1:0;S.sy.info.aip=res.ai.prov;}}
  syMsg('ai','ok',msg);aiBoxPaint();aiPaint();
}
function aiClick(act,b){
  var k=b.getAttribute('data-k');
  switch(act){
    case'aiGo':aiGo(k);return true;
    case'aiAsk':aiAsk(k);return true;
    case'aiUndo':aiUndo();return true;
    case'aiWaitX':aiS().wait=null;aiS().err='';aiPaint();return true;
    case'aiClip':
      try{navigator.clipboard.readText().then(function(t){aiChatIn(k,t,false);},function(){flash('Браузер не разрешил читать буфер обмена. Вставьте ответ в поле карты сочетанием Ctrl+V.');});}
      catch(e){flash('Браузер не разрешил читать буфер обмена. Вставьте ответ в поле карты сочетанием Ctrl+V.');}
      return true;
    case'aiKeySave':
      var a=aiS(),c=a.cfg||{},sel=($('#ai-prov')||{}).value||'openrouter',key=(($('#ai-key')||{}).value||'').trim(),x={prov:sel},had=!!(c.keys&&c.keys[sel]),md=(($('#ai-model')||{}).value||'').trim();
      if(!key&&!had){syMsg('ai','err','Вставьте ключ.');return true;}
      if(key)x.key=key;
      if(sel==='giga'){x.scope=$('#ai-scope').value;x.model=md||'GigaChat-2';}
      else if(sel==='custom'){x.url=(($('#ai-url')||{}).value||'').trim();x.model=md;if(!x.url){syMsg('ai','err','Укажите адрес сервиса.');return true;}if(!md){syMsg('ai','err','Укажите название модели.');return true;}}
      else if(sel===(c.prov||'openrouter')||md)x.model=md;
      syMsg('ai','busy','Сохраняю…');
      syPost('aikey',x,syCode()).then(function(res){aiSaved(res,'Сохранено, помощник включён. Нажмите «Проверить ИИ».');},function(e){syMsg('ai','err',syErrText(e));});
      return true;
    case'aiKeyDel':
      arm(b,'Убрать ключ?',function(){
        var sel=($('#ai-prov')||{}).value||'openrouter';
        syPost('aikey',{prov:sel,clear:true},syCode()).then(function(res){aiSaved(res,'Ключ убран.');},function(e){syMsg('ai','err',syErrText(e));});
      });
      return true;
    case'aiModels':
      syMsg('ai','busy','Загружаю список…');
      syGet({a:'aimodels'}).then(function(d){
        if(!d||!d.ok)throw d||{};
        aiS().models=d.models||[];
        var dl=$('#ai-mlist');if(dl)dl.innerHTML=aiS().models.map(function(m){return'<option value="'+esc(m.id)+'">'+esc(m.name)+'</option>';}).join('');
        syMsg('ai','ok','Бесплатных моделей: '+aiS().models.length+'. Нажмите на поле «Модель» и выберите одну (сверху те, что читают длинные запросы).');
      }).catch(function(e){syMsg('ai','err',syErrText(e));});
      return true;
    case'aiTest':
      syMsg('ai','busy','Проверяю ИИ…');
      aiRequest({system:'',user:'Ответь одним словом: готово.'},0,60).then(function(res){syMsg('ai','ok','ИИ отвечает: «'+String(res.text||'').trim().slice(0,60)+'». Модель: '+(res.model||'—')+'.');},function(e){
        syMsg('ai','err',aiErrText(e)+(e&&e.err==='tls'&&aiS().sel==='giga'?' Отметьте галочку ниже и проверьте снова.':''));
      });
      return true;
  }
  return false;
}
function aiChange(act,t){
  if(act==='aiChatSel'){aiS().chat=t.value;lsSet('kbzhu:aichat',t.value);aiPaint();return true;}
  if(act==='aiProv'){aiS().sel=t.value;syMsg('ai','','');aiBoxPaint();return true;}
  if(act!=='aiLax')return false;
  syMsg('ai','busy','Сохраняю…');
  syPost('aikey',{lax:!!t.checked},syCode()).then(function(res){aiSaved(res,t.checked?'Сертификат Сбера не проверяется. Нажмите «Проверить ИИ».':'Сертификат Сбера проверяется.');},function(e){syMsg('ai','err',syErrText(e));});
  return true;
}

