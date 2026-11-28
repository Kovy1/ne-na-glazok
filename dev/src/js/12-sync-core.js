/* ---------- общая база: обмен данными через таблицу ----------
   Каждая позиция общей базы (сырьё «ing», рецепт «rec») имеет общий идентификатор sid. У каждого браузера свои локальные ид,
   поэтому соответствие хранится отдельно: ctx.map[вид][локальный ид] = {sid, rev, h}
   rev — версия позиции в общей базе на момент последней сверки (0: ещё не опубликована), h — хэш содержимого на тот момент.
   Позиция «изменена у вас», если её текущий хэш не равен h. ctx = {ings, recipes, map}. */
function syHash(s){
  var h1=0xdeadbeef,h2=0x41c6ce57,i,ch;
  for(i=0;i<s.length;i++){ch=s.charCodeAt(i);h1=Math.imul(h1^ch,2654435761);h2=Math.imul(h2^ch,1597334677);}
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return(4294967296*(2097151&h2)+(h1>>>0)).toString(36);
}
function syH(o){return syHash(canon(o));}
function syMap(ctx,kind){if(!ctx.map)ctx.map={};return ctx.map[kind]||(ctx.map[kind]={});}
function sySid(ctx,kind,id,create){
  var m=syMap(ctx,kind),e=m[id];
  if(e&&e.sid)return e.sid;
  if(!id)return'';
  if(!create)return'~'+id;
  e=m[id]={sid:(kind==='ing'?'i':'r')+uid(),rev:0,h:''};
  return e.sid;
}
/* вид позиции для обмена: рецептура ссылается на сырьё по sid (и названию на случай, если sid не найдётся); продажи и протокол ОП-1 остаются у себя */
function syIngClean(j){var o=normIng(j);if(NOPRICE)stripIngPrice(o);return o;}
function syRecClean(j){
  j=j||{};
  var b=normRecipe({name:j.name,output:j.output,rows:[],ref:j.ref,ttk:j.ttk,sell:j.sell,ds:j.ds,aliases:j.aliases,reg:j.reg,pf:j.pf});
  var o={name:b.name,output:b.output,
    rows:(Array.isArray(j.rows)?j.rows:[]).slice(0,300).map(function(x){
      x=x||{};
      var q={ing:String(x.ing||''),'in':String(x['in']||'').slice(0,200),net:num(x.net),share:(x.share===undefined||x.share===null)?100:num(x.share)};
      if(nn(x.gross)!==null)q.gross=num(x.gross);
      if(x.tname)q.tname=String(x.tname).slice(0,200);
      if(x.skip===true&&!q.ing)q.skip=true;
      if(!x.pf){var al=normAlts(x.alts);if(al.length)q.alts=al;}
      if(x.pf&&!q.ing){q.pf=String(x.pf).slice(0,60);if(x.pfn)q.pfn=String(x.pfn).slice(0,200);}      /* полуфабрикат: sid карты в общей базе и её название на случай, если sid не найдётся */
      return q;
    }),ref:b.ref,ttk:b.ttk};
  if(b.pf)o.pf=true;
  if(b.ds)o.ds=b.ds;
  if(b.sell)o.sell=b.sell;   // цена продажи уходит в предложение как есть: принимает или отклоняет её технолог
  if(b.aliases)o.aliases=b.aliases;
  if(b.reg)o.reg=b.reg;
  return o;       // папка меню и «в архиве» — личное дело каждого, в общую базу не уходят (там остаются все ТТК, а меню у каждой столовой своё)
}
function syRecShared(ctx,id){
  var n=normRecipe(ctx.recipes[id]);
  return syRecClean({name:n.name,output:n.output,ref:n.ref,ttk:n.ttk,sell:n.sell,ds:n.ds,aliases:n.aliases,reg:n.reg,pf:n.pf,
    rows:n.rows.map(function(x){
      var g=x.ing?ctx.ings[x.ing]:null;
      var q={ing:g?sySid(ctx,'ing',x.ing,false):'','in':g?g.name:'',net:x.net,share:x.share,gross:x.gross,tname:x.tname};
      if(x.skip&&!x.ing)q.skip=true;
      if(x.alts&&x.alts.length)q.alts=x.alts;
      if(x.pf&&ctx.recipes[x.pf]){q.pf=sySid(ctx,'rec',x.pf,false);q.pfn=ctx.recipes[x.pf].name;}
      else if(x.pfs){q.pf=x.pfs;if(x.pfn)q.pfn=x.pfn;}
      return q;
    })});
}
function syCur(ctx,kind,id){
  var o=kind==='ing'?syIngClean(ctx.ings[id]):syRecShared(ctx,id);
  return{shared:o,h:syH(o),name:o.name};
}
/* что отличается у вас от общей базы: новое (в общей базе нет) и изменённое */
function syDirty(ctx){
  var out=[];
  ['ing','rec'].forEach(function(kind){
    var src=kind==='ing'?ctx.ings:ctx.recipes,m=syMap(ctx,kind);
    Object.keys(src).forEach(function(id){
      var e=m[id],cur=syCur(ctx,kind,id);
      if(!e||!e.rev)out.push({kind:kind,id:id,name:cur.name||'Без названия',state:'new'});
      else if(e.h!==cur.h)out.push({kind:kind,id:id,name:cur.name||'Без названия',state:'changed'});
    });
  });
  Object.keys(ctx.del||{}).forEach(function(k){
    var x=ctx.del[k];
    if(x&&x.sid)out.push({kind:x.kind,id:'~del~'+x.sid,sid:x.sid,name:x.name||'Без названия',state:'deleted',sent:!!x.sent});
  });
  out.sort(function(a,b){return(a.kind===b.kind?0:(a.kind==='rec'?-1:1))||String(a.name).localeCompare(String(b.name),'ru');});
  return out;
}
/* пакет для отправки: выбранные позиции; к рецептам добавляется сырьё, которого ещё нет в общей базе (без него рецептуру не принять) */
function syBatch(ctx,sel){
  var items=[],seen=Object.create(null),auto=[],dels={};
  sel.forEach(function(s){if(s.state==='deleted')dels[s.kind+'|'+s.sid]=1;});
  function add(kind,id,isAuto){
    var key=kind+'|'+id;
    if(seen[key])return;
    seen[key]=1;
    sySid(ctx,kind,id,true);
    var cur=syCur(ctx,kind,id),e=syMap(ctx,kind)[id];
    items.push({kind:kind,sid:e.sid,name:cur.name,baseRev:e.rev||0,json:cur.shared,localId:id,auto:!!isAuto});
    if(isAuto)auto.push(cur.name);
  }
  sel=sel.filter(function(s){return s.state!=='deleted';}).concat([]);
  sel.filter(function(s){return s.kind==='ing';}).forEach(function(s){add('ing',s.id,false);});
  /* карты-полуфабрикаты, которых ещё нет в общей базе, уходят вместе с ТТК, где они используются (раньше них) */
  var pfDeps=[],pfSeen=Object.create(null);
  function walkPf(id,depth){
    var r=ctx.recipes[id];
    if(!r||depth>PF_DEPTH)return;
    r.rows.forEach(function(x){
      if(!x.pf||!ctx.recipes[x.pf]||pfSeen[x.pf])return;
      pfSeen[x.pf]=1;
      walkPf(x.pf,depth+1);
      var e=syMap(ctx,'rec')[x.pf];
      if(!e||!e.rev)pfDeps.push(x.pf);
    });
  }
  sel.filter(function(s){return s.kind==='rec';}).forEach(function(s){walkPf(s.id,0);});
  var recAll=pfDeps.concat(sel.filter(function(s){return s.kind==='rec';}).map(function(s){return s.id;}));
  recAll.forEach(function(id){
    var r=ctx.recipes[id];
    if(!r)return;
    r.rows.forEach(function(x){
      if(!x.ing||!ctx.ings[x.ing])return;
      var e=syMap(ctx,'ing')[x.ing];
      if(!e||!e.rev)add('ing',x.ing,true);
    });
  });
  var selRec={};sel.forEach(function(s){if(s.kind==='rec')selRec[s.id]=1;});
  pfDeps.forEach(function(id){add('rec',id,!selRec[id]);});
  sel.filter(function(s){return s.kind==='rec';}).forEach(function(s){add('rec',s.id,false);});
  Object.keys(ctx.del||{}).forEach(function(k){
    var x=ctx.del[k];
    if(x&&x.sid&&dels[k])items.push({kind:x.kind,sid:x.sid,name:x.name||'Без названия',baseRev:x.rev||0,json:{_del:1},localId:'',del:true});
  });
  return{items:items,auto:auto};
}
/* рецепт из общего вида в локальный: сырьё ищется по sid, затем по названию */
function syRecToLocal(ctx,j){
  var rsid=Object.create(null),rname=Object.create(null),rm=syMap(ctx,'rec');
  Object.keys(rm).forEach(function(id){if(rm[id].sid&&ctx.recipes[id])rsid[rm[id].sid]=id;});
  Object.keys(ctx.recipes).forEach(function(id){var k=normKey(ctx.recipes[id].name);if(k&&!rname[k])rname[k]=id;});
  var sidIdx=Object.create(null),nameIdx=Object.create(null),m=syMap(ctx,'ing');
  Object.keys(m).forEach(function(id){if(m[id].sid&&ctx.ings[id])sidIdx[m[id].sid]=id;});
  Object.keys(ctx.ings).forEach(function(id){var k=normKey(ctx.ings[id].name);if(k&&!nameIdx[k])nameIdx[k]=id;});
  var nr=normRecipe({name:j.name,output:j.output,ref:j.ref,ttk:j.ttk,sell:j.sell,ds:j.ds,aliases:j.aliases,reg:j.reg,pf:j.pf,
    rows:j.rows.map(function(x){
      var r={rid:uid(),ing:sidIdx[x.ing]||nameIdx[normKey(x['in'])]||'',net:x.net,share:x.share};
      if(x.gross!==undefined)r.gross=x.gross;
      if(x.tname)r.tname=x.tname;
      if(x.skip&&!r.ing)r.skip=true;
      if(x.alts)r.alts=x.alts;
      if(x.pf&&!r.ing){      /* полуфабрикат: своя карта по sid, затем по названию; нет такой — ссылка ждёт загрузки карты (pfs) */
        var pid=rsid[x.pf]||rname[normKey(x.pfn||'')]||'';
        if(pid)r.pf=pid;else r.pfs=x.pf;
        if(x.pfn)r.pfn=x.pfn;
      }
      return r;
    })});
  return nr;
}
/* ссылки на полуфабрикаты, пришедшие раньше самой карты-полуфабриката, привязываются к ней, когда она появилась */
function syPfResolve(ctx){
  var m=syMap(ctx,'rec'),by=Object.create(null),n=0;
  Object.keys(m).forEach(function(id){if(m[id]&&m[id].sid&&ctx.recipes[id])by[m[id].sid]=id;});
  Object.keys(ctx.recipes).forEach(function(rid){
    ctx.recipes[rid].rows.forEach(function(x){
      if(x.pfs&&by[x.pfs]&&by[x.pfs]!==rid){x.pf=by[x.pfs];delete x.pfs;n++;}
    });
  });
  return n;
}
/* синонимы сырья (как оно называется в ТТК и прайсах) только дополняют друг друга, поэтому сами по себе конфликта не дают:
   если позиции различаются лишь синонимами, они считаются совпавшими, а список синонимов у вас дополняется общим */
function syNoAl(j){var o=syIngClean(j);delete o.aliases;return o;}
function syAlOnly(a,b){return canon(syNoAl(a))===canon(syNoAl(b));}
function syAlUnion(mine,theirs){
  var out=(mine||[]).slice(),i;
  (theirs||[]).forEach(function(a){if(out.indexOf(a)<0)out.push(a);});
  return out.slice(0,40);
}
/* Встроенная в файл стартовая база (KBZHU_SEED) — не правки человека. При первом подключении она служит «последней известной версией»:
   запись, которая от неё не отличается, не считается изменённой и просто заменяется общей; различия по разным полям объединяются,
   конфликтом остаётся только одно и то же поле, изменённое по-разному. */
var SY_SEEDIX=null;
function sySeedHas(kind,id){
  var sd=(typeof window!=='undefined'&&window.KBZHU_SEED)||null,m=sd&&(kind==='ing'?sd.ings:sd.recipes);
  return!!(m&&id&&Object.prototype.hasOwnProperty.call(m,id));
}
function sySeedBase(id,kind,ctx){
  var sd=(typeof window!=='undefined'&&window.KBZHU_SEED)||null;
  kind=kind||'ing';
  if(!sd||!id||!sySeedHas(kind,id))return null;
  if(kind==='rec'){
    /* карта из встроенной базы приводится к общему виду теми же правилами и с теми же связями сырья, что и ваша копия */
    var ci={},ri={};
    Object.keys(sd.ings||{}).forEach(function(k){ci[k]=normIng(sd.ings[k]);});
    ri[id]=normRecipe(sd.recipes[id]);
    return syRecShared({ings:ci,recipes:ri,map:ctx&&ctx.map||{ing:{},rec:{}}},id);
  }
  if(!SY_SEEDIX||SY_SEEDIX.np!==!!NOPRICE)SY_SEEDIX={np:!!NOPRICE,m:Object.create(null)};
  if(!SY_SEEDIX.m[id])SY_SEEDIX.m[id]=syIngClean(sd.ings[id]);
  return SY_SEEDIX.m[id];
}
function sy1Obj(o){return!!o&&typeof o==='object'&&!Array.isArray(o);}
function syMerge3(base,loc,rem){
  var keys={},out={},conf=[];
  [base,loc,rem].forEach(function(o){Object.keys(o||{}).forEach(function(k){keys[k]=1;});});
  Object.keys(keys).forEach(function(k){
    var b=canon(base[k]),l=canon(loc[k]),r=canon(rem[k]),v;
    if(k==='aliases'){v=syAlUnion(loc[k],rem[k]);if(v.length)out[k]=v;return;}
    if(l===r)v=loc[k];
    else if(l===b)v=rem[k];
    else if(r===b)v=loc[k];
    else if(sy1Obj(loc[k])&&sy1Obj(rem[k])&&(base[k]===undefined||sy1Obj(base[k]))){
      /* вложенные поля (технология, условия хранения…) сверяются по отдельности: разные подпункты объединяются, спорным остаётся только один и тот же */
      var sub=syMerge3(base[k]||{},loc[k],rem[k]);
      v=sub.json;sub.conflicts.forEach(function(c){conf.push(k+'.'+c);});
    }
    else{conf.push(k);v=loc[k];}
    if(v!==undefined)out[k]=v;
  });
  return{json:out,conflicts:conf};
}
/* что делать с конфликтом без вашего выбора: если позиция у вас и в общей базе сошлась только по названию (раньше вы с общей базой не
   сверялись), ваша версия не новее общей, поэтому редактору по умолчанию берётся общее; настоящий конфликт (менялось и у вас, и там) оставляет ваше */
function syPick(e,choose,adoptRemote){
  var c=choose&&choose[e.kind+'|'+e.sid];
  return c==='remote'||c==='local'?c:((adoptRemote&&e.adopt)?'remote':'local');
}
/* items: позиции из общей базы {kind,sid,name,rev,by,at,json}. Возвращает план: что новое, что обновится, что совпало, где конфликт */
function syPlanPull(ctx,items){
  var vmap=JSON.parse(JSON.stringify(ctx.map||{})),vctx={ings:ctx.ings,recipes:ctx.recipes,map:vmap},plan=[];
  /* ТТК, которые вы удалили у себя, при получении общего не возвращаются (вернуть их можно кнопкой в «Получить общее») */
  items=items.filter(function(x){return(x.json&&x.json._del)||!(ctx.gone&&ctx.gone[x.kind+'|'+x.sid]);});
  ['ing','rec'].forEach(function(kind){
    var src=kind==='ing'?ctx.ings:ctx.recipes,m=vmap[kind]||(vmap[kind]={}),sidIdx=Object.create(null),byName=Object.create(null),claimed=Object.create(null);
    Object.keys(src).forEach(function(id){
      var e=m[id];
      if(e&&e.sid)sidIdx[e.sid]=id;
      if(!e||!e.rev){var k=normKey(src[id].name);(byName[k]=byName[k]||[]).push(id);}
    });
    items.filter(function(x){return x.kind===kind;}).forEach(function(R){
      if(R.json&&R.json._del){
        /* позицию удалили в общей базе: у вас без правок она удалится, с правками остаётся ваша (конфликт); нет у вас — ничего делать не надо */
        var lid=sidIdx[R.sid]||'',te={kind:kind,sid:R.sid,name:R.name,rev:R.rev,by:R.by,at:R.at,json:{_del:1},h:'',localId:lid,adopt:false,state:'same',del:true};
        if(lid){
          var le=m[lid],lc=syCur(vctx,kind,lid);
          te.curName=lc.name;
          te.state=(le&&le.rev>0&&(le.h===lc.h||(le.sent&&le.sent===lc.h)))?'delete':'conflict';
          claimed[lid]=1;
        }
        plan.push(te);return;
      }
      var j=kind==='ing'?syIngClean(R.json):syRecClean(R.json),rh=syH(j),id=sidIdx[R.sid]||'',adopt=false;
      if(!id){
        var cand=(byName[normKey(R.name)]||[]).filter(function(c){return!claimed[c]&&(kind!=='rec'||(src[c].reg||'')===(j.reg||''));})[0];   // одноимённые карты разных регионов — разные ТТК
        if(cand){id=cand;adopt=true;}
      }
      var ent={kind:kind,sid:R.sid,name:R.name,rev:R.rev,by:R.by,at:R.at,json:j,h:rh,localId:id,adopt:adopt,state:'new'};
      if(id){
        claimed[id]=1;
        var e=m[id];
        m[id]={sid:R.sid,rev:(e&&e.rev)||0,h:(e&&e.h)||''};
        var cur=syCur(vctx,kind,id);
        ent.curName=cur.name;
        var hist=!!(e&&e.rev>0),bs=ctx.bases&&ctx.bases[kind+'|'+R.sid],sb=null;
        var tri=function(base){
          /* три версии: общая на момент последней сверки (или встроенная), ваша и новая общая */
          var mg=syMerge3(base,cur.shared,j);
          if(mg.conflicts.length){ent.state='conflict';ent.fields=mg.conflicts;}
          else{ent.state='merge';ent.mjson=mg.json;}
          ent.cls='edit';
        };
        if(cur.h===rh)ent.state='same';
        else if(kind==='ing'&&syAlOnly(cur.shared,j)){ent.state='same';ent.merge=true;}
        else if(e&&((e.rev>0&&e.h===cur.h)||(e.sent&&e.sent===cur.h)))ent.state='update';
        else if(hist&&e.h===rh)ent.state='same';        /* в общей базе версия та же, что вы получили раньше: меняли только вы, это ваша правка, а не расхождение */
        else if(hist&&bs)tri(kind==='ing'?syIngClean(bs):syRecClean(bs));
        else if(!hist&&(sb=sySeedBase(id,kind,vctx))){
          /* истории сверки нет, но запись пришла из встроенной базы (по её постоянному ид): не тронутая правками заменяется общей без вопросов */
          if(cur.h===syH(sb)){ent.state='update';ent.cls='first';}
          else tri(sb);
        }
        else if(!hist){ent.state='migrate';ent.cls='migrate';}      /* старые данные неизвестного происхождения: общая версия становится текущей, ваш вариант сохраняется как восстановленный черновик */
        else{ent.state='conflict';ent.cls='edit';}
      }
      plan.push(ent);
    });
  });
  return plan;
}
/* прежний общий вид включал папку меню и архив; чтобы у блюд, уже сверенных в том виде, не появились «изменения», хэш пересчитывается один раз */
function syMigrateHash(ctx){
  var m=syMap(ctx,'rec'),n=0,cl=ctx.cats||[];
  Object.keys(m).forEach(function(id){
    var e=m[id];
    if(!e||!e.rev||!e.h||!ctx.recipes[id])return;
    var cur=syCur(ctx,'rec',id);
    if(cur.h===e.h)return;
    var r=normRecipe(ctx.recipes[id]),o=JSON.parse(JSON.stringify(cur.shared)),i;
    for(i=0;i<cl.length;i++)if(cl[i].id===r.cat){var cn=String(cl[i].name||'').replace(/\s+/g,' ').trim().slice(0,60);if(cn)o.cat=cn;}
    if(r.arch===true)o.arch=true;
    if(syH(o)===e.h){e.h=cur.h;n++;}
  });
  return n;
}
/* права на цены изменились: общий вид позиции (а с ним и хэш) теперь считается иначе. Хэши сверенных позиций пересчитываются,
   чтобы они не стали вдруг «изменёнными». toNp: true — цены стали скрытыми, false — открылись. Возвращает число пересчитанных */
function syRehash(ctx,toNp){
  var was=NOPRICE,n=0;
  ['ing','rec'].forEach(function(kind){
    var m=syMap(ctx,kind),src=kind==='ing'?ctx.ings:ctx.recipes;
    Object.keys(m).forEach(function(id){
      var e=m[id];
      if(!e||!e.rev||!e.h||!src[id])return;
      NOPRICE=!toNp;var old=syCur(ctx,kind,id).h;
      NOPRICE=!!toNp;var nw=syCur(ctx,kind,id).h;
      if(old===e.h){e.h=nw;n++;}
    });
  });
  NOPRICE=was;
  return n;
}
/* применение плана; choose['вид|sid']==='remote' в конфликте берёт общее, иначе остаётся ваше. Возвращает счётчики и затронутые ид */
function syApplyPlan(ctx,plan,choose,adoptRemote){
  choose=choose||{};
  var res={added:0,updated:0,kept:0,mapped:0,merged:0,removed:0,ings:[],recs:[]};
  var dels=plan.filter(function(e){return e.del;});
  plan=plan.filter(function(e){return!e.del;});
  var order=plan.filter(function(e){return e.kind==='ing';}).concat(plan.filter(function(e){return e.kind==='rec';}));
  order.forEach(function(e){
    var m=syMap(ctx,e.kind),id=e.localId,old=id?m[id]:null;
    if(e.state==='same'){
      m[id]={sid:e.sid,rev:e.rev,h:e.h};res.mapped++;
      (res.bases=res.bases||[]).push({kind:e.kind,sid:e.sid,json:e.json});
      if(e.merge&&ctx.ings[id]){
        var al=syAlUnion(ctx.ings[id].aliases,e.json.aliases);
        if(al.length&&canon(al)!==canon(ctx.ings[id].aliases||[])){ctx.ings[id].aliases=al;res.merged++;res.ings.push(id);}
        m[id].h=syCur(ctx,e.kind,id).h;   // свои лишние синонимы отдельной правкой не считаются: уйдут вместе со следующей настоящей
      }
      return;
    }
    if(e.state==='merge'&&(e.kind==='ing'?ctx.ings[id]:ctx.recipes[id])){
      /* ваши правки по одним полям и общие по другим: общая версия принимается, ваши поля остаются и уйдут отдельной правкой */
      if(e.kind==='ing'){
        var om=ctx.ings[id];
        ctx.ings[id]=normIng(e.mjson);
        if(NOPRICE)PRICE_ING.forEach(function(k){if(om[k]!==undefined)ctx.ings[id][k]=om[k];});
        res.ings.push(id);
      }else{
        var or=ctx.recipes[id],mr=syRecToLocal(ctx,e.mjson);
        if(or){if(or.qty)mr.qty=or.qty;if(or.op)mr.op=or.op;if(or.cat)mr.cat=or.cat;if(or.arch)mr.arch=true;}
        ctx.recipes[id]=mr;res.recs.push(id);
      }
      m[id]={sid:e.sid,rev:e.rev,h:e.h};res.updated++;res.merge3=(res.merge3||0)+1;
      (res.bases=res.bases||[]).push({kind:e.kind,sid:e.sid,json:e.json});
      return;
    }
    if(e.state==='conflict'&&syPick(e,choose,adoptRemote)!=='remote'){
      m[id]={sid:e.sid,rev:e.rev,h:(old&&old.rev>0)?old.h:''};
      res.kept++;return;
    }
    if(e.state==='new')id=uid();
    if(e.state==='migrate')res.migrated=(res.migrated||0)+1;
    (res.bases=res.bases||[]).push({kind:e.kind,sid:e.sid,json:e.json});
    if(e.kind==='ing'){
      var oi=ctx.ings[id];
      ctx.ings[id]=normIng(e.json);
      if(NOPRICE&&oi)PRICE_ING.forEach(function(k){if(oi[k]!==undefined)ctx.ings[id][k]=oi[k];});   // свои цены остаются у вас, их просто не видно
      res.ings.push(id);
    }
    else{
      var nr=syRecToLocal(ctx,e.json),o=ctx.recipes[id];
      if(o){if(o.qty)nr.qty=o.qty;if(o.op)nr.op=o.op;if(o.cat)nr.cat=o.cat;if(o.arch)nr.arch=true;}   // личное остаётся: протокол ОП-1, папка меню, архив
      ctx.recipes[id]=nr;res.recs.push(id);
    }
    m[id]={sid:e.sid,rev:e.rev,h:e.h};
    m[id].h=syCur(ctx,e.kind,id).h;
    if(e.state==='new')res.added++;else res.updated++;
  });
  /* удаления из общей базы: сначала ТТК, потом сырьё; сырьё, которое ещё нужно вашим ТТК, остаётся у вас */
  dels.filter(function(e){return e.kind==='rec';}).concat(dels.filter(function(e){return e.kind==='ing';})).forEach(function(e){
    var m=syMap(ctx,e.kind),id=e.localId,src=e.kind==='ing'?ctx.ings:ctx.recipes;
    if(ctx.del)delete ctx.del[e.kind+'|'+e.sid];            /* ваше удаление уже в общей базе */
    if(!id||!src[id])return;
    if(e.state==='conflict'&&syPick(e,choose,adoptRemote)!=='remote'){delete m[id];res.kept++;return;}
    if(e.kind==='ing'&&Object.keys(ctx.recipes).some(function(rid){return ctx.recipes[rid].rows.some(function(x){return x.ing===id;});})){delete m[id];res.kept++;return;}
    delete src[id];delete m[id];res.removed++;
  });
  syPfResolve(ctx);
  if(res.bases&&typeof syBasesSave==='function')syBasesSave(res.bases);       /* снимки общих версий для будущего объединения */
  return res;
}
function syNum(v){return v===null||v===undefined||!isFinite(v)?'—':String(Math.round(v*100)/100).replace('.',',');}
/* краткое описание отличий для технолога; oldJ — что сейчас в общей базе (или null), newJ — что предлагают */
function syDescribe(kind,oldJ,newJ,regName){
  regName=regName||function(id){return id;};
  var out=[],i,k;
  if(newJ&&newJ._del)return['удаление из общей базы'];
  function priceStr(p){
    if(!p||p.price===undefined||p.price===null)return'нет';
    return syNum(p.price)+(p.priceUnit==='pack'?' ₽/уп.'+(p.packG?' ('+syNum(p.packG)+' г)':''):' ₽/кг');
  }
  if(kind==='ing'){
    var n=syIngClean(newJ);
    if(!oldJ){
      out.push('новое сырьё: Б/Ж/У '+syNum(n.p)+'/'+syNum(n.f)+'/'+syNum(n.c)+(n.price!==undefined?', цена '+priceStr(n):''));
      return out;
    }
    var o=syIngClean(oldJ);
    if(o.p!==n.p||o.f!==n.f||o.c!==n.c)out.push('Б/Ж/У '+syNum(o.p)+'/'+syNum(o.f)+'/'+syNum(o.c)+' → '+syNum(n.p)+'/'+syNum(n.f)+'/'+syNum(n.c));
    if(priceStr(o)!==priceStr(n))out.push('цена '+priceStr(o)+' → '+priceStr(n));
    var regs={};
    Object.keys(o.px||{}).concat(Object.keys(n.px||{})).forEach(function(r){regs[r]=1;});
    Object.keys(regs).forEach(function(r){
      var a=priceStr((o.px||{})[r]),b=priceStr((n.px||{})[r]);
      if(a!==b)out.push('цена ('+regName(r)+') '+a+' → '+b);
    });
    if(o.kind!==n.kind)out.push('тип данных: '+(KINDS[o.kind]||o.kind)+' → '+(KINDS[n.kind]||n.kind));
    if(o.name!==n.name)out.push('название «'+o.name+'» → «'+n.name+'»');
    if(canon(o.aliases||[])!==canon(n.aliases||[]))out.push('синонимы изменены');
    if((o.cat||'')!==(n.cat||''))out.push('раздел: «'+(o.cat||'по названию')+'» → «'+(n.cat||'по названию')+'»');
    if(canon(o.loss||null)!==canon(n.loss||null)||o.source!==n.source)out.push('источник или потери изменены');
    return out.length?out:['без видимых изменений'];
  }
  var r2=syRecClean(newJ);
  function sellStr(s){var a=Object.keys(s||{}).sort().map(function(g){return regName(g)+' '+syNum(s[g])+' ₽';});return a.length?a.join(', '):'нет';}
  if(!oldJ){
    out.push('новая ТТК'+(r2.reg?' для региона «'+regName(r2.reg)+'»':'')+': строк рецептуры '+r2.rows.length+', выход '+syNum(r2.output)+' г'+(r2.sell?', цена продажи: '+sellStr(r2.sell):''));
    return out;
  }
  var r1=syRecClean(oldJ);
  if(r1.name!==r2.name)out.push('название «'+r1.name+'» → «'+r2.name+'»');
  if(r1.output!==r2.output)out.push('выход '+syNum(r1.output)+' → '+syNum(r2.output)+' г');
  if((r1.reg||'')!==(r2.reg||''))out.push('регион ТТК: '+(r1.reg?regName(r1.reg):'все')+' → '+(r2.reg?regName(r2.reg):'все'));
  var gs={};
  Object.keys(r1.sell||{}).concat(Object.keys(r2.sell||{})).forEach(function(g){gs[g]=1;});
  Object.keys(gs).sort().forEach(function(g){
    var a=(r1.sell||{})[g],b=(r2.sell||{})[g];
    if(a!==b)out.push('цена продажи ('+regName(g)+') '+(a===undefined?'нет':syNum(a)+' ₽')+' → '+(b===undefined?'нет':syNum(b)+' ₽'));
  });
  syDsDiff(r1,r2,regName).forEach(function(x){out.push(x[0]+' '+x[1]+' → '+x[2]);});
  var key=function(x){return x.ing||(x.pf?'p:'+x.pf:('n:'+normKey(x['in'])));},nm=function(x){return x['in']||(x.pf?'полуфабрикат «'+(x.pfn||'ТТК')+'»':(x.tname||'?'));};
  var A={},B={},added=[],removed=[],changed=[],altCh=[];
  r1.rows.forEach(function(x){A[key(x)]=x;});
  r2.rows.forEach(function(x){B[key(x)]=x;});
  Object.keys(B).forEach(function(q){
    if(!A[q])added.push(nm(B[q]));
    else if(A[q].net!==B[q].net||A[q].share!==B[q].share||(A[q].gross||null)!==(B[q].gross||null))changed.push(nm(B[q]));
    else if(canon(A[q].alts||[])!==canon(B[q].alts||[]))altCh.push(nm(B[q]));
  });
  Object.keys(A).forEach(function(q){if(!B[q])removed.push(nm(A[q]));});
  if(added.length||removed.length||changed.length||altCh.length){
    var p=[];
    if(added.length)p.push('добавлено: '+added.slice(0,3).join(', ')+(added.length>3?'…':''));
    if(removed.length)p.push('убрано: '+removed.slice(0,3).join(', ')+(removed.length>3?'…':''));
    if(changed.length)p.push('изменено количество: '+changed.slice(0,3).join(', ')+(changed.length>3?'…':''));
    if(altCh.length)p.push('изменены варианты «Или»: '+altCh.slice(0,3).join(', ')+(altCh.length>3?'…':''));
    out.push('состав: '+p.join('; '));
  }else if(canon(r1.rows.map(key))!==canon(r2.rows.map(key)))out.push('порядок строк состава изменён');
  var tk={};
  Object.keys(r1.ttk||{}).concat(Object.keys(r2.ttk||{})).forEach(function(q){tk[q]=1;});
  var nt=Object.keys(tk).filter(function(q){return(r1.ttk||{})[q]!==(r2.ttk||{})[q];}).length;
  if(nt)out.push('реквизиты и тексты ТТК: изменено полей '+nt);
  if(canon(r1.ref)!==canon(r2.ref))out.push('эталон КБЖУ изменён');
  if(canon(r1.aliases||[])!==canon(r2.aliases||[]))out.push('синонимы названия изменены');
  return out.length?out:['без видимых изменений'];
}

/* ---- подробное сравнение «было → стало» для технолога: список {t:'chg'|'add'|'del'|'text'|'note', l:подпись, a:было, b:стало} ---- */
var TTK_LBL={num:'Номер ТТК',dish:'Наименование блюда',portion:'Порция в названии',org:'Организация',head:'Должность утверждающего',headName:'ФИО утверждающего',date:'Дата утверждения',tol:'Допуск по массе, ± г',main:'Выход основного продукта, г',
  viiSrc:'КБЖУ взять из',viiBasis:'КБЖУ показать',viiLabel:'Подпись над КБЖУ',viiNote:'Примечание под КБЖУ',scope:'I. Область применения',r21:'2.1. Требования к сырью',r22:'2.2. Подготовка сырья',r23:'2.3. Нормы потерь',
  t41:'4.1. Предварительная подготовка',t42:'4.2. Технология приготовления',s51:'5.1. Оформление и подача',s52:'5.2. Температура подачи',s53:'5.3. Доставка',s54:'5.4. Срок хранения',look:'6.1. Внешний вид',color:'Цвет',
  texture:'Консистенция',taste:'Вкус и запах',p62a:'6.2. Физико-химические показатели',p62b:'6.2. Выход готового блюда',p62c:'6.2. Допустимые отклонения по массе',m63:'6.3. Микробиологические показатели',
  subs:'Итоговые строки состава',semiName:'Полуфабрикат: название',semiMass:'Полуфабрикат: масса',semiAfter:'Полуфабрикат: после строки'};
function ttkLabel(k){return TTK_LBL[k]||('поле ТТК «'+k+'»');}
function syRowKeys(rows){var seen={};return rows.map(function(x){var b=x.ing||(x.pf?'p:'+x.pf:('n:'+normKey(x['in']||x.tname||'')));seen[b]=(seen[b]||0)+1;return b+'#'+seen[b];});}
function syRowName(x){return x['in']||(x.pf?'полуфабрикат «'+(x.pfn||'ТТК')+'»':(x.tname||'строка без сырья'));}
function syRowQty(x){
  var s=syNum(x.net)+' г';
  if(x.share!==undefined&&x.share!==null&&x.share!==100)s+=', доля '+syNum(x.share)+' %';
  if(x.gross!==undefined&&x.gross!==null)s+=', брутто '+syNum(x.gross)+' г';
  if(x.skip&&!x.ing)s+=', не учитывается';
  if(x.alts&&x.alts.length)s+=', или: '+x.alts.map(function(a){return a.name+((a.net!==undefined&&a.net!==null)?' '+syNum(a.net)+' г':'');}).join('; ');
  return s;
}
/* строки нового состава относительно старого: st[i] = '' | 'add' | 'chg'; del — убранные строки; chg — пары [было, стало] */
function syRowCmp(oldRows,newRows){
  var ka=syRowKeys(oldRows),kb=syRowKeys(newRows),A={},B={},st=[],del=[],chg=[];
  ka.forEach(function(k,i){A[k]=oldRows[i];});
  kb.forEach(function(k){B[k]=1;});
  newRows.forEach(function(x,i){
    var o=A[kb[i]];
    if(!o)st.push('add');
    else if(syRowQty(o)!==syRowQty(x)){st.push('chg');chg.push([o,x]);}
    else st.push('');
  });
  oldRows.forEach(function(x,i){if(!B[ka[i]])del.push(x);});
  return{st:st,del:del,chg:chg,order:canon(ka)!==canon(kb)};
}
function syRefStr(f){
  if(!f||[f.p,f.f,f.c,f.kcal].every(function(v){return v===null||v===undefined;}))return'нет';
  return'Б '+syNum(f.p)+' · Ж '+syNum(f.f)+' · У '+syNum(f.c)+' · '+syNum(f.kcal)+' ккал';
}
/* отметки деклараций о соответствии: [подпись, было, стало] по регионам */
function syDsDiff(r1,r2,regName){
  var gs={},out=[];
  function t(x){return x?(x.g||'задекларировано')+(x.n?' ('+x.n+')':''):'нет';}
  Object.keys(r1.ds||{}).concat(Object.keys(r2.ds||{})).forEach(function(g){gs[g]=1;});
  Object.keys(gs).sort().forEach(function(g){var a=(r1.ds||{})[g],b=(r2.ds||{})[g];if(t(a)!==t(b))out.push(['декларация ('+regName(g)+')',t(a),t(b)]);});
  return out;
}
function syDiffItems(kind,oldJ,newJ,regName){
  regName=regName||function(id){return id;};
  var it=[],i,k;
  function ch(l,a,b){it.push({t:'chg',l:l,a:a,b:b});}
  function ad(l,b){it.push({t:'add',l:l,b:b});}
  function dl(l,a){it.push({t:'del',l:l,a:a});}
  function nt(l){it.push({t:'note',l:l});}
  if(newJ&&newJ._del)return[{t:'del',l:'удаление из общей базы',a:''}];
  function priceStr(p){
    if(!p||p.price===undefined||p.price===null)return'нет';
    return syNum(p.price)+(p.priceUnit==='pack'?' ₽/уп.'+(p.packG?' ('+syNum(p.packG)+' г)':''):' ₽/кг');
  }
  if(kind==='ing'){
    var n=syIngClean(newJ);
    if(!oldJ){ad('новое сырьё:','Б/Ж/У '+syNum(n.p)+'/'+syNum(n.f)+'/'+syNum(n.c)+(n.price!==undefined?', цена '+priceStr(n):''));return it;}
    var o=syIngClean(oldJ);
    if(o.p!==n.p||o.f!==n.f||o.c!==n.c)ch('Б/Ж/У',syNum(o.p)+'/'+syNum(o.f)+'/'+syNum(o.c),syNum(n.p)+'/'+syNum(n.f)+'/'+syNum(n.c));
    if(priceStr(o)!==priceStr(n))ch('цена',priceStr(o),priceStr(n));
    var regs={};
    Object.keys(o.px||{}).concat(Object.keys(n.px||{})).forEach(function(r){regs[r]=1;});
    Object.keys(regs).forEach(function(r){
      var a=priceStr((o.px||{})[r]),b=priceStr((n.px||{})[r]);
      if(a!==b)ch('цена ('+regName(r)+')',a,b);
    });
    if(o.kind!==n.kind)ch('тип данных:',KINDS[o.kind]||o.kind,KINDS[n.kind]||n.kind);
    if(o.name!==n.name)ch('название','«'+o.name+'»','«'+n.name+'»');
    if(canon(o.aliases||[])!==canon(n.aliases||[]))ch('синонимы:',(o.aliases||[]).join(', ')||'нет',(n.aliases||[]).join(', ')||'нет');
    if((o.cat||'')!==(n.cat||''))ch('раздел:','«'+(o.cat||'по названию')+'»','«'+(n.cat||'по названию')+'»');
    if(canon(o.loss||null)!==canon(n.loss||null)||o.source!==n.source)nt('источник или потери изменены');
    return it;
  }
  var r2=syRecClean(newJ);
  function sellStr(s){var a=Object.keys(s||{}).sort().map(function(g){return regName(g)+' '+syNum(s[g])+' ₽';});return a.length?a.join(', '):'нет';}
  if(!oldJ){
    ad('новая ТТК'+(r2.reg?' для региона «'+regName(r2.reg)+'»':'')+':','строк рецептуры '+r2.rows.length+', выход '+syNum(r2.output)+' г'+(r2.sell?', цена продажи: '+sellStr(r2.sell):''));
    r2.rows.slice(0,40).forEach(function(x){ad('состав:',syRowName(x)+' — '+syRowQty(x));});
    if(r2.rows.length>40)nt('…и ещё строк состава: '+(r2.rows.length-40));
    return it;
  }
  var r1=syRecClean(oldJ);
  if(r1.name!==r2.name)ch('название','«'+r1.name+'»','«'+r2.name+'»');
  if(r1.output!==r2.output)ch('выход',syNum(r1.output)+' г',syNum(r2.output)+' г');
  if((r1.reg||'')!==(r2.reg||''))ch('регион ТТК:',r1.reg?regName(r1.reg):'все',r2.reg?regName(r2.reg):'все');
  var gs={};
  Object.keys(r1.sell||{}).concat(Object.keys(r2.sell||{})).forEach(function(g){gs[g]=1;});
  Object.keys(gs).sort().forEach(function(g){
    var a=(r1.sell||{})[g],b=(r2.sell||{})[g];
    if(a!==b)ch('цена продажи ('+regName(g)+')',a===undefined?'нет':syNum(a)+' ₽',b===undefined?'нет':syNum(b)+' ₽');
  });
  syDsDiff(r1,r2,regName).forEach(function(x){ch(x[0],x[1],x[2]);});
  var cmp=syRowCmp(r1.rows,r2.rows);
  cmp.chg.forEach(function(p){ch('состав: '+syRowName(p[1]),syRowQty(p[0]),syRowQty(p[1]));});
  r2.rows.forEach(function(x,j){if(cmp.st[j]==='add')ad('состав: добавлено',syRowName(x)+' — '+syRowQty(x));});
  cmp.del.forEach(function(x){dl('состав: убрано',syRowName(x)+' — '+syRowQty(x));});
  if(!cmp.chg.length&&!cmp.del.length&&cmp.st.indexOf('add')<0&&cmp.order)nt('порядок строк состава изменён');
  var tk={};
  Object.keys(r1.ttk||{}).concat(Object.keys(r2.ttk||{})).forEach(function(q){tk[q]=1;});
  Object.keys(tk).sort().forEach(function(q){
    var a=String((r1.ttk||{})[q]===undefined?'':(r1.ttk||{})[q]),b=String((r2.ttk||{})[q]===undefined?'':(r2.ttk||{})[q]);
    if(a===b)return;
    if(q==='subs'){nt('итоговые строки состава изменены');return;}
    if(a.length>70||b.length>70||/\n/.test(a+b))it.push({t:'text',l:ttkLabel(q),a:a,b:b});
    else ch(ttkLabel(q),a||'пусто',b||'пусто');
  });
  if(canon(r1.ref)!==canon(r2.ref))ch('эталон КБЖУ',syRefStr(r1.ref),syRefStr(r2.ref));
  if(canon(r1.aliases||[])!==canon(r2.aliases||[]))ch('синонимы названия:',(r1.aliases||[]).join(', ')||'нет',(r2.aliases||[]).join(', ')||'нет');
  return it;
}
function syDfLines(a,b){
  function ls(t){return String(t||'').split(/\n/).map(function(x){return x.replace(/\s+/g,' ').trim();}).filter(Boolean);}
  var A=ls(a),B=ls(b),ia={},ib={};
  A.forEach(function(x){ia[x]=1;});B.forEach(function(x){ib[x]=1;});
  return{del:A.filter(function(x){return!ib[x];}),add:B.filter(function(x){return!ia[x];})};
}
function syDfHtml(items){
  if(!items||!items.length)return'<ul class="sydiff sydf"><li>без видимых изменений</li></ul>';
  return'<ul class="sydiff sydf">'+items.map(function(x){
    var l=x.l?'<span class="dfl">'+esc(x.l)+'</span> ':'';
    if(x.t==='chg')return'<li class="dfc">'+l+'<del class="dfo">'+esc(x.a)+'</del> → <ins class="dfn">'+esc(x.b)+'</ins></li>';
    if(x.t==='add')return'<li class="dfa">'+l+'<ins class="dfn">'+esc(x.b)+'</ins></li>';
    if(x.t==='del')return'<li class="dfd">'+l+(x.a?'<del class="dfo">'+esc(x.a)+'</del>':'')+'</li>';
    if(x.t==='text'){
      var d=syDfLines(x.a,x.b),m=10,body='';
      d.del.slice(0,m).forEach(function(t){body+='<div class="dfx del">− '+esc(t)+'</div>';});
      if(d.del.length>m)body+='<div class="dfx">…и ещё убрано строк: '+(d.del.length-m)+'</div>';
      d.add.slice(0,m).forEach(function(t){body+='<div class="dfx add">+ '+esc(t)+'</div>';});
      if(d.add.length>m)body+='<div class="dfx">…и ещё добавлено строк: '+(d.add.length-m)+'</div>';
      if(!body)body='<div class="dfx">изменён порядок или оформление текста</div>';
      return'<li class="dfc dft">'+l+body+'</li>';
    }
    return'<li class="dfn0">'+l+'</li>';
  }).join('')+'</ul>';
}
/* различия карты, которую проверяет технолог, с опубликованной (или с картой из его базы) версией: подсветка строк состава и список */
function syCardCmp(id,baseJ){
  var cur,r;
  if(!S.recipes[id])return null;
  try{cur=syCur(syCtx(),'rec',id).shared;}catch(e){return null;}
  r=baseJ?syRowCmp(syRecClean(baseJ).rows,cur.rows):{st:cur.rows.map(function(){return'add';}),del:[],chg:[]};
  return{items:syDiffItems('rec',baseJ||null,cur,syRegName),cmp:r,fresh:!baseJ};
}
/* подсветка строки состава в открытой карте на проверке: новая — зелёным, с другим количеством — жёлтым */
function hlCls(rid){var c=S.hlCard,k=c&&c.rid&&c.rid[rid];return k?' hl-'+k:'';}
function hlSet(){
  /* считается один раз за отрисовку: нужна только проверяющему технологу */
  var a=S.active,rv=S.sy&&S.sy.rv,fr=S.sy&&S.sy.fr,sid,base=null,c=null,cmpId;
  S.hlCard=null;
  if(S.mode!=='local'||!syLinked()||!syAdmin()||!a)return;
  if(rv&&rvTmpIds(rv).indexOf(a)>-1){
    Object.keys(rv.recs).forEach(function(q){if(rv.recs[q]===a)sid=q;});
    base=(sid&&S.sy.pub['rec|'+sid])?S.sy.pub['rec|'+sid].json:null;
    c=syCardCmp(a,base);if(c)c.from=base?'опубликованной версии в общей базе':'';
  }else if(fr&&fr.recId===a){
    cmpId=fr.cmp&&S.recipes[fr.cmp]?fr.cmp:'';
    base=cmpId?syCur(syCtx(),'rec',cmpId).shared:null;
    c=syCardCmp(a,base);if(c)c.from=cmpId?('карты «'+recLabel(S.recipes[cmpId])+'» в вашей базе'):'';
  }
  if(c){
    c.id=a;c.rid={};
    var loc=normRecipe(S.recipes[a]).rows;
    if(c.cmp.st.length===loc.length)loc.forEach(function(x,i){if(c.cmp.st[i])c.rid[x.rid]=c.cmp.st[i];});
    S.hlCard=c;
  }
}
function hlPanelHtml(){
  var c=S.hlCard,n,h;
  if(!c)return'';
  n=c.items.length;
  h='<details class="rvdf" id="rvDf" open><summary>'+(c.fresh?'Такой ТТК в общей базе нет: это новая карта':'Что изменено относительно '+esc(c.from)+(n?' · '+n:''))+'</summary>';
  if(c.fresh)h+='<p class="rvt" style="margin:4px 0 0">Подсвечены все строки состава.</p>';
  else h+=(n?syDfHtml(c.items):'<p class="rvt" style="margin:4px 0 0">Отличий нет: карта совпадает с базой.</p>')+(n?'<p class="rvt" style="margin:4px 0 0">В составе карты изменённые строки подсвечены: синим — новые, охрой — с другим количеством.</p>':'');
  return h+'</details>';
}

