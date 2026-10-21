#!/usr/bin/env bash
#
# Выгрузка базы отзывов в сжатый архив с проверкой и ротацией.
#
# Запускается на сервере по расписанию и вручную перед выкладкой (см. README,
# раздел «Резервное копирование базы»). Учетные данные базы скрипту не нужны:
# mongodump выполняется внутри контейнера и берет их из его же переменных
# окружения.
#
# Настройки задаются переменными окружения:
#   BACKUP_DIR       каталог архивов, по умолчанию ~/backups/reviews
#   BACKUP_KEEP      сколько последних архивов хранить, по умолчанию 14
#   MONGO_CONTAINER  контейнер базы, по умолчанию reviews-mongo
#   BACKUP_REMOTE    путь rclone для копии вне сервера; пока он не задан,
#                    архив остается только на сервере. Остальные настройки
#                    копии описаны в upload-backup.sh.

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

# cron запускает задания с урезанным PATH, в котором может не оказаться docker.
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Сортировка имен архивов при ротации не должна зависеть от локали.
export LC_ALL=C

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/reviews}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
MONGO_CONTAINER="${MONGO_CONTAINER:-reviews-mongo}"
DB_NAME='reviews'

# Коллекции, без которых архив бесполезен. Кабинет хранит ключ виджета из кода
# вставки на сайте клиента, цели хранят идентификаторы из атрибута target-id.
# Отзывы можно заново загрузить из агрегатора, а эти записи восстановить
# нечем: новая загрузка выдала бы целям новые идентификаторы.
REQUIRED_COLLECTIONS=(workspaces review_targets)

log() {
  printf '%s %s\n' "$(date '+%F %T')" "$*"
}

fail() {
  log "Ошибка: $*" >&2
  exit 1
}

[[ "$BACKUP_KEEP" =~ ^[1-9][0-9]*$ ]] ||
  fail "BACKUP_KEEP должно быть положительным целым числом, получено «$BACKUP_KEEP»"

# Архивы содержат персональные данные: имена авторов отзывов, адрес и хеш
# пароля пользователя консоли. Доступ к ним есть только у владельца.
umask 077
mkdir -p -- "$BACKUP_DIR"

# Второй запуск, пока идет первый, завершается сразу: два процесса не должны
# одновременно удалять старые архивы. Где flock нет (macOS при разработке),
# проверка пропускается.
if command -v flock >/dev/null; then
  exec 9>"$BACKUP_DIR/.lock"
  flock -n 9 || fail 'выгрузка уже выполняется'
fi

archive="$BACKUP_DIR/$DB_NAME-$(date '+%F-%H%M%S').archive.gz"
partial="$archive.partial"

# Недописанный архив удаляется при любом завершении: в каталоге остаются только
# проверенные архивы.
trap 'rm -f -- "$partial"' EXIT

# Команды внутри контейнера заключены в одинарные кавычки: переменные с
# учетными данными раскрывает оболочка контейнера, и на хосте их значения не
# появляются ни в командной строке, ни в журнале. Имя базы передается
# позиционным параметром.
log "Выгрузка базы $DB_NAME из контейнера $MONGO_CONTAINER"

docker exec "$MONGO_CONTAINER" sh -c '
  mongodump --quiet \
    -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" \
    --authenticationDatabase admin --db "$1" --archive --gzip
' sh "$DB_NAME" >"$partial" || fail 'mongodump завершился с ошибкой'

[[ -s "$partial" ]] || fail 'архив пуст'

# Архив представляет собой один поток gzip, и его контрольная сумма покрывает
# весь файл: обрезанный или поврежденный архив отвергается на этом шаге.
gzip -t -- "$partial" 2>/dev/null || fail 'архив поврежден: не прошел проверку gzip'

# Пробное восстановление ничего не пишет в базу и читает только заголовок
# архива, а данные целиком не проверяет: этим занимается шаг выше. По
# заголовку сверяется состав коллекций.
contents=$(
  docker exec -i "$MONGO_CONTAINER" sh -c '
    mongorestore --dryRun -v \
      -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" \
      --authenticationDatabase admin --archive --gzip 2>&1
  ' <"$partial"
) || fail 'архив не прошел пробное восстановление'

for collection in "${REQUIRED_COLLECTIONS[@]}"; do
  grep -qF -- "$DB_NAME.$collection" <<<"$contents" ||
    fail "в архиве нет коллекции $collection"
done

mv -- "$partial" "$archive"
log "Архив сохранен: $archive ($(du -h -- "$archive" | cut -f1))"

# Ротация выполняется только после успешной выгрузки, поэтому серия сбоев не
# удаляет последние исправные архивы. Имена содержат дату и время, и порядок
# имен совпадает с хронологией.
shopt -s nullglob
archives=("$BACKUP_DIR/$DB_NAME"-*.archive.gz)
excess=$((${#archives[@]} - BACKUP_KEEP))

if ((excess > 0)); then
  rm -f -- "${archives[@]:0:excess}"
  log "Удалено старых архивов: $excess"
fi

# Копия вне сервера делается последним шагом, пока еще удерживается
# блокировка. Ее сбой не отменяет локальный архив: он уже проверен и
# сохранен, а выгрузку можно повторить отдельно.
if [[ -n "${BACKUP_REMOTE:-}" ]]; then
  "$SCRIPT_DIR/upload-backup.sh" "$archive" ||
    fail "локальный архив сохранен, но копия вне сервера не создана. Повторить: BACKUP_REMOTE=$BACKUP_REMOTE $SCRIPT_DIR/upload-backup.sh $archive"
fi
