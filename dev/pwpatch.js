/* для регрессии: перед действием раскрывает «Дополнительные действия» меню, чтобы старые сценарии нажимали скрытые элементы */
try{
  const pw=require(process.env.PW_MODULE || 'playwright');
  const open=async function(page){try{await page.evaluate(()=>{document.querySelectorAll('details.mextra').forEach(d=>{d.open=true;});if(!window.__noSeg)document.documentElement.classList.add('seg-all-t');});}catch(e){}};
  const openTab=async(page,sel)=>{try{const m=/#(tab[A-Za-z0-9]+)/.exec(String(sel)),d=/data-tab=["']?([a-z0-9]+)/.exec(String(sel));if(!m&&!d)return;await page.evaluate(([id,dt])=>{var e=id?document.getElementById(id):document.querySelector('#tabs .tab[data-tab="'+dt+'"]'),n=document.getElementById('tabs');if(e&&n&&e.classList.contains('tab-over')&&innerWidth<1000)n.classList.add('more-open');},[m?m[1]:null,d?d[1]:null]);}catch(e){}};
  const wrapP=(proto,names,getPage)=>names.forEach(n=>{const f=proto[n];if(!f||f.__w)return;const w=async function(...a){await open(getPage(this));return f.apply(this,a);};w.__w=1;proto[n]=w;});
  const chromium=pw.chromium,orig=chromium.launch.bind(chromium);
  chromium.launch=async function(o){const b=await orig(o);const origCtx=b.newContext.bind(b);
    const patchPage=p=>{if(p.__p)return p;p.__p=1;const wf=p.waitForSelector.bind(p);p.waitForSelector=async(...a)=>{const t=setInterval(()=>open(p),150);try{return await wf(...a);}finally{clearInterval(t);}};const m=['click','fill','selectOption','check','uncheck','dblclick','press','type','hover','focus','tap'];m.forEach(n=>{const f=p[n].bind(p);p[n]=async(...a)=>{await open(p);if(n==='click')await openTab(p,a[0]);return f(...a);};});
      const lo=p.locator.bind(p);p.locator=(...a)=>{const l=lo(...a);return patchLoc(l,p);};return p;};
    const patchLoc=(l,p)=>{if(l.__p)return l;l.__p=1;['click','fill','selectOption','check','uncheck','dblclick','press','hover','focus'].forEach(n=>{const f=l[n].bind(l);l[n]=async(...a)=>{await open(p);if(n==='click')await openTab(p,String(l));return f(...a);};});['first','last','nth','locator','filter'].forEach(n=>{if(!l[n])return;const f=l[n].bind(l);l[n]=(...a)=>patchLoc(f(...a),p);});return l;};
    const wrapCtx=async o2=>{const c=await origCtx(o2);const np=c.newPage.bind(c);c.newPage=async()=>patchPage(await np());return c;};
    b.newContext=wrapCtx;const nb=b.newPage.bind(b);b.newPage=async o=>patchPage(await nb(o));return b;};
}catch(e){}
