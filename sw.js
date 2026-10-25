/* Не на глазок: кеш приложения. Открытие из кеша без обращения к сети; новая версия скачивается в фоне и применяется по кнопке «Обновить» (или при следующем открытии). */
'use strict';
var BUILD='202610251549-0195632b05',CACHE='nng-'+BUILD,FONTS='nng-fonts';
var FILES=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable-512.png'];
self.addEventListener('install',function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(FILES.map(function(u){
      return fetch(new Request(u,{cache:'reload'})).then(function(r){if(!r.ok)throw new Error(u+' '+r.status);return c.put(u,r);});
    }));
  }));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){return k.indexOf('nng-')===0&&k!==CACHE&&k!==FONTS;}).map(function(k){return caches.delete(k);}));
  }).then(function(){return self.clients.claim();}));
});
self.addEventListener('message',function(e){if(e.data==='skip')self.skipWaiting();});
self.addEventListener('fetch',function(e){
  var r=e.request,u;
  if(r.method!=='GET')return;
  u=new URL(r.url);
  if(u.origin===location.origin){
    e.respondWith(caches.open(CACHE).then(function(c){
      return c.match(r.mode==='navigate'?'./':r,{ignoreSearch:true}).then(function(hit){return hit||fetch(r);});
    }));
    return;
  }
  /* шрифты Google: из кеша сразу, обновление в фоне; всё остальное (скрипт общей базы, Таблицы, Диск) идёт напрямую в сеть */
  if(u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com'){
    e.respondWith(caches.open(FONTS).then(function(c){
      return c.match(r).then(function(hit){
        var net=fetch(r).then(function(x){if(x&&(x.ok||x.type==='opaque'))c.put(r,x.clone());return x;},function(){return hit;});
        return hit||net;
      });
    }));
  }
});
