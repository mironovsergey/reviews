#!/usr/bin/env bash
#
# Шифрование архива базы и выгрузка его в объектное хранилище вне сервера.
#
# Вызывается из backup-db.sh после проверенной локальной выгрузки, когда
# задана переменная BACKUP_REMOTE. Запускается и вручную, чтобы повторно
# отправить уже готовый архив:
#
#   BACKUP_REMOTE=beget:<бакет>/reviews ./scripts/upload-backup.sh <архив>
#
# Архив покидает сервер только зашифрованным. Утилита age шифрует его
# открытым ключом, а закрытый ключ на сервере не хранится, поэтому утечка
# ключей хранилища не раскрывает персональные данные из базы.
#
# Настройки задаются переменными окружения:
#   BACKUP_REMOTE          путь rclone: хранилище, бакет и каталог
#   BACKUP_AGE_RECIPIENTS  файл открытых ключей age, по умолчанию
#                          ~/.config/reviews-backup/age-recipients.txt
#   BACKUP_REMOTE_DAYS     сколько дней хранить копии, по умолчанию 60

set -euo pipefail

# cron запускает задания с урезанным PATH, в котором может не оказаться rclone.
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export LC_ALL=C

BACKUP_AGE_RECIPIENTS="${BACKUP_AGE_RECIPIENTS:-$HOME/.config/reviews-backup/age-recipients.txt}"
BACKUP_REMOTE_DAYS="${BACKUP_REMOTE_DAYS:-60}"

# Удалять в хранилище можно только копии с таким именем: бакет мог бы
# хранить и другие файлы.
REMOTE_PATTERN='reviews-*.archive.gz.age'

# Хранилище Beget не дает создавать бакеты через API. Без этого флага rclone
# перед записью пытается создать бакет и получает отказ.
RCLONE_FLAGS=(--s3-no-check-bucket)

# Так начинается любой файл, зашифрованный age.
AGE_HEADER='age-encryption.org/v1'

log() {
  printf '%s %s\n' "$(date '+%F %T')" "$*"
}

fail() {
  log "Ошибка: $*" >&2
  exit 1
}

[[ $# -eq 1 ]] || fail 'укажите путь к архиву: upload-backup.sh <архив>'
archive=$1

[[ -n "${BACKUP_REMOTE:-}" ]] || fail 'не задана переменная BACKUP_REMOTE'
[[ -s "$archive" ]] || fail "архив не найден или пуст: $archive"
[[ "$BACKUP_REMOTE_DAYS" =~ ^[1-9][0-9]*$ ]] ||
  fail "BACKUP_REMOTE_DAYS должно быть положительным целым числом, получено «$BACKUP_REMOTE_DAYS»"

# Без открытого ключа архив за пределы сервера не отправляется: копия без
# шифрования хуже, чем отсутствие копии.
[[ -s "$BACKUP_AGE_RECIPIENTS" ]] ||
  fail "нет файла открытых ключей age: $BACKUP_AGE_RECIPIENTS"

for tool in age rclone; do
  command -v "$tool" >/dev/null || fail "не установлена утилита $tool"
done

umask 077

name="$(basename -- "$archive").age"
encrypted="$archive.age.partial"

# Зашифрованная копия нужна только на время выгрузки и удаляется при любом
# завершении.
trap 'rm -f -- "$encrypted"' EXIT

age -R "$BACKUP_AGE_RECIPIENTS" -o "$encrypted" "$archive" ||
  fail 'age не смог зашифровать архив'

[[ "$(head -c "${#AGE_HEADER}" -- "$encrypted")" == "$AGE_HEADER" ]] ||
  fail 'зашифрованный файл не похож на результат age'

log "Выгрузка $name в $BACKUP_REMOTE"

rclone copyto "${RCLONE_FLAGS[@]}" -- "$encrypted" "$BACKUP_REMOTE/$name" ||
  fail 'rclone не смог выгрузить архив'

# rclone сверяет контрольную сумму при выгрузке. Размер дополнительно
# сверяется по списку объектов: так проверяется, что копия действительно
# видна в хранилище под нужным именем.
local_size=$(wc -c <"$encrypted" | tr -d ' ')
remote_size=$(rclone lsf "${RCLONE_FLAGS[@]}" --format s --include "/$name" -- "$BACKUP_REMOTE") ||
  fail 'не удалось получить список объектов хранилища'

[[ "$remote_size" == "$local_size" ]] ||
  fail "размер копии в хранилище («$remote_size») не совпадает с локальным ($local_size)"

log "Копия сохранена в хранилище: $BACKUP_REMOTE/$name"

# Старые копии удаляются только после успешной выгрузки новой, поэтому
# серия сбоев не оставляет хранилище пустым.
expired=$(
  rclone lsf "${RCLONE_FLAGS[@]}" --min-age "${BACKUP_REMOTE_DAYS}d" \
    --include "$REMOTE_PATTERN" -- "$BACKUP_REMOTE"
) || fail 'не удалось получить список старых копий'

if [[ -n "$expired" ]]; then
  rclone delete "${RCLONE_FLAGS[@]}" --min-age "${BACKUP_REMOTE_DAYS}d" \
    --include "$REMOTE_PATTERN" -- "$BACKUP_REMOTE" ||
    fail 'не удалось удалить старые копии в хранилище'

  log "Удалено копий старше $BACKUP_REMOTE_DAYS дней: $(wc -l <<<"$expired" | tr -d ' ')"
fi
