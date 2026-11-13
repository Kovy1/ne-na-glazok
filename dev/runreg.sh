#!/bin/bash
# Полный прогон: сборка тестовой страницы и все тесты из tests.list (или из файла LIST=...).
# Строка «имя rc=0 …» — тест пройден; подробности — out/reg/<имя>.log. Итог в конце: пройдено / всего.
cd "$(dirname "$0")" || exit 1
mkdir -p out/reg
[ -f sync/Code.gs ] || cp ../sync/Code.gs sync/Code.gs
# страница приложения 90 для проверки совместимости (из истории репозитория)
[ -f out/app90.html ] || git -C .. show 5392f60:index.html > out/app90.html 2>/dev/null || rm -f out/app90.html
python3 build.py --demo > /dev/null || { echo "сборка не удалась"; exit 1; }
ok=0; all=0
for t in $(cat "${LIST:-tests.list}"); do
  f=${t%.js}; f=$f.js
  [ -f "$f" ] || continue
  n=$(echo "$t" | tr '/' '_')
  timeout 240 node -r ./pwpatch.js "$f" > "out/reg/$n.log" 2>&1; rc=$?
  all=$((all+1)); [ $rc -eq 0 ] && ok=$((ok+1))
  echo "$t rc=$rc $(tail -1 "out/reg/$n.log" | cut -c1-150)"
done
echo "ИТОГО: пройдено $ok из $all"
