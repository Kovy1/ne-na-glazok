#!/usr/bin/env python3
"""Склейка исходников src/ в kbzhu.html (порядок файлов — в src/manifest.txt).
Встроенный скрипт общей базы в исходниках не хранится: его подставляет build.py из sync/Code.gs.
kbzhu.html — результат сборки: править нужно файлы в src/, иначе правки пропадут при следующей сборке."""
import os, re, sys
root = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(root, 'src')
out_path = os.path.join(root, 'kbzhu.html')
man = [x.strip() for x in open(os.path.join(src, 'manifest.txt'), encoding='utf-8') if x.strip()]
paths = [os.path.join(src, n) for n in man]
for p in paths:
    if not os.path.isfile(p): sys.exit('нет файла из manifest.txt: ' + p)
listed = set(man)
for d in ('css', 'html', 'js'):                       # файл лежит в src/, но в manifest.txt его нет: в сборку он не попадёт
    for n in sorted(os.listdir(os.path.join(src, d))):
        if d + '/' + n not in listed: sys.exit('файл src/%s/%s не указан в src/manifest.txt: добавьте его туда (порядок важен) или удалите' % (d, n))
out = ''.join(open(p, encoding='utf-8', newline='').read() for p in paths)
assert out.count('<script>') == 1 and out.count('/*GAS-START*/') == 1 and out.count('/*GAS-END*/') == 1, 'в склейке нарушены метки'
BLANK = re.compile(r'/\*GAS-START\*/var SY_GAS=.*?;/\*GAS-END\*/', re.S)
if os.path.exists(out_path):
    cur = open(out_path, encoding='utf-8', newline='').read()
    cur_blank = BLANK.sub('/*GAS-START*/var SY_GAS="";/*GAS-END*/', cur) if '/*GAS-START*/' in cur else cur
    newest_src = max(os.path.getmtime(p) for p in paths + [os.path.join(src, 'manifest.txt')])
    # kbzhu.html правили руками позже исходников: не затираем молча
    if cur_blank != out and os.path.getmtime(out_path) > newest_src + 1:
        sys.exit('kbzhu.html изменён вручную после последней правки в src/. Он собирается из src/, перенесите правку в нужный файл src/ '
                 '(или удалите kbzhu.html, если правка не нужна) и запустите сборку снова.')
open(out_path, 'w', encoding='utf-8', newline='').write(out)
print('собрано: kbzhu.html из %d файлов' % len(man))
