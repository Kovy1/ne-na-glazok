/* Массовое обновление разделов ТТК региона: технология, подача, срок хранения.
   Сначала предпросмотр «было → станет» по каждой ТТК, снять можно любую; применение идёт обычными правками (черновики/проверка по роли); последнее применение можно отменить. */
var TB_KEYS=[['t42','4.2. Технология приготовления'],['t41','4.1. Предварительная подготовка'],['s51','5.1. Оформление и подача'],['s52','5.2. Температура подачи'],['s53','5.3. Доставка'],['s54','5.4. Срок хранения']];
var TB_MODES=[['all','Заменить текст целиком'],['find','Заменить фрагмент'],['add','Добавить в конец (новые пункты)'],['addb','Добавить в начало']];
function tb(){if(!S.tb)S.tb={k:'s54',mode:'all',text:'',find:'',repl:'',ex:{},arch:false,undo:null,open:false};return S.tb;}
function tbOn(){return!uiRO()&&!guestOn()&&!syMgr();}
function tbLabel(k){for(var i=0;i<TB_KEYS.length;i++)if(TB_KEYS[i][0]===k)return TB_KEYS[i][1];return k;}
/* новый текст раздела для одной ТТК или null, если менять нечего */
function tbNew(r,s){
  var cur=String(ttkVal(r,s.k)==null?'':ttkVal(r,s.k)),t=String(s.text||'').replace(/\s+$/,'').replace(/^\s+/,''),n;
  if(s.mode==='all'){if(!t)return null;n=t;}
  else if(s.mode==='find'){if(!s.find||cur.indexOf(s.find)<0)return null;n=cur.split(s.find).join(s.repl||'');}
  else if(s.mode==='add'){if(!t)return null;if(cur.trim()&&cur.replace(/\s+$/,'').slice(-t.length)===t)return null;n=cur.trim()?cur.replace(/\s+$/,'')+'\n'+t:t;}
  else if(s.mode==='addb'){if(!t)return null;if(cur.replace(/^\s+/,'').slice(0,t.length)===t)return null;n=cur.trim()?t+'\n'+cur.replace(/^\s+/,''):t;}
  else return null;
  return n===cur?null:n;
}
function tbList(){
  var s=tb();
  return visIds().filter(function(id){return s.arch||!S.recipes[id].arch;}).map(function(id){var r=S.recipes[id];return{id:id,r:r,cur:String(ttkVal(r,s.k)==null?'':ttkVal(r,s.k)),nw:tbNew(r,s)};});
}
function tbCut(t,n){t=String(t).replace(/\s+/g,' ').trim();return t?(t.length>n?t.slice(0,n)+'…':t):'пусто';}
function tbPrevHtml(){
  var s=tb(),l=tbList(),ch=l.filter(function(x){return x.nw!==null;}),sel=ch.filter(function(x){return!s.ex[x.id];}),h;
  var ready=s.mode==='find'?!!s.find:!!String(s.text||'').trim();
  if(!ready)return'<p class="hint" role="status">Введите текст — ниже появится список ТТК, которые изменятся.</p>';
  h='<p class="hint" role="status"><b>Изменится: '+sel.length+' из '+l.length+'</b> '+plural(l.length,['ТТК','ТТК','ТТК'])+' региона «'+esc(regionName(curRegion()))+'»'+(ch.length-sel.length?' · снято вручную: '+(ch.length-sel.length):'')+(l.length-ch.length?' · без изменений: '+(l.length-ch.length)+(s.mode==='find'?' (фрагмент не найден)':' (уже так)'):'')+'.</p>';
  if(ch.length){
    h+='<div class="tbtab"><table><thead><tr><th></th><th>ТТК</th><th>Было</th><th>Станет</th></tr></thead><tbody>'+ch.slice(0,200).map(function(x){
      var num=ttkVal(x.r,'num');
      return'<tr><td><input type="checkbox" data-act="tbEx" data-id="'+esc(x.id)+'" aria-label="Изменить эту ТТК"'+(s.ex[x.id]?'':' checked')+'></td><td><b>'+esc(x.r.name||'Без названия')+'</b>'+(num?'<small>ТТК №'+esc(num)+'</small>':'')+'</td><td>'+esc(tbCut(x.cur,140))+'</td><td>'+esc(tbCut(x.nw,140))+'</td></tr>';
    }).join('')+'</tbody></table></div>'+(ch.length>200?'<p class="hint">Показаны первые 200 из '+ch.length+'; применятся все отмеченные.</p>':'');
  }
  h+='<div class="btns" style="margin-top:10px"><button class="btn primary" data-act="tbGo" data-edit'+(sel.length?'':' disabled')+'>Применить к '+sel.length+' ТТК</button>'
    +'<button class="btn" data-act="tbUndo" data-edit'+(s.undo?'':' hidden')+'>Отменить последнее применение'+(s.undo?' ('+s.undo.n+')':'')+'</button></div>';
  return h;
}
function tbHtml(){
  if(!tbOn())return'';
  var s=tb(),hint=(s.k==='t42'||s.k==='t41')?'Каждая строка — отдельный пункт: номера 4.2.1, 4.2.2… проставятся сами, пунктов может быть сколько нужно. ':'';
  var f=s.mode==='find'
    ?'<div class="fgrid"><label class="field grow"><span class="lbl">Найти (точно, с учётом регистра)</span><input type="text" data-act="tbF" data-k="find" value="'+esc(s.find)+'" autocomplete="off" spellcheck="false"></label>'
     +'<label class="field grow"><span class="lbl">Заменить на (пусто — удалить)</span><input type="text" data-act="tbF" data-k="repl" value="'+esc(s.repl)+'" autocomplete="off" spellcheck="false"></label></div>'
    :'<label class="field"><span class="lbl">'+(s.mode==='all'?'Новый текст раздела':'Текст для добавления')+'</span><textarea class="prose" rows="4" data-act="tbF" data-k="text">'+esc(s.text)+'</textarea></label>';
  return'<details class="pgroup" id="tbBox"'+(s.open?' open':'')+'><summary>Массовое обновление разделов ТТК</summary>'
    +'<p class="hint" style="margin:8px 0">Меняет один раздел сразу во всех ТТК региона «'+esc(regionName(curRegion()))+'». '+hint+'<code>{блюдо}</code> подставит название блюда. Перед применением виден список «было → станет».</p>'
    +'<div class="fgrid"><label class="field grow"><span class="lbl">Раздел</span><select data-act="tbF" data-k="k" data-full="1">'+TB_KEYS.map(function(x){return'<option value="'+x[0]+'"'+(x[0]===s.k?' selected':'')+'>'+esc(x[1])+'</option>';}).join('')+'</select></label>'
    +'<label class="field grow"><span class="lbl">Как менять</span><select data-act="tbF" data-k="mode" data-full="1">'+TB_MODES.map(function(x){return'<option value="'+x[0]+'"'+(x[0]===s.mode?' selected':'')+'>'+esc(x[1])+'</option>';}).join('')+'</select></label></div>'
    +f+'<label class="chkl"><input type="checkbox" data-act="tbF" data-k="arch" data-full="1"'+(s.arch?' checked':'')+'> Включая ТТК из архива</label>'
    +'<div id="tbPrev">'+tbPrevHtml()+'</div></details>';
}
function tbPaint(full){
  var b=$('#tbBox'),p=$('#tbPrev');
  if(full&&b){b.outerHTML=tbHtml();return;}
  if(p)p.innerHTML=tbPrevHtml();
}
function tbInput(act,t){
  if(act!=='tbF')return false;
  var s=tb(),k=t.getAttribute('data-k');
  s[k]=t.type==='checkbox'?t.checked:t.value;
  if(k==='k'||k==='mode')s.ex={};
  tbPaint(!!t.getAttribute('data-full'));
  return true;
}
function tbChange(act,t){
  if(act==='tbEx'){var s=tb(),id=t.getAttribute('data-id');if(t.checked)delete s.ex[id];else s.ex[id]=1;tbPaint(false);return true;}
  /* у текстовых полей change приходит при уходе фокуса: перерисовка списка съела бы нажатие на «Применить» */
  if(act==='tbF'){if(t.tagName==='SELECT'||t.type==='checkbox')tbInput(act,t);return true;}
  return false;
}
function tbClick(act,b){
  var s,l;
  if(act==='tbGo'){
    s=tb();l=tbList().filter(function(x){return x.nw!==null&&!s.ex[x.id];});
    if(!l.length){flash('Нечего менять');return true;}
    arm(b,'Изменить '+l.length+' ТТК?',function(){
      var u=[];
      l.forEach(function(x){
        var r=S.recipes[x.id],had=!!(r.ttk&&Object.prototype.hasOwnProperty.call(r.ttk,s.k));
        u.push({id:x.id,k:s.k,had:had,old:had?r.ttk[s.k]:undefined});
        if(!r.ttk)r.ttk={};r.ttk[s.k]=x.nw;queueSave('recipes',x.id);
      });
      s.undo={n:u.length,k:s.k,list:u};s.ex={};
      renderAll();flash('Обновлено ТТК: '+u.length+' · раздел «'+tbLabel(s.k)+'»');
    });
    return true;
  }
  if(act==='tbUndo'){
    s=tb();if(!s.undo)return true;
    arm(b,'Отменить для '+s.undo.n+' ТТК?',function(){
      s.undo.list.forEach(function(u){
        var r=S.recipes[u.id];if(!r)return;
        if(u.had){if(!r.ttk)r.ttk={};r.ttk[u.k]=u.old;}else if(r.ttk)delete r.ttk[u.k];
        queueSave('recipes',u.id);
      });
      var n=s.undo.n;s.undo=null;renderAll();flash('Возвращено прежнее: '+n+' ТТК');
    });
    return true;
  }
  return false;
}
