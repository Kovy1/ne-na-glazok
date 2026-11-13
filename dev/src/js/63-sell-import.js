/* ----- загрузка цен продажи блюд из файла (прейскурант: наименование блюда, единица, стоимость) -----
   В файле может быть больше блюд, чем заведено в приложении: найденные блюда обновляются после просмотра «было → стало»,
   ненайденные и неоднозначные показываются списком и ничем не заменяются. Цены пишутся в регион, выбранный вверху. */
function sxNorm(s){
  var t=String(s==null?'':s).toLowerCase().replace(/ё/g,'е').replace(/[   ]/g,' ');
  t=t.replace(/(\d),(\d)/g,'$1.$2').replace(/(\d)\s*(?:гр|г)\.?(?![а-яa-z])/g,'$1г').replace(/(\d)\s*(?:мл)\.?(?![а-яa-z])/g,'$1мл');
  return t.replace(/[^a-zа-я0-9\/.]/g,'').replace(/\.+$/,'');
}
/* вес порции из названия: «250г», «250/10г», «125/17,5г» → {w:'250/10',a:250}; без массы — null */
function sxWeight(name){
  var m=/(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)*)\s*(?:гр|г|мл)(?![а-яa-z])\.?/i.exec(String(name||'').replace(/ /g,' '));
  if(!m)return null;
  var w=m[1].replace(/\s+/g,'').replace(/,/g,'.');
  return{w:w,a:Number(w.split('/')[0]),at:m.index,len:m[0].length};
}
function sxBase(name){
  var wt=sxWeight(name),s=String(name||'');
  if(wt)s=s.slice(0,wt.at)+' '+s.slice(wt.at+wt.len);
  return sxNorm(s);
}
/* строки таблицы → позиции прейскуранта */
function sxParse(rows){
  var hi=-1,cn=-1,cu=-1,cp=-1,i,j,date='',sec='',items=[],skipped=0;
  for(i=0;i<rows.length&&i<40;i++){
    var r=rows[i]||[],a=-1,b=-1,u=-1;
    for(j=0;j<r.length;j++){
      var t=c1Str(r[j]).toLowerCase();
      if(a<0&&/наименован|блюд/.test(t))a=j;
      else if(b<0&&/стоимост|цена|прайс/.test(t))b=j;
      else if(u<0&&/едини|ед\.?\s*изм/.test(t))u=j;
    }
    if(a>=0&&b>=0){hi=i;cn=a;cp=b;cu=u;break;}
    var d=/\bс\s+(\d{1,2}\.\d{1,2}\.\d{4})/i.exec(r.map(c1Str).join(' '));
    if(d&&!date)date=d[1];
  }
  if(hi<0)return{err:'В файле не нашёл колонки «Наименование» и «Стоимость» (или «Цена»).'};
  for(i=hi+1;i<rows.length;i++){
    var q=rows[i]||[],nm=c1Str(q[cn]),pv=c1Num(q[cp]);
    if(!nm)continue;
    if(pv===null||pv===undefined||!(pv>0)){
      if(q.filter(function(x){return c1Str(x);}).length<=2&&/^[^a-zа-я]*[A-ZА-ЯЁ\s,.\-]+$/.test(nm))sec=nm;
      else skipped++;
      continue;
    }
    items.push({name:nm,unit:cu>=0?c1Str(q[cu]):'',price:Math.round(pv*100)/100,sec:sec,row:i+1});
  }
  return{items:items,date:date,skipped:skipped};
}
/* название блюда в приложении: без «(ТТК №…)»; порция — из названия или из поля «Порция в названии» карты */
function sxAppName(r){
  return String(r.name||'').replace(/\s*\(\s*ттк[^)]*\)?/ig,' ').replace(/\s*ттк\s*№?\s*\d+.*$/i,' ').replace(/\s+/g,' ').trim();
}
function sxApp(id){
  var r=S.recipes[id],nm=sxAppName(r),wt=sxWeight(nm)||(r.ttk&&r.ttk.portion?sxWeight(r.ttk.portion):null);
  return{id:id,r:r,name:nm,full:sxNorm(nm),base:sxBase(nm),wt:wt,out:Number(r.output)||0,words:sxWords(nm)};
}
function sxWords(name){
  var wt=sxWeight(name),s=String(name||'').toLowerCase().replace(/ё/g,'е');
  if(wt)s=s.slice(0,wt.at)+' '+s.slice(wt.at+wt.len);
  return s.replace(/[^a-zа-я0-9]+/g,' ').trim().split(' ').filter(function(w){return w&&!/^\d+$/.test(w)&&!/^(?:с|со|и|из|на|в|по|к|б|для|без|от)$/.test(w);});
}
/* насколько порция блюда в приложении подходит к порции из файла: 4 точно, 3 по первой массе или выходу, 1 данных нет, 0 другая порция */
function sxWScore(wt,a){
  if(!wt)return 1;
  if(a.wt&&a.wt.w===wt.w)return 4;
  var parts=wt.w.split('/').map(Number),tot=0,i;
  for(i=0;i<parts.length;i++)tot+=parts[i];
  if(a.wt&&a.wt.a===wt.a&&(wt.w.indexOf('/')<0||a.wt.w.indexOf('/')<0||a.wt.w.split('/')[0]===parts[0]+''))return 3;
  if(a.out>0){
    var hit=[wt.a,tot,parts[parts.length-1]].some(function(x){return Math.abs(a.out-x)<0.51;});
    if(hit)return 3;
  }
  if(a.wt)return 0;
  return a.out>0?0:1;
}
/* все слова короткого названия есть в длинном (не меньше двух слов) */
function sxSimilar(wa,wb){
  var sh=wa.length<=wb.length?wa:wb,lg=sh===wa?wb:wa,n=0;
  if(sh.length<2)return false;
  sh.forEach(function(w){if(lg.indexOf(w)>-1)n++;});
  return n===sh.length||(sh.length>=3&&n/sh.length>=0.75&&n/lg.length>=0.6);
}
function sxNear(wd,apps){
  var best=[],sc=[];
  apps.forEach(function(a){
    var n=0;wd.forEach(function(w){if(a.words.indexOf(w)>-1)n++;});
    if(n>0&&n/Math.max(wd.length,a.words.length)>=0.4)sc.push({n:n/Math.max(wd.length,a.words.length),name:a.name});
  });
  sc.sort(function(x,y){return y.n-x.n;});
  sc.slice(0,2).forEach(function(x){best.push(x.name);});
  return best;
}
/* сопоставление с блюдами выбранного региона */
function sxMatch(items,g,pt){
  var ids=visIds().filter(function(id){return!S.recipes[id].arch;}),apps=ids.map(sxApp),exact=Object.create(null),byBase=Object.create(null),fileBase=Object.create(null);
  apps.forEach(function(a){(exact[a.full]=exact[a.full]||[]).push(a);(byBase[a.base]=byBase[a.base]||[]).push(a);});
  items.forEach(function(it){var b=sxBase(it.name);fileBase[b]=(fileBase[b]||0)+1;});
  var res={upd:[],same:[],miss:[],amb:[],dup:[],sim:[],apps:apps.length},props=[];
  items.forEach(function(it,ix){
    var k=sxNorm(it.name),b=sxBase(it.name),wt=sxWeight(it.name),c=exact[k]||[],how='name',sc=5,weak=false;
    if(c.length!==1){
      var cand=c.length>1?c:(byBase[b]||[]).slice();
      how='base';
      if(cand.length){
        var scored=cand.map(function(a){return{a:a,s:sxWScore(wt,a)};}),mx=Math.max.apply(null,scored.map(function(x){return x.s;}));
        if(mx>=2||(mx===1&&scored.length===1)){
          cand=scored.filter(function(x){return x.s===mx;}).map(function(x){return x.a;});sc=mx;
        }else if(scored.length===1&&fileBase[b]===1){cand=[scored[0].a];sc=0;weak=true;}   // в файле у блюда одна порция: берём, но предупреждаем
        else{
          it.why='порция в приложении другая';it.near=[];
          scored.slice(0,2).forEach(function(x){it.near.push(x.a.name+(x.a.out?' · выход '+x.a.out+' г':''));});
          res.miss.push(it);return;
        }
        c=cand;
      }else{
        var wd=sxWords(it.name),sm=wt?apps.filter(function(a){return sxSimilar(wd,a.words)&&sxWScore(wt,a)>0;}):apps.filter(function(a){return sxSimilar(wd,a.words);});
        if(sm.length===1){props.push({it:it,ix:ix,a:sm[0],sc:0,how:'sim'});return;}
        it.near=sxNear(wd,apps);res.miss.push(it);return;
      }
    }
    if(c.length===0){res.miss.push(it);return;}
    if(c.length>1){it.cands=c.map(function(a){return a.name;});res.amb.push(it);return;}
    props.push({it:it,ix:ix,a:c[0],sc:sc,how:how,weak:weak});
  });
  /* одно блюдо приложения — одна позиция файла: берётся самая подходящая по порции */
  var bestFor={};
  props.forEach(function(p){var o=bestFor[p.a.id];if(!o||p.sc>o.sc)bestFor[p.a.id]=p;});
  props.forEach(function(p){
    if(bestFor[p.a.id]!==p){p.it.why='другая порция того же блюда';res.dup.push(p.it);return;}
    var rr=p.a.r,own=pt?(rr.sell&&rr.sell[g+':'+pt]>0?rr.sell[g+':'+pt]:null):null,
      old=own!==null?own:sellOf(rr,g),e={id:p.a.id,name:rr.name,file:p.it.name,price:p.it.price,old:old,own:own!==null,how:p.how,weak:!!p.weak,sec:p.it.sec,k:p.ix};
    if(p.how==='sim')res.sim.push(e);
    else if(old!==null&&Math.abs(old-p.it.price)<0.005)res.same.push(e);else res.upd.push(e);
  });
  /* есть ли пропущенные в архиве или в другом регионе */
  var hid=0;
  if(res.miss.length){
    var vis={};ids.forEach(function(i){vis[i]=1;});
    var hb=Object.create(null);
    Object.keys(S.recipes).forEach(function(i){if(!vis[i]){var a=sxApp(i);hb[a.base]=1;}});
    res.miss.forEach(function(it){if(hb[sxBase(it.name)])hid++;});
  }
  res.hidden=hid;
  return res;
}
function sxStart(rows,fname){
  var p=sxParse(rows);
  if(p.err){flash(p.err);return;}
  if(!p.items.length){flash('В файле нет строк с ценой.');return;}
  var g=curRegion(),pt=(typeof drCurPtId==='function')?drCurPtId():'';
  S.sx={name:fname,date:p.date,g:g,pt:pt,items:p.items,m:sxMatch(p.items,g,pt),n:p.items.length,skipped:p.skipped,only:false};
  S.tab='menu';renderAll();window.scrollTo(0,0);
}
function sxOnFile(file){
  if(!file)return;
  var ext=((/\.([a-z0-9]+)$/i.exec(file.name)||[])[1]||'').toLowerCase();
  function bad(){flash('Не удалось разобрать файл. Нужен прейскурант .xlsx, .ods или .csv: наименование блюда, единица, стоимость.');}
  function done(rows){if(!rows||!rows.length){bad();return;}sxStart(rows,file.name);}
  if(ext==='xlsx'||ext==='xlsm'){
    if(typeof DecompressionStream==='undefined'){flash('Этот браузер не открывает .xlsx. Нужен современный Chrome, Edge, Firefox или Safari.');return;}
    var fr=new FileReader();
    fr.onerror=bad;
    fr.onload=function(){
      var buf=fr.result;
      Promise.all([unzipEntry(buf,'xl/sharedStrings.xml'),unzipEntry(buf,'xl/styles.xml'),c1Sheet(buf)]).then(function(r){
        var dec=new TextDecoder('utf-8');
        if(!r[2])throw new Error('nosheet');
        done(xlRows(dec.decode(r[2]),xlShared(r[0]?dec.decode(r[0]):''),xlDateStyles(r[1]?dec.decode(r[1]):'')));
      })['catch'](bad);
    };
    fr.readAsArrayBuffer(file);
  }else if(ext==='ods'){
    var fr2=new FileReader();
    fr2.onerror=bad;
    fr2.onload=function(){unzipEntry(fr2.result,'content.xml').then(function(u8){if(!u8)throw new Error('nodoc');done(odtRows(new TextDecoder('utf-8').decode(u8)));})['catch'](bad);};
    fr2.readAsArrayBuffer(file);
  }else if(ext==='csv'||ext==='tsv'||ext==='txt'){
    readTextFile(file,function(err,text){if(err){bad();return;}done(c1Rows(text));});
  }else if(ext==='xls')flash('Старый формат .xls не читается. Сохраните файл как .xlsx и загрузите снова.');
  else flash('Нужен файл .xlsx, .ods или .csv с прейскурантом.');
}
function sxChanges(){
  var x=S.sx;
  if(!x)return[];
  var sel=x.simOn||{};
  return x.m.upd.concat(x.m.sim.filter(function(e){return sel[e.k];})).filter(function(e){return!x.only||e.old===null;});
}
function sxApply(){
  var x=S.sx;if(!x)return;
  if(uiRO()){roFlash();return;}
  if(NOPRICE){flash('Для вашего доступа цены продажи менять нельзя.');return;}
  var list=sxChanges(),n=0;
  if(x.g!==curRegion()){flash('Регион изменился: загрузите файл заново.');S.sx=null;renderAll();return;}
  list.forEach(function(e){var r=S.recipes[e.id];if(!r)return;setSell(r,x.pt?x.g+':'+x.pt:x.g,e.price);queueSave('recipes',e.id);n++;});
  S.sx=null;
  flash(n?'Цены продажи обновлены: '+n+' · '+(x.pt?regionName(x.g+':'+x.pt):'регион «'+regionName(x.g)+'»'):'Нечего обновлять');
  renderAll();
}
function sxListHtml(arr,rowFn,title,open){
  if(!arr.length)return'';
  return'<details class="pgroup"'+(open?' open':'')+'><summary>'+title+' · '+arr.length+'</summary><div class="sxlist">'+arr.map(rowFn).join('')+'</div></details>';
}
function sxTargetHtml(){
  var x=S.sx,pts=(typeof drOk==='function'&&drOk()&&S.dr.ld)?S.dr.pts.filter(function(p){return p.active!==false&&p.region===x.g;}):[];
  return'<label class="field" style="max-width:420px;margin-bottom:8px"><span class="lbl">Куда записать цены</span><select data-act="sxTarget"><option value="">Весь регион «'+esc(regionName(x.g))+'»</option>'
    +pts.map(function(p){return'<option value="'+esc(p.id)+'"'+(x.pt===p.id?' selected':'')+'>Только точка «'+esc(p.name)+'»</option>';}).join('')+'</select></label>'
    +(x.pt?'<p class="hint" style="margin:0 0 8px">У блюд точки появится своя цена; у остальных точек региона цены не меняются. Если у блюда нет своей цены точки, берётся цена региона.</p>':(pts.length?'<p class="hint" style="margin:0 0 8px">Цена региона действует для всех точек, у которых нет своей цены.</p>':''))
    +(regionList().length>1?'<p class="hint" style="margin:0 0 8px">Другой регион выбирается вверху, затем загрузите файл снова.</p>':'');
}
function sxCardHtml(){
  var x=S.sx;if(!x)return'';
  var m=x.m,ch=sxChanges(),newN=m.upd.filter(function(e){return e.old===null;}).length,
    h='<section class="card sxcard" id="sxCard"><h2>Цены продажи из файла</h2>'
    +'<p class="hint" style="margin:0 0 8px">Файл «'+esc(x.name)+'»'+(x.date?', прейскурант с '+esc(x.date):'')+'. В файле позиций: '+x.n+'. Блюд в приложении ('+esc(x.pt?regionName(x.g+':'+x.pt):regionName(x.g))+', без архива): '+m.apps+'.</p>'
    +sxTargetHtml()
    +'<div class="chips"><span class="tstat ok">Обновится: '+m.upd.length+'</span><span class="tstat">Без изменений: '+m.same.length+'</span><span class="tstat warn">Нет в приложении: '+m.miss.length+'</span>'+(m.sim.length?'<span class="tstat">Похожие: '+m.sim.length+'</span>':'')+(m.amb.length?'<span class="tstat bad">Неоднозначно: '+m.amb.length+'</span>':'')+'</div>';
  h+='<label class="trem" style="margin:10px 0"><input type="checkbox" data-act="sxOnly"'+(x.only?' checked':'')+'> Заполнить только блюда без цены продажи (уже заданные не менять)</label>';
  h+=sxListHtml(ch,function(e){
    var d=e.old===null?'':e.price-e.old;
    return'<div class="sxrow"><span class="sxn">'+esc(e.name)+(e.weak?' <small class="warnt">порция не совпала, проверьте</small>':(e.how==='base'?' <small class="muted">по названию без массы</small>':''))+'</span><span class="num">'+(e.old===null?'<span class="muted">нет цены</span>':(x.pt&&!e.own?'<span class="muted" title="Цена региона">'+money(e.old)+'</span>':money(e.old)))+' → <b>'+money(e.price)+'</b>'+(d===''?'':' <small class="'+(d>0?'warnt':'muted')+'">'+(d>0?'+':'−')+money(Math.abs(d))+'</small>')+'</span></div>';
  },'Что изменится',true);
  h+=sxListHtml(m.sim,function(e){return'<label class="sxrow"><span class="sxn"><input type="checkbox" data-act="sxSim" data-k="'+e.k+'"'+((x.simOn||{})[e.k]?' checked':'')+'> '+esc(e.file)+' <small class="muted">похоже на «'+esc(e.name)+'»'+(e.old===null?'':', сейчас '+money(e.old))+'</small></span><span class="num">'+money(e.price)+'</span></label>';},'Похожие названия, отметьте нужные',true);
  h+=sxListHtml(m.amb,function(it){return'<div class="sxrow"><span class="sxn">'+esc(it.name)+' <small class="muted">подходит несколько блюд: '+esc(it.cands.slice(0,3).join('; '))+'</small></span><span class="num">'+money(it.price)+'</span></div>';},'Неоднозначно, не загружено',false);
  h+=sxListHtml(m.miss,function(it){return'<div class="sxrow"><span class="sxn">'+esc(it.name)+(it.why?' <small class="muted">'+esc(it.why)+(it.near&&it.near.length?': '+esc(it.near.join('; ')):'')+'</small>':(it.near&&it.near.length?' <small class="muted">ближе всего: '+esc(it.near.join('; '))+'</small>':''))+'</span><span class="num">'+money(it.price)+'</span></div>';},'Нет в приложении, пропущено',false);
  h+=sxListHtml(m.dup,function(it){return'<div class="sxrow"><span class="sxn">'+esc(it.name)+' <small class="muted">'+esc(it.why||'')+'</small></span><span class="num">'+money(it.price)+'</span></div>';},'Другие порции, не загружены',false);
  if(!m.apps)h+='<p class="hint warnt" style="margin:8px 0">В выбранном регионе нет блюд без архива. Проверьте регион вверху страницы.</p>';
  else if(m.hidden)h+='<p class="hint" style="margin:8px 0">Ещё '+m.hidden+' из пропущенных есть в архиве или в другом регионе приложения.</p>';
  h+='<div class="btns" style="margin-top:12px"><button class="btn primary" data-act="sxApply" data-edit'+(ch.length?'':' disabled')+'>Применить: '+ch.length+(newN&&!x.only?' ('+newN+' без цены)':'')+'</button><button class="btn" data-act="sxCancel">Отмена</button></div>'
    +'<p class="hint" style="margin:8px 0 0">Блюда, которых нет в приложении, не создаются. Себестоимость и состав не меняются.'+(syLinked()?' Изменения попадут в «Мои изменения» и уйдут в общую базу после отправки.':'')+'</p></section>';
  return h;
}
