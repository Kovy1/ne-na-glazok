import base64, json, sys
from fontTools import subset
from fontTools.ttLib import TTFont
SRC={'r':'/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf','b':'/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'}
U=list(range(0x20,0x7F))+list(range(0xA0,0x100))+list(range(0x400,0x460))+[0x2010,0x2011,0x2012,0x2013,0x2014,0x2018,0x2019,0x201C,0x201D,0x201E,0x2022,0x2026,0x2030,0x2116,0x20BD,0x2212,0x2248,0x2192,0x2264,0x2265,0x2260,0x00D7,0x2191,0x2193]
out={}
for k,p in SRC.items():
    opt=subset.Options(); opt.hinting=False; opt.layout_features=[]; opt.name_IDs=[1,2]; opt.notdef_outline=True; opt.glyph_names=False; opt.legacy_kern=False
    f=TTFont(p); s=subset.Subsetter(opt); s.populate(unicodes=U); s.subset(f)
    f.save('/tmp/sub_%s.ttf'%k)
    f=TTFont('/tmp/sub_%s.ttf'%k)
    cmap=f.getBestCmap(); hm=f['hmtx']; upm=f['head'].unitsPerEm; order=f.getGlyphOrder()
    gid={n:i for i,n in enumerate(order)}
    tri=[]
    for u,n in sorted(cmap.items()):
        tri.append([u,gid[n],round(hm[n][0]*1000/upm)])
    data=open('/tmp/sub_%s.ttf'%k,'rb').read()
    h=f['hhea']; os2=f['OS/2']
    out[k]={'b64':base64.b64encode(data).decode(),'m':tri,'upm':upm,'bbox':[round(f['head'].xMin*1000/upm),round(f['head'].yMin*1000/upm),round(f['head'].xMax*1000/upm),round(f['head'].yMax*1000/upm)],'asc':round(h.ascent*1000/upm),'desc':round(h.descent*1000/upm),'cap':round(getattr(os2,'sCapHeight',700)*1000/upm) or 700,'notdefw':round(hm[order[0]][0]*1000/upm),'len':len(data)}
js='/* Подмножество шрифта Liberation Sans (SIL Open Font License 1.1, © Red Hat): латиница, кириллица и знаки, нужные в плане. Встроено в PDF-файлы плана. Создано tools/mkfont.py. */\nvar FC_PDF_FONT='+json.dumps(out,separators=(',',':'))+';\n'
open('src/js/69-fc-pdffont.js','w',encoding='utf8').write(js)
print({k:(v['len'],len(v['m'])) for k,v in out.items()}, len(js))
