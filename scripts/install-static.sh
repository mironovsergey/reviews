#!/usr/bin/env bash
#
# Устанавливает статику консоли и виджета из образа без перерыва в работе.
#
#   scripts/install-static.sh <образ статики> <каталог сервиса>
#
# Образ собирается целью static из Dockerfile и содержит каталоги /console и
# /widget. Файлы подменяются переименованием в пределах одного диска, поэтому
# nginx ни в какой момент не отдает наполовину записанный файл:
#   - новые файлы консоли из assets/ добавляются к прежним, и только затем
#     заменяется index.html, который на них ссылается;
#   - файлы виджета заменяются по одному.
#
# Прежние файлы консоли остаются для вкладок, открытых до выкладки. Через
# неделю они удаляются, если на них не ссылается ни новая, ни прежняя
# index.html: прежняя может вернуться при откате выкладки.

set -euo pipefail

export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export LC_ALL=C

# Сколько дней хранятся файлы консоли, на которые больше ничто не ссылается.
ASSETS_MAX_AGE_DAYS=7

log() {
  printf '%s %s\n' "$(date '+%F %T')" "$*"
}

fail() {
  log "Ошибка: $*" >&2
  exit 1
}

[[ $# -eq 2 ]] || fail 'использование: install-static.sh <образ статики> <каталог сервиса>'

image=$1
app_dir=$2
console_dir="$app_dir/console"
widget_dir="$app_dir/widget"

[[ -d "$console_dir/assets" && -d "$widget_dir" ]] ||
  fail "в $app_dir нет каталогов console/assets и widget"

# Промежуточный каталог лежит рядом с целевыми: переименование атомарно
# только в пределах одной файловой системы.
staging=$(mktemp -d "$app_dir/.static.XXXXXX")
container=''

cleanup() {
  if [[ -n "$container" ]]; then
    docker rm -f "$container" >/dev/null 2>&1 || true
  fi

  rm -rf -- "$staging"
}

trap cleanup EXIT

# У образа нет ни оболочки, ни команды запуска. Контейнер только создается,
# чтобы скопировать из него файлы, и никогда не запускается: команда noop
# нужна лишь потому, что без команды контейнер не создается.
container=$(docker create "$image" noop) || fail "не удалось создать контейнер из образа $image"

docker cp "$container:/console" "$staging/console" >/dev/null &&
  docker cp "$container:/widget" "$staging/widget" >/dev/null ||
  fail "не удалось скопировать статику из образа $image"

[[ -s "$staging/console/index.html" && -s "$staging/widget/reviews-widget.js" ]] ||
  fail 'в образе нет index.html консоли или скрипта виджета'

# Имена файлов из assets/, на которые ссылается index.html.
referenced_assets() {
  grep -oE 'assets/[^"'"'"'?#) ]+' "$1" | sed 's#^assets/##' | sort -u
}

# Каждый файл, на который ссылается новая index.html, должен быть в образе:
# иначе после подмены консоль не загрузится.
while IFS= read -r asset; do
  [[ -f "$staging/console/assets/$asset" ]] || fail "index.html ссылается на отсутствующий файл assets/$asset"
done < <(referenced_assets "$staging/console/index.html")

# Ссылки прежней index.html запоминаются до подмены: эти файлы понадобятся,
# если выкладку придется откатить.
previous_referenced=''

if [[ -f "$console_dir/index.html" ]]; then
  previous_referenced=$(referenced_assets "$console_dir/index.html")
fi

# Файлы копируются без сохранения времени изменения: по нему считается
# срок хранения прежних файлов, и он должен отсчитываться от выкладки.
cp -- "$staging"/console/assets/* "$console_dir/assets/"

for file in "$staging"/console/*; do
  name=$(basename -- "$file")

  if [[ -f "$file" && "$name" != index.html ]]; then
    mv -f -- "$file" "$console_dir/$name"
  fi
done

mv -f -- "$staging/console/index.html" "$console_dir/index.html"
log 'Статика консоли установлена'

# Карта исходного кода заменяется раньше скрипта, на который она ссылается.
for file in "$staging"/widget/*.map "$staging"/widget/*; do
  if [[ -f "$file" ]]; then
    mv -f -- "$file" "$widget_dir/$(basename -- "$file")"
  fi
done

log 'Статика виджета установлена'

# Прежние файлы консоли удаляются, если на них не ссылается ни новая, ни
# прежняя index.html и они старше срока хранения. Карта исходного кода
# следует за своим файлом.
referenced=$(printf '%s\n%s\n' "$(referenced_assets "$console_dir/index.html")" "$previous_referenced")
removed=0

while IFS= read -r -d '' file; do
  name=$(basename -- "$file")

  if ! grep -qxF -- "${name%.map}" <<<"$referenced"; then
    rm -f -- "$file"
    removed=$((removed + 1))
  fi
done < <(find "$console_dir/assets" -type f -mtime "+$ASSETS_MAX_AGE_DAYS" -print0)

if ((removed > 0)); then
  log "Удалено прежних файлов консоли: $removed"
fi
