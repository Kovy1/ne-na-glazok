/* ---------- Фудкост: правила отклонений, план мероприятий, версии ----------
   Без внешнего ИИ: формулы, версионируемые правила, шаблоны текста, фиксированная методика приоритета.
   Одинаковые данные, настройки, справочники и версия алгоритма дают одинаковые суммы, состав, порядок и текст. */
var FC_RULES_VER=2;
var FC_ROLES={tech:'технолог',mgr:'управляющий',buy:'закупки',chef:'шеф-повар',acc:'бухгалтер'};
var FC_RW={R1:4,R2:4,R3:3,R4:3,R5:3,R6:3,R7:2,R8:2,R9:1,R10:2,R11:2,R12:2};
var FC_ST={'new':'Новое','work':'В работе','done':'Выполнено','checked':'Проверено','closed':'Закрыто','arch':'В архиве'};
var FC_EFK={pot:'Потенциальная экономия (расчётная)',acc:'Исправление учётной ошибки (затраты не меняются)',real:'Реальное снижение затрат'};
function fcToday(){var d=new Date(),z=function(n){return('0'+n).slice(-2);};return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate());}
function fcSp(v,d){
  if(v===null||v===undefined||!isFinite(v))return'не определено';
  var m=Math.pow(10,d||0),x=Math.round(Math.abs(v)*m+1e-9)/m,s=x.toFixed(d||0),p=s.split('.');
  p[0]=p[0].replace(/\B(?=(\d{3})+(?!\d))/g,' ');
  return(v<0&&x!==0?'−':'')+p.join(',');
}
function fcRubT(v){return v===null||v===undefined?'не определено':fcSp(v,0)+' ₽';}
function fcKgT(v){return v===null||v===undefined?'не определено':fcSp(v,2)+' кг';}
function fcPctT(v){return v===null||v===undefined?'не определено':fcSp(v,1)+' %';}
var FC_TNAME={receipts:'Поступления',moves:'Движение товаров',revision:'Ревизия',sales:'Продажи',writeoff:'Списания',output:'Выпуск',ph:'История закупок 1С'};
/* строка исходного документа текстом */
function fcSrcText(ref){
  if(!ref)return'';
  if(ref[0]==='ph'){var p=String(ref[1]).split('|');return'История закупок 1С, период '+fcIsoRu(p[0])+' – '+fcIsoRu(p[1])+', строка закупки от '+fcIsoRu(p[3]||'');}
  var o=(S.fc.ops[ref[0]]||{})[ref[1]];
  if(!o)return FC_TNAME[ref[0]]+': строка удалена вместе с загрузкой';
  var t=[FC_TNAME[ref[0]]];
  if(o.d)t.push(fcIsoRu(o.d));if(o.doc)t.push('док. '+o.doc);if(o.sup)t.push(o.sup);t.push(o.nm);
  var q=[];
  ['q','open','in','ret','tin','tout','out','close','book','fact'].forEach(function(k){if(o[k]!==undefined&&o[k]!==null)q.push((({q:'кол-во',open:'нач.',in:'приход','ret':'возвр.',tin:'перем. вх.',tout:'перем. исх.',out:'расход',close:'кон.',book:'учёт',fact:'факт'})[k])+' '+fcSp(o[k],3)+(o.u?' '+o.u:''));});
  if(q.length)t.push(q.join(', '));
  if(o.s!=null)t.push('сумма '+fcSp(o.s,2));
  if(o.reason)t.push('причина: '+o.reason);
  return t.join(', ');
}
function fcRefs(a,n){var seen={},o=[];(a||[]).forEach(function(r){var k=r[0]+'|'+r[1];if(!seen[k]){seen[k]=1;o.push(r);}});return o.slice(0,n||6);}
/* ---------- правила ---------- */
function fcF(rule,key,subj,st,o){o.rule=rule;o.key=key;o.subj=subj;o.st=st;return o;}
function fcRules(res){
  var t=res.cfg.thr,F=[],ids=Object.keys(res.ings).sort(),dids=Object.keys(res.dishes).sort(),pm=res.priceMode==='receipts'?'по ценам закупки периода':'по текущим ценам базы';
  ids.forEach(function(id){
    var e=res.ings[id],nm=e.name,pr=e.price;
    /* R1: необъяснённое отклонение */
    if(e.unexpl!==null&&e.unexplRub!==null&&e.actual>0&&e.unexpl>0&&e.unexplRub>=t.unexRub&&e.unexpl/e.actual*100>=t.unexPct){
      var ok=e.mv.verified!==false&&!Object.keys(e.flags).length&&!res.thIncomplete.length&&!e.rec.partial&&!res.dens[id];
      F.push(fcF('R1',id,nm,ok?'fact':'hyp',{
        title:'Необъяснённый расход: '+nm,
        sit:'По ревизиям фактический расход «'+nm+'» составил '+fcKgT(e.actual)+', объяснено продажами по ТТК, списаниями и внутренним потреблением '+fcKgT(e.explained)+'. Не объяснено '+fcKgT(e.unexpl)+' ('+fcPctT(e.unexpl/e.actual*100)+' факта, '+fcRubT(e.unexplRub)+' '+pm+'). Сработавшее правило не доказывает причину.',
        ev:[{l:'Фактический расход',v:fcKgT(e.actual),f:e.actualNote,src:e.rv.src},{l:'Теоретический расход (продажи × ТТК)',v:fcKgT(e.th.kg),f:'Σ проданных порций × расход сырья на порцию по ТТК',src:e.th.src},{l:'Списания и внутреннее потребление',v:fcKgT(e.wo.kg+e.it.kg+(e.dwo||0)+(e.din||0)),f:'документированные списания + внутреннее потребление + сырьё в списанных и внутренне потреблённых блюдах',src:e.wo.src.concat(e.it.src)},{l:'Необъяснённое отклонение',v:fcKgT(e.unexpl),f:'фактический − теоретический − списания − внутреннее потребление',src:[]}],
        eff:{k:'pot',m:'loss',ing:id,kg:e.unexpl,rub:e.unexplRub,g:'qty:'+id,note:'не более необъяснённого расхода; реальный эффект зависит от причины'},
        causes:['Закладка или выход блюд отличаются от ТТК','Перемещения, списания или внутреннее потребление не оформлены','Ошибки в ТТК или в сопоставлении блюд и сырья','Неточность взвешивания при ревизии'],
        check:'Проверить перемещения и списания по позиции за период; провести контрольное взвешивание закладки; сверить ТТК блюд, где используется «'+nm+'».',
        act:'Проверить перемещения «'+nm+'», провести контрольное взвешивание и сверить ТТК.',role:'mgr',
        crit:'Необъяснённое отклонение по «'+nm+'» ниже порога '+fcPctT(t.unexPct)+' факта за следующий сопоставимый период.'}));
    }else if(e.actual===null&&e.unexplBook!==null&&e.unexplBookRub!==null&&e.book>0&&e.unexplBook>0&&e.unexplBookRub>=t.unexRub&&e.unexplBook/e.book*100>=t.unexPct){
      F.push(fcF('R1',id,nm,'hyp',{
        title:'Расход по учёту выше объяснённого: '+nm,
        sit:'По учётному расходу «'+nm+'» '+fcKgT(e.book)+', объяснено '+fcKgT(e.explained)+'; разница '+fcKgT(e.unexplBook)+' ('+fcRubT(e.unexplBookRub)+' '+pm+'). Ревизии с фактом на обе границы периода нет, учётные остатки не доказывают фактический расход.',
        ev:[{l:'Учётный расход',v:fcKgT(e.book),f:'начальный остаток + приход ∓ возвраты ± перемещения − конечный остаток',src:e.mv.src},{l:'Объяснено продажами и документами',v:fcKgT(e.explained),f:'теоретический расход + списания + внутреннее потребление',src:e.th.src},{l:'Разница по учёту',v:fcKgT(e.unexplBook),f:'учётный расход − объяснено',src:[]}],
        eff:{k:'pot',m:'loss',ing:id,kg:e.unexplBook,rub:e.unexplBookRub,g:'qty:'+id,note:'ориентир по учётным остаткам'},
        causes:['Учётные остатки не совпадают с фактическими','Продажи или ТТК неполные','Не оформлены списания или перемещения'],
        check:'Провести ревизию позиции с фактическим пересчётом на начало и конец периода.',
        act:'Провести ревизию «'+nm+'» с пересчётом, затем повторить расчёт.',role:'mgr',
        crit:'Есть ревизия с фактическим остатком на обе границы периода, отклонение подтверждено или снято.'}));
    }
    /* R8: расход ниже ожидаемого */
    if(e.unexpl!==null&&e.unexplRub!==null&&e.actual>=0&&e.unexpl<0&&-e.unexplRub>=t.unexRub&&(e.explained>0?-e.unexpl/e.explained*100>=t.unexPct:false)){
      F.push(fcF('R8','neg:'+id,nm,'hyp',{
        title:'Расход ниже ожидаемого: '+nm,
        sit:'Фактический расход «'+nm+'» '+fcKgT(e.actual)+' меньше объяснённого '+fcKgT(e.explained)+' на '+fcKgT(-e.unexpl)+' ('+fcRubT(-e.unexplRub)+'). Возможны неучтённое поступление, завышенная норма в ТТК или ошибка в продажах.',
        ev:[{l:'Фактический расход',v:fcKgT(e.actual),f:e.actualNote,src:e.rv.src},{l:'Объяснено',v:fcKgT(e.explained),f:'теоретический расход + списания + внутреннее потребление',src:e.th.src}],
        eff:{k:'acc',rub:null,g:'acc:'+id,note:'исправление учёта, затраты не меняются'},
        causes:['Поступление не оформлено документом','Норма в ТТК выше фактической закладки','Продажи загружены с ошибкой'],
        check:'Сверить поступления и перемещения, проверить норму в ТТК и загрузку продаж.',act:'Сверить документы поступления и ТТК по «'+nm+'».',role:'acc',
        crit:'Расход по «'+nm+'» объясним документами и нормой ТТК.'}));
    }
    /* R2: недостачи ревизии */
    if(e.shortRub!==null&&e.rv.short>0&&e.shortRub>=t.shortRub){
      F.push(fcF('R2',id,nm,'fact',{
        title:'Недостача по ревизии: '+nm,
        sit:'По ревизии недостача «'+nm+'» '+fcKgT(e.rv.short)+' ('+fcRubT(e.shortRub)+' '+pm+'). Недостача уже входит в фактический расход и к нему повторно не прибавляется.',
        ev:[{l:'Недостача',v:fcKgT(e.rv.short),f:'Σ (учётное − фактическое) по строкам ревизии, где факт меньше учёта',src:e.rv.src}],
        eff:{k:'pot',m:'loss',ing:id,kg:e.rv.short,rub:e.shortRub,g:'qty:'+id,note:'входит в необъяснённый расход, отдельно не суммируется'},
        causes:['Потери при хранении и обработке','Неоформленные списания или выдача','Ошибка учёта прихода или расхода'],
        check:'Сверить даты и документы между ревизиями, провести повторный пересчёт спорной позиции.',
        act:'Выяснить причины недостачи «'+nm+'» по документам и оформить списание или исправить учёт.',role:'mgr',
        crit:'Причина недостачи установлена, документы оформлены, повторная ревизия без недостачи сверх порога.'}));
    }
    /* R3: значительные списания сырья */
    var woRub=pr!==null?e.wo.kg*pr:null;
    if(woRub!==null&&woRub>=t.woRub){
      F.push(fcF('R3','raw:'+id,nm,'fact',{
        title:'Значительные списания сырья: '+nm,
        sit:'Документированные списания «'+nm+'» за период: '+fcKgT(e.wo.kg)+' ('+fcRubT(woRub)+' '+pm+').',
        ev:[{l:'Списания сырья',v:fcKgT(e.wo.kg),f:'Σ списаний по причинам, не относящимся к внутреннему потреблению',src:e.wo.src}],
        eff:{k:'pot',m:'wo',ing:id,kg:e.wo.kg,rub:woRub,g:'wo:'+id,note:'часть списаний неизбежна; оценка верхняя'},
        causes:['Нарушения условий хранения','Избыточные закупки','Порча при приёмке'],check:'Просмотреть причины списаний и сроки годности, сверить заказы с продажами.',
        act:'Разобрать причины списаний «'+nm+'», скорректировать заказ.',role:'chef',crit:'Списания «'+nm+'» ниже порога '+fcRubT(t.woRub)+' за сопоставимый период.'}));
    }
    /* R4, R5, R6: цены и единицы */
    var rows0=(e.rec.rows||[]).filter(function(x){return x.pk!==null&&x.pk>0;}),netAll=rows0.length>0&&rows0.every(function(x){return x.pn!=null&&x.pn>0;}),vatCmp=res.cfg.vatP==='with'&&!netAll;
    var rows=rows0.map(function(x){var o=Object.assign({},x);if(netAll&&res.cfg.vatP==='with'){o.pk=x.pn;o.s=x.pn*x.kg;}return o;}).sort(function(a,b){return a.d<b.d?-1:(a.d>b.d?1:(String(a.id)<String(b.id)?-1:1));});
    if(rows.length>=2){
      var f0=rows[0],l0=rows[rows.length-1],gr=(l0.pk-f0.pk)/f0.pk*100;
      if(gr>=t.priceUp){
        var inc=0;rows.slice(1).forEach(function(x){if(x.pk>f0.pk)inc+=x.kg*(x.pk-f0.pk);});
        F.push(fcF('R4',id,nm,vatCmp?'hyp':'fact',{
          title:'Рост закупочной цены: '+nm,
          sit:'Цена закупки «'+nm+'» выросла с '+fcSp(f0.pk,2)+' ₽/кг ('+fcIsoRu(f0.d)+') до '+fcSp(l0.pk,2)+' ₽/кг ('+fcIsoRu(l0.d)+'): +'+fcPctT(gr)+'. Переплата относительно первой цены периода: '+fcRubT(inc)+'.',
          ev:[{l:'Первая закупка периода',v:fcSp(f0.pk,2)+' ₽/кг',f:'сумма ÷ количество в кг',src:[f0.src]},{l:'Последняя закупка периода',v:fcSp(l0.pk,2)+' ₽/кг',f:'сумма ÷ количество в кг',src:[l0.src]}],
          eff:{k:'pot',m:'price',ing:id,kb:rows.reduce(function(a,x){return a+x.kg;},0),rub:inc,g:'price:'+id,note:'если вернуть цену первой закупки; рынок мог измениться'+(vatCmp?'; цены даны с НДС, ставки строк не указаны — рост мог быть вызван сменой ставки':'')},
          causes:['Рыночное повышение цены','Смена поставщика или фасовки','Ошибка единицы в документе'],check:'Запросить сопоставимые предложения поставщиков, проверить единицу и фасовку в документах.',
          act:'Запросить сопоставимые предложения по «'+nm+'» и сравнить с текущей ценой.',role:'buy',crit:'Получены минимум два сопоставимых предложения, решение по поставщику принято.'}));
      }
    }
    var bys={};rows.forEach(function(x){var k=x.sup||'без поставщика',z=bys[k]||(bys[k]={sup:k,kg:0,sum:0,src:[]});z.kg+=x.kg;z.sum+=x.s||0;z.src.push(x.src);});
    var sl=Object.keys(bys).sort().map(function(k){return bys[k];}).filter(function(z){return z.kg>=t.supKg&&z.sum>0;});
    if(sl.length>=2){
      sl.forEach(function(z){z.pk=z.sum/z.kg;});
      var mn=sl.reduce(function(a,z){return z.pk<a.pk?z:a;}),mx=sl.reduce(function(a,z){return z.pk>a.pk?z:a;}),sp=(mx.pk-mn.pk)/mn.pk*100;
      if(sp>=t.supSpread){
        var pot=0;sl.forEach(function(z){if(z.pk>mn.pk)pot+=z.kg*(z.pk-mn.pk);});
        F.push(fcF('R5',id,nm,vatCmp?'hyp':'fact',{
          title:'Разброс цен поставщиков: '+nm,
          sit:'За период «'+nm+'» закупали у поставщиков по разным ценам: от '+fcSp(mn.pk,2)+' ₽/кг ('+mn.sup+') до '+fcSp(mx.pk,2)+' ₽/кг ('+mx.sup+'), разница '+fcPctT(sp)+'. Если бы весь объём шёл по минимальной цене, экономия составила бы '+fcRubT(pot)+' (расчётная, при сопоставимом качестве и условиях поставки).',
          ev:sl.map(function(z){return{l:'Поставщик «'+z.sup+'»',v:fcSp(z.pk,2)+' ₽/кг, '+fcKgT(z.kg),f:'Σ сумм ÷ Σ количества в кг',src:z.src};}),
          eff:{k:'pot',m:'price',ing:id,kb:sl.reduce(function(a,z){return a+z.kg;},0),rub:pot,g:'price:'+id,note:'расчётная; условия поставки, качество и отсрочка не учтены'+(vatCmp?'; цены даны с НДС, ставки строк не указаны — разница могла быть вызвана разными ставками НДС':'')},
          causes:['Разные условия поставки и отсрочка','Разное качество или фасовка','Закупка вне согласованного поставщика'],check:'Сравнить условия, качество и фасовку, запросить сопоставимые предложения.',
          act:'Запросить сопоставимые предложения по «'+nm+'» и согласовать единого поставщика.',role:'buy',crit:'Условия сопоставлены, выбран поставщик, цена закупки не выше согласованной.'}));
      }
    }
    if(e.basePrice>0){
      var bad=rows.filter(function(x){var r=x.pk/e.basePrice;return r>=t.anomHi||r<=t.anomLo;});
      if(bad.length){
        var kr=bad[0].pk/e.basePrice,k1000=(kr>=900&&kr<=1100)||(kr>=0.0009&&kr<=0.0011);
        F.push(fcF('R6',id,nm,'hyp',{
          title:'Аномальная цена или единица: '+nm,
          sit:'Цена в '+bad.length+' строках закупки «'+nm+'» отличается от цены базы ('+fcSp(e.basePrice,2)+' ₽/кг) в '+fcSp(kr,2)+' раза'+(k1000?' — примерно в 1000 раз, похоже на ошибку единицы (кг/г, л/мл)':'')+'. Это признак ошибки единицы или фасовки, не доказанный факт.',
          ev:bad.slice(0,5).map(function(x){return{l:'Закупка '+fcIsoRu(x.d),v:fcSp(x.pk,2)+' ₽/кг',f:'сумма ÷ количество в кг; в базе '+fcSp(e.basePrice,2)+' ₽/кг',src:[x.src]};}),
          eff:{k:'acc',rub:null,g:'acc:'+id,note:'исправление единицы или цены в учёте'},
          causes:['Ошибка единицы в документе поступления','Неверная масса упаковки в базе','Реальное резкое изменение цены'],check:'Открыть документ, сверить единицу, количество и фасовку.',
          act:'Исправить единицу закупки или массу упаковки для «'+nm+'».',role:'buy',crit:'Цена за кг по «'+nm+'» согласуется с базой или расхождение объяснено документом.'}));
      }
    }
    /* R4б: цена закупки периода и цена в базе */
    if(res.priceMode==='receipts'&&e.actPriceRaw>0&&e.basePrice>0&&e.rec.kg>0){
      var d1=(e.actPriceRaw-e.basePrice)/e.basePrice*100;
      if(Math.abs(d1)>=t.priceUpKg&&!rows.some(function(x){var r=x.pk/e.basePrice;return r>=t.anomHi||r<=t.anomLo;})){
        F.push(fcF('R4','base:'+id,nm,'hyp',{
          title:'Цена в базе отличается от закупок: '+nm,
          sit:'Средняя закупочная цена «'+nm+'» за период '+fcSp(e.actPriceRaw,2)+' ₽/кг, цена в базе '+fcSp(e.basePrice,2)+' ₽/кг ('+(d1>0?'+':'')+fcPctT(d1)+'). Себестоимость блюд по базе '+(d1>0?'занижена':'завышена')+', если закупки отражают реальную цену.'+(e.rec.partial?' Цена посчитана только по строкам с суммой: '+(e.rec.kgNoSum>0?fcKgT(e.rec.kgNoSum)+' без суммы не учтены':'')+(e.rec.nNoQty?(e.rec.kgNoSum>0?'; ':'')+e.rec.nNoQty+' стр. без количества не учтены':'')+'.':''),
          ev:[{l:'Средняя цена закупки',v:fcSp(e.actPriceRaw,2)+' ₽/кг',f:'Σ сумм ÷ Σ количества в кг',src:e.rec.src},{l:'Цена в базе',v:fcSp(e.basePrice,2)+' ₽/кг',f:'текущая цена региона',src:[]}],
          eff:{k:'acc',rub:null,g:'base:'+id,note:'обновление цены в базе, затраты не меняются'},
          causes:['Цена в базе устарела','Закупки по нетипичным условиям','Разная основа НДС'],check:'Сверить цену в базе с последними закупками и основой НДС.',
          act:'Обновить цену «'+nm+'» в базе или объяснить расхождение.',role:'buy',crit:'Цена в базе соответствует последним закупкам.'}));
      }
    }
    /* R10: допущения единиц */
    var fk=Object.keys(e.flags);
    if(fk.length){
      F.push(fcF('R10',id,nm,'hyp',{
        title:'Допущения по единицам: '+nm,
        sit:'Для «'+nm+'» при переводе в килограммы применены допущения ('+fk.join('; ')+'). Допущение принято пользователем осознанно, результат по этим строкам приблизительный.',
        ev:[{l:'Допущение',v:fk.join('; '),f:'перевод единицы в килограммы',src:[]}],
        eff:{k:'acc',rub:null,g:'acc:'+id,note:'уточнение единиц'},
        causes:['Плотность заменена допущением 1 л = 1 кг','Не задана масса штуки или упаковки'],check:'Ввести плотность или массу упаковки в карточке сырья.',act:'Ввести плотность или массу упаковки для «'+nm+'».',role:'tech',
        crit:'Плотность или масса упаковки введена, допущений нет.'}));
    }
    /* R8: баланс отчёта и сходимость учёта с фактом */
    if(e.mv.n&&e.mv.verified===false&&pr!==null&&Math.abs(e.mv.gap)*pr>=t.unexRub){
      F.push(fcF('R8','bal:'+id,nm,'fact',{
        title:'Баланс движения не сходится: '+nm,
        sit:'В отчёте «Движение товаров» расход «'+nm+'» '+fcKgT(e.mv.out)+', по балансу строки '+fcKgT(e.mv.bookKg)+'; расхождение '+fcKgT(e.mv.gap)+' ('+fcRubT(Math.abs(e.mv.gap)*pr)+'). Строка не принимается как проверенный баланс.',
        ev:[{l:'Расход по отчёту',v:fcKgT(e.mv.out),f:'значение отчёта',src:e.mv.src},{l:'Расход по балансу',v:fcKgT(e.mv.bookKg),f:'начальный остаток + приход ∓ возвраты ± перемещения − конечный остаток',src:e.mv.src}],
        eff:{k:'acc',rub:null,g:'acc:'+id,note:'исправление учёта'},
        causes:['Не учтены перемещения или возвраты','Часть колонок отчёта не сопоставлена','Единицы в строке разные'],check:'Сверить колонки отчёта и направление возвратов в настройках расчёта.',act:'Сверить баланс движения по «'+nm+'».',role:'acc',crit:'Баланс строки сходится в пределах допуска.'}));
    }
    if(e.actual!==null&&e.book!==null&&pr!==null){
      var dd=Math.abs(e.book-e.actual),mxk=Math.max(Math.abs(e.book),Math.abs(e.actual));
      if(mxk>0&&dd/mxk*100>=t.calcDiff&&dd*pr>=t.unexRub){
        F.push(fcF('R8','cmp:'+id,nm,'hyp',{
          title:'Учётный и фактический расход расходятся: '+nm,
          sit:'Учётный расход «'+nm+'» '+fcKgT(e.book)+', фактический по ревизиям '+fcKgT(e.actual)+': разница '+fcKgT(dd)+' ('+fcPctT(dd/mxk*100)+', '+fcRubT(dd*pr)+'). Возможна ошибка учёта между ревизиями или различие в датах.',
          ev:[{l:'Учётный расход',v:fcKgT(e.book),f:'по движению товаров',src:e.mv.src},{l:'Фактический расход',v:fcKgT(e.actual),f:e.actualNote,src:e.rv.src}],
          eff:{k:'acc',rub:null,g:'acc:'+id,note:'исправление учёта'},
          causes:['Операции между ревизиями не оформлены','Даты ревизий не совпадают с границами периода','Ошибка ввода количества'],check:'Сверить даты ревизий и движение между ними.',act:'Сверить даты и документы по «'+nm+'».',role:'acc',crit:'Расхождение учёта и факта объяснено документами.'}));
      }
    }
  });
  /* R11: литры без плотности — строки не вошли в расчёт; R12: фактический расход не определён из-за перемещений и возвратов */
  Object.keys(res.dens).sort().forEach(function(id){
    var d=res.dens[id];
    F.push(fcF('R11',id,d.nm,'hyp',{
      title:'Литры без плотности: '+d.nm,
      sit:'Строки «'+d.nm+'» в литрах или миллилитрах ('+d.n+' шт.) не вошли в расчёт: плотность не задана, допущение «1 л = 1 кг» не принято.',
      ev:[{l:'Строк вне расчёта',v:String(d.n),f:'единица л/мл, плотность сырья не задана',src:[]}],
      eff:{k:'acc',rub:null,g:'dens:'+id,note:'уточнение единиц; без плотности объём не переводится в килограммы'},
      causes:['Не задана плотность сырья','Допущение 1 л = 1 кг не подтверждено'],check:'Ввести плотность в карточке сырья либо принять допущение 1 л = 1 кг осознанно.',
      act:'Ввести плотность для «'+d.nm+'» или принять допущение 1 л = 1 кг.',role:'tech',crit:'Плотность введена или допущение принято, строки вошли в расчёт.'}));
  });
  (res.transMiss||[]).slice().sort().forEach(function(nm){
    F.push(fcF('R12','tr:'+nm,nm,'hyp',{
      title:'Нет перемещений и возвратов: '+nm,
      sit:'Фактический расход «'+nm+'» по ревизиям не определён: нет данных о перемещениях и возвратах поставщику за период между ревизиями.',
      ev:[{l:'Причина',v:'нет данных',f:'отчёт «Движение товаров» не покрывает период или в нём нет колонок перемещений и возвратов',src:[]}],
      eff:{k:'acc',rub:null,g:'tr:'+nm,note:'без перемещений и возвратов фактический расход искажён'},
      causes:['Не загружено движение товаров','В отчёте нет колонок перемещений и возвратов'],check:'Загрузить движение товаров за период между ревизиями с колонками перемещений и возвратов.',
      act:'Загрузить движение товаров с перемещениями и возвратами по «'+nm+'».',role:'tech',crit:'Фактический расход по «'+nm+'» определён.'}));
  });
  /* блюда */
  dids.forEach(function(rid){
    var d=res.dishes[rid],nm=d.name,tot=d.sold+d.wo+d.wi;
    if(d.wo>=t.woQty&&tot>0&&d.wo/(d.sold+d.wo)*100>=t.woPct){
      var cr=d.cost?d.wo*d.cost:null;
      F.push(fcF('R3','dish:'+rid,nm,'fact',{
        title:'Высокие списания готового блюда: '+nm,
        sit:'Списано '+fcSp(d.wo,1)+' порций «'+nm+'» при продаже '+fcSp(d.sold,1)+' ('+fcPctT(d.wo/(d.sold+d.wo)*100)+' от продаж и списаний)'+(cr!==null?'; сырьевая стоимость списанного '+fcRubT(cr)+' по ТТК и текущим ценам базы':'')+'.',
        ev:[{l:'Списано порций',v:fcSp(d.wo,1),f:'Σ списаний готового блюда',src:d.woSrc},{l:'Продано порций',v:fcSp(d.sold,1),f:'Σ продаж минус возвраты',src:d.src}],
        eff:{k:'pot',m:'dwo',dish:rid,ings:fcDishIngs(d),ik:fcDishKg(d),pw:d.wo,rub:cr,g:'dwo:'+rid,note:'сырьевая стоимость списанного; часть списаний неизбежна'},
        causes:['Выпуск превышает спрос по дням недели','Брак при приготовлении','Остатки в конце смены'],check:'Сравнить выпуск и продажи по дням недели, причины списаний.',
        act:'Скорректировать выпуск «'+nm+'» по дням недели.',role:'chef',crit:'Доля списаний «'+nm+'» ниже '+fcPctT(t.woPct)+' за сопоставимый период.'}));
    }
    if(d.out>0&&tot>=0){
      var gp=Math.abs(d.out-tot);
      if(gp>=t.woQty&&gp/d.out*100>=t.outGap){
        F.push(fcF('R8','out:'+rid,nm,'hyp',{
          title:'Выпуск не сходится с продажами и списаниями: '+nm,
          sit:'Выпуск «'+nm+'» '+fcSp(d.out,1)+' порций, продажи+списания+внутреннее потребление '+fcSp(tot,1)+': расхождение '+fcSp(gp,1)+' ('+fcPctT(gp/d.out*100)+'). Возможно, учёт выпуска ненадёжен.',
          ev:[{l:'Выпуск',v:fcSp(d.out,1),f:'Σ отчёта «Фактический выпуск»',src:d.outSrc||[]},{l:'Продажи + списания + внутреннее',v:fcSp(tot,1),f:'Σ порций',src:d.src}],
          eff:{k:'acc',rub:null,g:'acc:'+rid,note:'уточнение учёта выпуска'},
          causes:['Остатки готовых блюд не учтены','Выпуск оформляется не по факту','Продажи неполные'],check:'Сверить выпуск, остаток готовых блюд и кассовые данные.',act:'Сверить учёт выпуска «'+nm+'».',role:'chef',crit:'Выпуск, продажи и списания сходятся в пределах '+fcPctT(t.outGap)+'.'}));
      }
    }
    if(d.cost&&d.sold>0&&d.rev>0&&res.rev.rev>0){
      var pp=d.rev/d.sold,sh=d.cost/pp*100,rs=d.rev/res.rev.rev*100;
      if(sh>=t.rawShare&&rs>=t.salesShare){
        var ex=(sh-t.rawShare)/100*d.rev;
        F.push(fcF('R7',rid,nm,res.thIncomplete.indexOf(nm)>=0||!d.rk.ok?'hyp':'fact',{
          title:'Высокая доля сырья в блюде: '+nm,
          sit:'Доля сырья по рецептуре в «'+nm+'» '+fcPctT(sh)+' ('+fcSp(d.cost,2)+' ₽ сырья на порцию при средней цене продажи '+fcSp(pp,2)+' ₽), доля в выручке '+fcPctT(rs)+'. Это рецептурная доля по текущим ценам базы, не фактический фудкост.',
          ev:[{l:'Сырьё на порцию по ТТК',v:fcSp(d.cost,2)+' ₽',f:'Σ расход сырья × цена базы',src:[]},{l:'Средняя цена продажи',v:fcSp(pp,2)+' ₽',f:'выручка ÷ проданные порции',src:d.src}],
          eff:{k:'pot',m:'dshare',dish:rid,ings:fcDishIngs(d),dc:d.sold>0?ex/d.sold:0,rub:ex,g:'dshare:'+rid,note:'оценка при снижении доли до порога '+fcPctT(t.rawShare)+'; изменения рецептуры и выхода согласует технолог'},
          causes:['Цена продажи не пересмотрена после роста закупок','Завышенная закладка в ТТК','Высокая цена основного сырья'],check:'Сверить цену продажи с затратами, проверить закладку и поставщика основного сырья.',
          act:'Пересмотреть цену или состав «'+nm+'»; изменение рецептуры, выхода или качества согласует технолог.',role:'tech',appr:true,crit:'Доля сырья по рецептуре «'+nm+'» ниже порога '+fcPctT(t.rawShare)+' либо решение зафиксировано.'}));
      }
    }
  });
  /* данные */
  var um=Object.keys(res.unmatched).sort();
  if(um.length){
    F.push(fcF('R9','unmatched','Несопоставленные позиции','fact',{
      title:'Несопоставленные позиции отчётов',
      sit:'В отчётах '+um.length+' позиций не сопоставлены с базой или сопоставление не подтверждено; они не вошли в расчёт: '+um.slice(0,8).map(function(k){return'«'+res.unmatched[k].nm+'» ('+res.unmatched[k].n+')';}).join(', ')+(um.length>8?' и ещё '+(um.length-8):'')+'.',
      ev:[{l:'Позиций без сопоставления',v:String(um.length),f:'число различных позиций отчётов',src:[]}],eff:{k:'acc',rub:null,g:'acc:data',note:'полнота данных'},
      causes:['Новая номенклатура','Другое название в отчёте'],check:'Открыть раздел «Данные», подтвердить сопоставление или пропустить позицию.',act:'Подтвердить сопоставление позиций отчётов с базой.',role:'tech',crit:'Нет позиций без подтверждённого сопоставления.'}));
  }
  if(res.thIncomplete.length){
    F.push(fcF('R9','ttk','ТТК рассчитаны не полностью','fact',{
      title:'Неполные ТТК проданных блюд',
      sit:'У '+res.thIncomplete.length+' проданных блюд ТТК рассчитана не полностью: '+res.thIncomplete.slice(0,6).join('; ')+(res.thIncomplete.length>6?' и ещё '+(res.thIncomplete.length-6):'')+'. Теоретический расход занижен.',
      ev:[{l:'Блюд с неполной ТТК',v:String(res.thIncomplete.length),f:'нет выхода, привязки сырья или цены',src:[]}],eff:{k:'acc',rub:null,g:'acc:data',note:'полнота данных'},
      causes:['Сырьё не привязано к базе','У сырья нет цены','Не указан выход'],check:'Открыть карты блюд и завершить привязку сырья и цен.',act:'Завершить привязку сырья и цен в ТТК проданных блюд.',role:'tech',crit:'Все проданные блюда рассчитаны полностью.'}));
  }
  if(!res.basis.ok){
    var nob=!res.cfg.vatP||!res.cfg.vatS,vt=res.vat||{};
    F.push(fcF('R9','vat','Основа НДС','fact',{
      title:nob?'Не задана основа НДС закупок и выручки':(vt.none?'Часть закупок не приведена к основе НДС':'Закупки приведены к основе НДС приближённо'),
      sit:nob?'Не указано, с НДС или без НДС даны закупочные цены и выручка. Доли фудкоста приблизительные до выбора основы.'
        :(vt.none?'У '+vt.none+' строк поступлений нет ставки и суммы НДС, а приближение по единой ставке не подтверждено: эти строки не приведены, доли фудкоста приблизительные.'
        :'У '+vt.approx+' строк поступлений нет ставки и суммы НДС: приведение выполнено по единой ставке '+res.cfg.rate+'% по вашему подтверждению. Результат приблизительный, не точный.'),
      ev:[{l:'Основа НДС',v:res.basis.txt,f:'настройка расчёта и колонки НДС в поступлениях',src:[]},{l:'Строк приведено по сумме / по ставке / по единой ставке / не приведено',v:(vt.amt||0)+' / '+(vt.rate||0)+' / '+(vt.approx||0)+' / '+(vt.none||0),f:'счётчики приведения',src:[]}],eff:{k:'acc',rub:null,g:'acc:data',note:'полнота данных'},
      causes:nob?['Настройка не заполнена']:['В выгрузке поступлений нет колонок «Ставка НДС» или «Сумма НДС»','Закупки и выручка даны в разной основе'],check:'Запросить выгрузку поступлений со ставкой или суммой НДС либо выровнять основу закупок и выручки.',act:nob?'Задать основу НДС в настройках расчёта.':'Загрузить поступления со ставкой или суммой НДС либо согласовать основу отчётов.',role:'acc',crit:'Все строки приведены по ставке или сумме НДС, либо основа закупок и выручки совпадает.'}));
  }
  return F;
}
/* приоритет: фиксированная методика v1 */
function fcPriority(f){
  var rub=f.eff&&f.eff.rub!==null?f.eff.rub:null,tier=rub===null?0:(rub>=50000?3:(rub>=10000?2:(rub>=2000?1:0))),w=FC_RW[f.rule]||1,sc=tier*10+(f.st==='fact'?5:0)+w;
  var lv=sc>=25?'Высокий':(sc>=14?'Средний':'Низкий');
  return{score:sc,level:lv,days:lv==='Высокий'?7:(lv==='Средний'?14:30),
    why:'Баллы: размер эффекта '+(rub===null?'не определён (0)':fcRubT(rub)+' → '+tier*10)+'; '+(f.st==='fact'?'подтверждённый факт (+5)':'гипотеза (+0)')+'; вес правила '+w+'. Итого '+sc+': высокий от 25, средний от 14.'};
}
function fcPlanItems(res){
  var F=fcRules(res),items=F.map(function(f){
    var p=fcPriority(f),mid='m_'+fcH(f.rule+'|'+res.obj+'|'+f.key);
    return{id:mid,rule:f.rule,key:f.key,subj:f.subj,title:f.title,st:f.st,sit:f.sit,
      ev:f.ev.map(function(x){return{l:x.l,v:x.v,f:x.f,src:fcRefs(x.src,6).map(fcSrcText),n:(x.src||[]).length};}),
      causes:f.causes,check:f.check,act:f.act,role:f.role,appr:!!f.appr,crit:f.crit,pri:p.level,score:p.score,why:p.why,days:p.days,
      eff:f.eff?{ik:f.eff.ik,k:f.eff.k,rub:f.eff.rub===null?null:Math.round(f.eff.rub*100)/100,g:f.eff.g,note:f.eff.note,m:f.eff.m,ing:f.eff.ing,dish:f.eff.dish,ings:f.eff.ings,kg:f.eff.kg,kb:f.eff.kb,pw:f.eff.pw,dc:f.eff.dc}:null,
      hyp:f.st==='hyp'};
  });
  items.sort(function(a,b){return b.score-a.score||((b.eff&&b.eff.rub!==null?b.eff.rub:-1)-(a.eff&&a.eff.rub!==null?a.eff.rub:-1))||(a.id<b.id?-1:(a.id>b.id?1:0));});
  return items;
}
/* сырьё блюда: идентификаторы позиций, входящих в расчёт его ТТК */
function fcDishKg(d){var o={};if(d&&d.rk&&d.rk.kg)Object.keys(d.rk.kg).sort().forEach(function(k){o[k]=Math.round(d.rk.kg[k]*1e6)/1e6;});return o;}
function fcDishIngs(d){return d&&d.rk&&d.rk.kg?Object.keys(d.rk.kg).sort():[];}
/* ЭФФЕКТЫ. Суммировать всё подряд нельзя: мероприятия делятся по тому, какой объём сырья они затрагивают.
   • потеря сырья (необъяснённый расход, расход по учёту, недостача) — один физический объём, оценки взаимозаменяемы: берётся наибольшая;
   • документированные списания сырья — другой объём (в необъяснённый расход не входят): складываются с потерей;
   • цена закупки (рост цены, разброс поставщиков) — два способа снизить одну цену: берётся наибольший;
   • потеря × цена: килограммы потери входят и в экономию на потере, и в экономию на цене — вычитается пересечение (кг × снижение цены за кг);
   • блюдо: списанные порции и избыточная доля сырья — разные порции: складываются, пересечение по себестоимости вычитается;
   • списанные порции × цена сырья блюда: пересечение (кг сырья в списанных порциях × снижение цены за кг) вычитается;
   • доля сырья блюда × цена его сырья: способ снижения доли (цена продажи, рецептура, закупка) не задан, пересечение не определить — такие мероприятия не суммируются, показываются отдельными оценками и в итог не входят. */
function fcEffects(items){
  var P=items.filter(function(i){return i.eff&&i.eff.k==='pot'&&i.eff.rub!==null;}),N=P.length;
  var ING={},DSH={},par={};
  function ig(i){return ING[i]||(ING[i]={loss:null,wo:null,price:null});}
  function dg(d){return DSH[d]||(DSH[d]={dwo:null,dsh:null});}
  function mx(cur,i){return(!cur||i.eff.rub>cur.eff.rub)?i:cur;}
  P.forEach(function(i){var e=i.eff;
    if(e.m==='wo')ig(e.ing).wo=mx(ig(e.ing).wo,i);
    else if(e.m==='price')ig(e.ing).price=mx(ig(e.ing).price,i);
    else if(e.m==='dwo')dg(e.dish).dwo=mx(dg(e.dish).dwo,i);
    else if(e.m==='dshare')dg(e.dish).dsh=mx(dg(e.dish).dsh,i);
    else ig(e.ing||e.g).loss=mx(ig(e.ing||e.g).loss,i);     /* потеря; неизвестный вид — как потеря: наибольшая оценка */
  });
  function fd(x){while(par[x]!==x){par[x]=par[par[x]];x=par[x];}return x;}function un(a,b){a=fd(a);b=fd(b);if(a!==b)par[a]=b;}
  /* связи «доля сырья блюда × цена сырья»: пересечение не определяется */
  var edges=[];
  Object.keys(DSH).forEach(function(d){var g=DSH[d];if(!g.dsh)return;(g.dsh.eff.ings||[]).forEach(function(x){if(ING[x]&&ING[x].price)edges.push([d,x]);});});
  var undI={},undD={};
  edges.forEach(function(e){par['d:'+e[0]]=par['d:'+e[0]]||'d:'+e[0];par['i:'+e[1]]=par['i:'+e[1]]||'i:'+e[1];un('d:'+e[0],'i:'+e[1]);undD[e[0]]=1;undI[e[1]]=1;});
  var und=[],groups=[],tot=0,det=0,cl={};
  Object.keys(par).forEach(function(n){var r=fd(n);(cl[r]=cl[r]||[]).push(n);});
  Object.keys(cl).sort().forEach(function(r){
    var its=[],names=[];
    cl[r].sort().forEach(function(n){
      if(n.charAt(0)==='i'){var g=ING[n.slice(2)];if(g.price)its.push(g.price);}
      else{var h=DSH[n.slice(2)];if(h.dsh)its.push(h.dsh);}
    });
    its.forEach(function(i){var nm=i.subj||i.title;if(names.indexOf(nm)<0)names.push(nm);});
    und.push({key:r,name:names.join(', '),ids:its.map(function(i){return i.id;}),est:its.map(function(i){return{id:i.id,title:i.title,rub:i.eff.rub};}),
      why:'мероприятие по доле сырья в блюде и мероприятие по цене закупки его сырья затрагивают один объём сырья; способ снижения доли не задан, пересечение определить нельзя'});
    groups.push({key:r,name:names.join(', '),ids:its.map(function(i){return i.id;}),det:false,tot:null,how:'не суммируется, отдельные оценки: '+its.map(function(i){return fcRubT(i.eff.rub);}).join(', ')});
  });
  /* определяемая часть */
  var ingDone={};
  Object.keys(ING).sort().forEach(function(k){
    var g=ING[k],t=0,how=[],pr=undI[k]?null:g.price,loss=g.loss?g.loss.eff:null,wo=g.wo?g.wo.eff:null,ids=[];
    if(loss){t+=loss.rub;ids.push(g.loss.id);how.push('потеря '+fcRubT(loss.rub)+' (наибольшая из оценок одного объёма)');}
    if(wo){t+=wo.rub;ids.push(g.wo.id);how.push('списания '+fcRubT(wo.rub));}
    if(pr){var pe=pr.eff;t+=pe.rub;ids.push(pr.id);how.push('цена '+fcRubT(pe.rub)+' (наибольшая из оценок одной цены)');
      var lk=(loss&&loss.kg>0?loss.kg:0)+(wo&&wo.kg>0?wo.kg:0);
      if(lk>0&&pe.kb>0){var c1=Math.min(lk/pe.kb,1)*pe.rub;t-=c1;how.push('минус пересечение потери и цены '+fcRubT(c1));}
      /* списанные порции блюд, использующих это сырьё */
      Object.keys(DSH).sort().forEach(function(d){var h=DSH[d];if(!h.dwo)return;var ik=(h.dwo.eff.ik||{})[k];if(ik>0&&pe.kb>0){var c3=Math.min(h.dwo.eff.pw*ik/pe.kb,1)*pe.rub;t-=c3;how.push('минус пересечение цены и списанных порций «'+(h.dwo.subj||h.dwo.title)+'» '+fcRubT(c3));}});
    }
    if(!ids.length)return;
    if(t<0)t=0;tot+=t;det++;
    var nm=((g.loss||g.wo||g.price).subj)||k;
    groups.push({key:'i:'+k,name:nm,ids:ids,det:true,tot:Math.round(t*100)/100,how:how.join('; ')});
  });
  Object.keys(DSH).sort().forEach(function(d){
    var h=DSH[d],t=0,how=[],ids=[],dwo=h.dwo?h.dwo.eff:null,dsh=(!undD[d]&&h.dsh)?h.dsh.eff:null;
    if(dwo){t+=dwo.rub;ids.push(h.dwo.id);how.push('списанные порции '+fcRubT(dwo.rub));}
    if(dsh){t+=dsh.rub;ids.push(h.dsh.id);how.push('доля сырья '+fcRubT(dsh.rub));
      if(dwo&&dwo.pw>0&&dsh.dc>0){var c2=dwo.pw*dsh.dc;t-=c2;how.push('минус пересечение списанных порций и снижения себестоимости '+fcRubT(c2));}}
    if(!ids.length)return;
    if(t<0)t=0;tot+=t;det++;
    groups.push({key:'d:'+d,name:((h.dwo||h.dsh).subj)||d,ids:ids,det:true,tot:Math.round(t*100)/100,how:how.join('; ')});
  });
  return{pot:Math.round(tot*100)/100,groups:det,items:N,und:und,groupsInfo:groups,partial:und.length>0,
    note:und.length?'В сумму не вошли '+und.length+' групп: мероприятия по доле сырья в блюде и по цене его сырья затрагивают один объём сырья, пересечение определить нельзя. Их оценки показаны отдельно, суммарная экономия по ним не обещается.':''};
}
/* ---------- отпечаток входных данных ---------- */
function fcFp(res){
  var P={},ops=FC_TYPES_KEYS.map(function(t){return t+':'+fcOps(t,res.obj,res.from,res.to).map(function(o){return o.id;}).sort().join(',');}).join('|');
  P.ops=fcH(ops);
  P.map=fcH(Object.keys(res.ings).sort().join(',')+'|'+Object.keys(res.dishes).sort().join(',')+'|'+Object.keys(res.unmatched).sort().join(','));
  P.ttk=fcH(Object.keys(res.dishes).sort().map(function(r){var d=res.dishes[r],k=d.rk;return r+':'+(k?JSON.stringify([k.cost,k.ok,k.output,Object.keys(k.kg).sort().map(function(i){return[i,k.kg[i]];})]):'-');}).join('|'));
  P.prices=fcH(Object.keys(res.ings).sort().map(function(i){var e=res.ings[i];return[i,e.basePrice,e.actPriceRaw,Object.keys(e.flags).sort().join(',')].join(':');}).join('|')+'|'+res.priceMode+'|'+res.recSource);
  P.cfg=fcH(JSON.stringify(fcCanon(res.cfg)));
  P.algo=FC_ALGO+'.'+FC_RULES_VER;
  return{fp:fcH(P.ops+P.map+P.ttk+P.prices+P.cfg+P.algo+res.obj+res.from+res.to+res.region),parts:P};
}
function fcCanon(o){if(Array.isArray(o))return o.map(fcCanon);if(o&&typeof o==='object'){var r={};Object.keys(o).sort().forEach(function(k){r[k]=fcCanon(o[k]);});return r;}return o;}
var FC_PARTS={ops:'изменились данные отчётов',map:'изменились сопоставления номенклатуры',ttk:'изменились ТТК проданных блюд',prices:'изменились цены',cfg:'изменены настройки расчёта и пороги',algo:'изменилась версия правил или алгоритма'};
/* ---------- план: версии, состояние ---------- */
function fcPlanId(obj,from,to){return'p_'+fcH(obj+'|'+from+'|'+to);}
function fcPlanOf(obj,from,to){return S.fc.plans[fcPlanId(obj,from,to)]||null;}
function fcAddDays(iso,n){return fcDay(iso,n);}
function fcDiff(prev,cur,pParts,cParts){
  var out=[],pm={},cm={};
  if(!prev)return['Первая версия плана.'];
  Object.keys(FC_PARTS).forEach(function(k){if(pParts&&pParts[k]!==cParts[k])out.push('Причина: '+FC_PARTS[k]+'.');});
  prev.forEach(function(i){pm[i.id]=i;});cur.forEach(function(i){cm[i.id]=i;});
  cur.forEach(function(i){
    var p=pm[i.id];
    if(!p){out.push('Новое: '+i.title+' (приоритет '+i.pri.toLowerCase()+').');return;}
    var ch=[];
    if(p.pri!==i.pri)ch.push('приоритет '+p.pri.toLowerCase()+' → '+i.pri.toLowerCase());
    if(p.st!==i.st)ch.push('статус основания '+(p.st==='fact'?'факт':'гипотеза')+' → '+(i.st==='fact'?'факт':'гипотеза'));
    var pr=p.eff&&p.eff.rub,cr=i.eff&&i.eff.rub;
    if(pr!==cr)ch.push('эффект '+fcRubT(pr===undefined?null:pr)+' → '+fcRubT(cr===undefined?null:cr));
    if(p.sit!==i.sit&&!ch.length)ch.push('изменились показатели');
    if(ch.length)out.push('Изменено: '+i.title+': '+ch.join('; ')+'.');
  });
  prev.forEach(function(p){if(!cm[p.id])out.push('Больше не выявляется: '+p.title+'.');});
  if(!out.length)out.push('Состав и значения мероприятий не изменились.');
  return out;
}
function fcMetricsTxt(res){
  var o=[];
  res.metrics.forEach(function(m){
    var v=m.value===null?'не определено':(m.unit==='%'?fcPctT(m.value):fcRubT(m.value));
    o.push({id:m.id,l:m.label,v:v,f:m.formula,note:m.note,n:m.src.length,src:fcRefs(m.src,6).map(fcSrcText)});
  });
  return o;
}
function fcStFix(pl,items){
  var o={};
  items.forEach(function(it){var s=pl.state[it.id];if(s)o[it.id]=fcClone({asg:s.asg||null,due:s.due||'',dueSug:s.dueSug||'',st:s.st,cm:s.cm||[],hist:s.hist||[],result:s.result||'',real:s.real===undefined?null:s.real});});
  return o;
}
function fcNewState(it,at){return{asg:null,due:'',dueSug:fcAddDays(at,it.days),st:'new',cm:[],hist:[],result:'',real:null};}
/* построить (или вернуть сохранённую) версию плана; force — пересчёт по новым правилам. Возвращает {plan,created,why} */
function fcPlanBuild(obj,from,to,force){
  var cfg=fcCfg(),res=fcCalc(obj,from,to,cfg),fp=fcFp(res),id=fcPlanId(obj,from,to),pl=S.fc.plans[id],last,at=fcToday(),items,v,prev,fu={},sn;
  if(!pl){pl=S.fc.plans[id]={id:id,obj:obj,objName:(S.fc.sel&&S.fc.sel.objName)||obj,from:from,to:to,createdAt:at,versions:[],state:{}};}
  last=pl.versions[pl.versions.length-1];
  if(last&&last.fp===fp.fp)return{plan:pl,created:false,why:'same'};
  items=fcPlanItems(res);
  v={n:last?last.n+1:1,at:at,fp:fp.fp,parts:fp.parts,algo:FC_ALGO,rules:FC_RULES_VER,cfg:fcCanon(cfg),items:items,metrics:fcMetricsTxt(res),limits:res.limits.slice(),exact:res.exact,exactWhy:res.exactWhy.slice(),
    eff:fcEffects(items),pm:res.priceMode==='receipts'?'цены закупок периода':'текущие цены базы региона',ttkNote:res.ver.ttk,basis:res.basis.txt,rev:res.revNet,region:res.region};
  prev=last?last.items:null;
  v.diff=fcDiff(prev,items,last&&last.parts,fp.parts);
  if(last){
    last.items.forEach(function(p){
      var s=pl.state[p.id];
      if(s&&(s.st==='done'||s.st==='checked')){
        var now=items.filter(function(i){return i.id===p.id;})[0];
        fu[p.id]=now?'Проверка по новым данным: ситуация выявляется снова. '+now.sit.slice(0,160):'Проверка по новым данным: ситуация больше не выявляется.';
      }
    });
  }
  v.followup=fu;
  items.forEach(function(it){if(!pl.state[it.id])pl.state[it.id]=fcNewState(it,at);});
  /* состояние мероприятий на момент фиксации версии: дальнейшие правки ответственных, сроков и статусов этот документ не меняют */
  v.stFix=fcStFix(pl,items);
  v.stFixAt=at;
  sn=fcSnapMake(res,cfg);v.snapInfo=sn.info;v.snapWarn=sn.snap.warn;
  pl.reg=pl.reg||String(res.region||'').split(':')[0];
  pl.versions.push(v);
  fcSnapSave(pl.id,v.n,sn.snap);
  fcPut('plans');
  return{plan:pl,created:true,why:last?'new':'first'};
}
/* ---------- модель для экрана и всех выгрузок ---------- */
function fcAsgTxt(a){return!a?'Ответственный не назначен':(a.t==='manual'?a.name+' (участник вне приложения, доступа не имеет)':a.name);}
var FC_MODES={fixed:'Зафиксированная версия',current:'С текущим состоянием выполнения'};
/* mode: fixed — ответственные, сроки и статусы на момент фиксации версии; current — как сейчас. По умолчанию: последняя версия — текущее, прежние — зафиксированное. */
function fcPlanModel(pl,vn,mode){
  var v=pl.versions.filter(function(x){return x.n===vn;})[0]||pl.versions[pl.versions.length-1],isLast,fixOk,src,stDate,modeTxt,stNote='';
  if(!v)return null;
  isLast=v===pl.versions[pl.versions.length-1];
  if(mode!=='fixed'&&mode!=='current')mode=isLast?'current':'fixed';
  fixOk=!!v.stFix;
  if(mode==='fixed'&&!fixOk){mode='current';stNote='Состояние мероприятий на момент фиксации этой версии не сохранено (версия построена до его записи): показано текущее состояние.';}
  src=mode==='fixed'?v.stFix:pl.state;
  stDate=mode==='fixed'?(v.stFixAt||v.at):fcToday();
  modeTxt=mode==='fixed'?'Зафиксированная версия: ответственные, сроки, статусы и комментарии на момент фиксации версии '+fcIsoRu(stDate)+'. Дальнейшие изменения выполнения в этот документ не входят.'
    :'С текущим состоянием выполнения: ответственные, сроки, статусы и комментарии на '+fcIsoRu(stDate)+'. Состав мероприятий, показатели и расчёт — как в зафиксированной версии.';
  var m={planId:pl.id,ver:v.n,vers:pl.versions.length,title:'План мероприятий по фудкосту',obj:pl.objName,period:fcIsoRu(pl.from)+' – '+fcIsoRu(pl.to),verTxt:'версия '+v.n+' от '+fcIsoRu(v.at),at:v.at,created:fcIsoRu(pl.createdAt),fp:v.fp,algo:'алгоритм '+v.algo+', правила '+v.rules,
    price:v.pm,ttk:v.ttkNote,basis:v.basis,exact:v.exact,exactWhy:v.exactWhy,limits:v.limits,metrics:v.metrics,diff:v.diff,eff:v.eff,items:[],stale:[],mode:mode,modeName:FC_MODES[mode],modeTxt:modeTxt,stDate:fcIsoRu(stDate),stNote:stNote,snap:v.snapInfo||null,snapWarn:v.snapWarn||'',latest:isLast};
  v.items.forEach(function(it,ix){
    var s=src[it.id]||fcNewState(it,v.at);
    var effT=it.eff?FC_EFK[it.eff.k]+': '+(it.eff.rub===null?'сумма не определена':fcRubT(it.eff.rub))+'. '+it.eff.note+'.':'';
    var cm=(s.cm||[]).map(function(c){return fcIsoRu(c.at)+(c.by?', '+c.by:'')+': '+c.t;});
    m.items.push({n:ix+1,id:it.id,title:it.title,basis:it.st==='fact'?'Подтверждённый факт':'Гипотеза',hyp:it.hyp,sit:it.sit,
      ev:it.ev.map(function(e){return e.l+': '+e.v+(e.f?' (расчёт: '+e.f+')':'');}),src:it.ev.reduce(function(a,e){return a.concat(e.src);},[]),
      causes:it.causes,check:it.check,act:it.act+(it.appr?' Изменение рецептуры, выхода или качества — только по согласованию технолога.':''),
      pri:it.pri,why:it.why,role:FC_ROLES[it.role],asg:fcAsgTxt(s.asg),due:(s.due||s.dueSug)?fcIsoRu(s.due||s.dueSug)+(s.due?' (выбран пользователем)':' (предложен: дата версии + '+it.days+' дн.)'):'не назначен',
      st:FC_ST[s.st]||s.st,eff:effT,assume:it.eff?it.eff.note:'',crit:it.crit,cm:cm,hist:(s.hist||[]).map(function(h){return fcIsoRu(h.at)+(h.by?', '+h.by:'')+': '+h.t;}),result:s.result||'',real:s.real,fu:(v.followup||{})[it.id]||''});
  });
  var inV={};v.items.forEach(function(i){inV[i.id]=1;});
  var lastV=pl.versions[pl.versions.length-1];
  if(v===lastV&&mode==='current'){
    var seen={};pl.versions.forEach(function(x){x.items.forEach(function(i){seen[i.id]=i;});});
    Object.keys(pl.state).sort().forEach(function(k){if(!inV[k]&&seen[k]&&pl.state[k].st!=='closed'&&pl.state[k].st!=='arch')m.stale.push({id:k,title:seen[k].title,asg:fcAsgTxt(pl.state[k].asg),st:FC_ST[pl.state[k].st]});});
  }
  return m;
}
/* таблица «ключ → значение» одного мероприятия: общая для экрана, Word, Excel и PDF */
function fcItemRows(i){
  var r=[['Основание',i.basis],['Ситуация',i.sit],['Подтверждающие показатели',i.ev.join('\n')],['Строки документов',i.src.length?i.src.join('\n'):'не привязаны к строкам (расчётный показатель)'],
    ['Возможные причины',i.causes.join('; ')],['Необходимая проверка',i.check],['Рекомендуемое действие',i.act],['Приоритет',i.pri+'. '+i.why],['Предлагаемая роль',i.role],
    ['Назначенный исполнитель',i.asg],['Срок',i.due],['Статус',i.st],['Ожидаемый эффект и допущения',i.eff],['Критерий выполнения',i.crit],
    ['Комментарии',i.cm.length?i.cm.join('\n'):'нет'],['История изменений',i.hist.length?i.hist.join('\n'):'нет'],['Результат последующей проверки',(i.result||'не внесён')+(i.real!==null&&i.real!==undefined?'\nПодтверждённое снижение затрат (внесено пользователем): '+fcRubT(i.real):'')+(i.fu?'\n'+i.fu:'')]];
  return r;
}
/* текст итога по эффектам и состава групп (экран, DOCX, XLSX, PDF) */
function fcEffHead(m){
  var e=m.eff;
  return fcRubT(e.pot)+' по '+e.groups+' группам с определяемым итогом'+(e.partial?'; ещё '+e.und.length+' групп без общего итога (отдельные оценки)':'')+'. Расчётная оценка, не гарантия.';
}
function fcEffGroupsText(m){
  var g=(m.eff.groupsInfo||[]).slice(0,14).map(function(x){return'• '+x.name+': '+x.how+(x.det?' → '+fcRubT(x.tot):'');});
  if((m.eff.groupsInfo||[]).length>14)g.push('… и ещё '+(m.eff.groupsInfo.length-14));
  return g.length?g.join('\n'):(m.eff.groupsInfo?'Мероприятий с денежной оценкой нет.':'Состав групп в этой версии не сохранён: она построена по прежнему правилу «наибольший эффект внутри группы». Для нового состава групп постройте новую версию.');
}
function fcModelNotes(m){
  var o=[];
  o.push('Гипотезы отмечены как «Гипотеза»: причина не доказана, требуется проверка.');
  o.push('Потенциальная экономия — расчётная оценка, не гарантия и не реальное снижение затрат. Одна потеря и одна цена учитываются один раз (берётся наибольшая оценка), пересечение потери и цены вычитается; мероприятия по цене сырья и по блюдам с общим сырьём не суммируются: показаны отдельные оценки.'+(m.eff.note?' '+m.eff.note:''));
  o.push(m.modeTxt);
  if(m.stNote)o.push(m.stNote);
  if(m.snap)o.push('Исходные данные версии сохранены: операций '+m.snap.n.ops+', рецептур '+m.snap.n.recs+', позиций сырья '+m.snap.n.ings+'. '+m.snapWarn);
  else o.push('Снимок исходных данных для этой версии не сохранён.');
  o.push('Результат не содержит выводов о виновности сотрудников. Изменение рецептуры, выхода или качества требует согласования технолога.');
  if(!m.exact)o.push('Итоги приблизительные: '+m.exactWhy.join('; ')+'.');
  return o;
}
