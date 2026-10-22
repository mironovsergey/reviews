#!/usr/bin/env bash
#
# Выкладка версии сервиса на боевой сервер.
#
#   scripts/deploy.sh v1.2.0
#
# Запускается workflow выкладки по SSH ключом, которому разрешена только эта
# команда (см. README, раздел «Автоматическая выкладка»): тег приходит в
# SSH_ORIGINAL_COMMAND. Запуск вручную из каталога сервиса равнозначен.
#
# Порядок работы:
#   1. Проверка тега и переход рабочей копии на него. Дальше выполняется
#      версия этого скрипта из нового тега, поэтому изменения самой выкладки
#      вступают в силу сразу.
#   2. Определение изменившихся частей (deploy-plan.sh).
#   3. Ожидание конца синхронизации, если перезапускается ее обработчик.
#   4. Выгрузка базы.
#   5. Загрузка образов из реестра. Если образ недоступен, выкладка
#      прекращается до каких-либо изменений.
#   6. Замена служб и ожидание их готовности.
#   7. Установка статики и проверка ответов служб и nginx.
# Сбой на шагах 6 и 7 возвращает замененное к прежнему состоянию.
#
# Контейнер базы выкладка не трогает никогда.
#
# Настройки задаются переменными окружения:
#   DEPLOY_STATE_DIR        каталог состояния выкладки, по умолчанию
#                           ~/.local/state/reviews-deploy
#   DEPLOY_REGISTRY_PREFIX  начало имен образов, по умолчанию
#                           ghcr.io/mironovsergey/reviews
#   DEPLOY_CONSOLE_URL      адрес консоли для проверки, по умолчанию
#                           https://console.clinicstars.ru

set -euo pipefail

# Команду, разрешенную ключу SSH, и задание cron система запускает с урезанным
# PATH, в котором может не оказаться docker.
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export LC_ALL=C

APP_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
STATE_DIR="${DEPLOY_STATE_DIR:-$HOME/.local/state/reviews-deploy}"
REGISTRY_PREFIX="${DEPLOY_REGISTRY_PREFIX:-ghcr.io/mironovsergey/reviews}"
CONSOLE_URL="${DEPLOY_CONSOLE_URL:-https://console.clinicstars.ru}"

TAG_PATTERN='^v[0-9]+\.[0-9]+\.[0-9]+$'
COMPOSE_FILE="$APP_DIR/docker-compose.prod.yml"
MONGO_CONTAINER='reviews-mongo'

# Метка, которую сборка ставит на образы сервиса. По ней удаляются только
# свои образы, оставшиеся без тегов: на сервере работают и другие проекты.
IMAGE_SOURCE_LABEL='org.opencontainers.image.source=https://github.com/mironovsergey/reviews'

# Выгрузки перед выкладкой хранятся отдельно от ежедневных, чтобы частые
# выкладки не вытесняли их из ротации.
PREDEPLOY_BACKUP_DIR="$HOME/backups/reviews-predeploy"
PREDEPLOY_BACKUP_KEEP=5

# Сколько ждать готовности службы. Служба без проверки здоровья считается
# запущенной, если проработала STABLE_RUN_S секунд без перезапусков.
HEALTH_TIMEOUT_S=180
STABLE_RUN_S=30

# Захват синхронизации действует 15 минут, дольше ждать бессмысленно.
SYNC_WAIT_TIMEOUT_S=900
SYNC_POLL_S=10

# Состояние текущей выкладки, нужное для отката.
new_tag=''
previous_tag=''
replaced_services=()
static_replaced=0

log() {
  printf '%s %s\n' "$(date '+%F %T')" "$*"
}

fail() {
  log "Ошибка: $*" >&2
  exit 1
}

contains() {
  local needle=$1 item
  shift

  for item in "$@"; do
    if [[ "$item" == "$needle" ]]; then
      return 0
    fi
  done

  return 1
}

container_name() { echo "reviews-$1"; }
local_image() { echo "reviews-$1:latest"; }
previous_image() { echo "reviews-$1:previous"; }
registry_image() { echo "$REGISTRY_PREFIX-$1:$2"; }

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

# Значение переменной из .env сервиса: адреса и порты для проверки ответов.
env_value() {
  grep -E "^$1=" "$APP_DIR/.env" | tail -n 1 | cut -d= -f2-
}

# Шаг 1: проверка тега и переход рабочей копии на него.
start() {
  local tag=${1:-${SSH_ORIGINAL_COMMAND:-}}

  [[ "$tag" =~ $TAG_PATTERN ]] || fail "ожидается тег версии вида v1.2.0, получено «$tag»"

  mkdir -p -- "$STATE_DIR"

  # Вывод уходит и в журнал workflow, и в журнал выкладок на сервере.
  exec > >(tee -a "$STATE_DIR/deploy.log") 2>&1

  exec 9>"$STATE_DIR/deploy.lock"
  flock -n 9 || fail 'другая выкладка уже выполняется'

  cd -- "$APP_DIR"

  [[ -z "$(git status --porcelain --untracked-files=no)" ]] ||
    fail 'в рабочей копии сервиса есть незакоммиченные изменения'

  git fetch --quiet --force --tags origin || fail 'не удалось получить теги из репозитория'
  git rev-parse -q --verify "refs/tags/$tag^{commit}" >/dev/null ||
    fail "тег $tag не найден в репозитории"

  local previous=''

  if [[ -s "$STATE_DIR/current-tag" ]]; then
    previous=$(<"$STATE_DIR/current-tag")
  fi

  log "Выкладка $tag, сейчас развернута версия ${previous:-неизвестна}"

  # git заменяет файлы новыми, а не переписывает их на месте, поэтому
  # выполняемый сейчас скрипт продолжает читаться из прежнего файла.
  git checkout --quiet --detach "refs/tags/$tag"

  # Блокировка остается за процессом: дескриптор 9 переживает exec.
  exec "$APP_DIR/scripts/deploy.sh" --apply "$tag" "$previous"
}

# Шаги 2-7 в версии скрипта из выкладываемого тега.
apply() {
  new_tag=$1
  previous_tag=${2:-}

  cd -- "$APP_DIR"

  # При любой ошибке рабочая копия возвращается на развернутую версию:
  # описание служб на диске должно соответствовать работающим контейнерам.
  trap 'restore_checkout $?' EXIT

  local plan
  plan=$("$APP_DIR/scripts/deploy-plan.sh" "$previous_tag" "$new_tag") ||
    fail 'не удалось определить изменившиеся части'

  if [[ -z "$plan" ]]; then
    log "Версия $new_tag не меняет ни служб, ни статики"
    record_success
    return
  fi

  local services=() static=0 component

  while IFS= read -r component; do
    if [[ "$component" == static ]]; then
      static=1
    else
      services+=("$component")
    fi
  done <<<"$plan"

  log "Обновляются: $(tr '\n' ' ' <<<"$plan")"

  if contains sync-worker "${services[@]}"; then
    wait_for_sync
  fi

  backup_database
  pull_images "$static" "${services[@]}"

  # Дальше каждое изменение откатывается при сбое.
  if ((${#services[@]} > 0)); then
    replace_services "${services[@]}"
  fi

  if ((static)); then
    install_static
  fi

  smoke_check "$static" || rollback_and_fail 'проверка ответов после выкладки не прошла'

  record_success
  prune_images
}

# Обработчик синхронизации перезапускается только между прогонами: прерванный
# прогон оставил бы захват подключения еще на 15 минут.
wait_for_sync() {
  local deadline=$((SECONDS + SYNC_WAIT_TIMEOUT_S)) running announced=0

  while :; do
    running=$(
      docker exec "$MONGO_CONTAINER" sh -c '
        mongosh --quiet \
          -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" \
          --authenticationDatabase admin reviews \
          --eval "db.connections.countDocuments({ syncState: \"running\", syncLockedUntil: { \$gt: new Date() } })"
      '
    ) || fail 'не удалось узнать состояние синхронизации'

    if [[ "$running" == 0 ]]; then
      return 0
    fi

    ((SECONDS < deadline)) ||
      fail "синхронизация не закончилась за $((SYNC_WAIT_TIMEOUT_S / 60)) минут, выкладка отменена"

    if ((!announced)); then
      log 'Идет синхронизация: обработчик перезапустится после ее окончания'
      announced=1
    fi

    sleep "$SYNC_POLL_S"
  done
}

backup_database() {
  log 'Выгрузка базы перед выкладкой'

  # Перед выкладкой нужна только быстрая локальная копия, поэтому выгрузка
  # вне сервера отключается, даже если ее настройка попала в окружение.
  env -u BACKUP_REMOTE \
    BACKUP_DIR="$PREDEPLOY_BACKUP_DIR" BACKUP_KEEP="$PREDEPLOY_BACKUP_KEEP" \
    "$APP_DIR/scripts/backup-db.sh" ||
    fail 'выгрузка базы не удалась, выкладка отменена'
}

pull_images() {
  local static=$1 service image
  shift

  local images=()

  for service in "$@"; do
    images+=("$(registry_image "$service" "$new_tag")")
  done

  if ((static)); then
    images+=("$(registry_image static "$new_tag")")
  fi

  for image in "${images[@]}"; do
    log "Загрузка $image"

    docker pull --quiet "$image" >/dev/null ||
      fail "образ $image недоступен. Если это первая выкладка, пакеты в GHCR нужно сделать публичными (README, «Автоматическая выкладка»)"
  done
}

replace_services() {
  local service

  for service in "$@"; do
    if docker image inspect "$(local_image "$service")" >/dev/null 2>&1; then
      docker tag "$(local_image "$service")" "$(previous_image "$service")"
    fi

    docker tag "$(registry_image "$service" "$new_tag")" "$(local_image "$service")"
    replaced_services+=("$service")
  done

  # Без --no-deps compose проверил бы и зависимости, то есть базу.
  compose up -d --no-deps "$@" || rollback_and_fail 'docker compose не смог запустить службы'

  for service in "$@"; do
    wait_until_ready "$service" || rollback_and_fail "служба $service не пришла в рабочее состояние"
    log "Служба $service работает"
  done
}

# Служба готова, когда контейнер прошел проверку здоровья, а если ее нет,
# когда проработал STABLE_RUN_S секунд без перезапусков.
wait_until_ready() {
  local container deadline state status health restarts started
  container=$(container_name "$1")
  deadline=$((SECONDS + HEALTH_TIMEOUT_S))

  while ((SECONDS < deadline)); do
    state=$(
      docker inspect -f \
        '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} {{.RestartCount}} {{.State.StartedAt}}' \
        "$container" 2>/dev/null
    ) || state='missing none 0 -'

    read -r status health restarts started <<<"$state"

    if ((restarts > 0)); then
      log "Контейнер $container перезапускался: $restarts раз"
      return 1
    fi

    case "$status" in
      running | created | restarting) ;;
      *)
        log "Контейнер $container в состоянии $status"
        return 1
        ;;
    esac

    case "$health" in
      healthy)
        return 0
        ;;
      unhealthy)
        log "Контейнер $container не прошел проверку здоровья"
        return 1
        ;;
      none)
        if [[ "$status" == running ]] &&
          (($(date +%s) - $(date -d "$started" +%s) >= STABLE_RUN_S)); then
          return 0
        fi
        ;;
    esac

    sleep 2
  done

  log "Контейнер $container не стал готов за $HEALTH_TIMEOUT_S секунд"
  return 1
}

install_static() {
  save_static_backup
  static_replaced=1

  "$APP_DIR/scripts/install-static.sh" "$(registry_image static "$new_tag")" "$APP_DIR" ||
    rollback_and_fail 'не удалось установить статику'
}

# Для отката хватает прежних index.html и файлов виджета: файлы консоли из
# assets/, на которые ссылается прежняя index.html, install-static.sh хранит.
save_static_backup() {
  local backup="$STATE_DIR/static-previous"

  rm -rf -- "$backup"
  mkdir -p -- "$backup/console" "$backup/widget"
  cp -p -- "$APP_DIR/console/index.html" "$backup/console/"
  cp -p -- "$APP_DIR"/widget/* "$backup/widget/"
}

restore_static() {
  local backup="$STATE_DIR/static-previous" dir file name

  for dir in console widget; do
    for file in "$backup/$dir"/*; do
      name=$(basename -- "$file")

      # Копия рядом с целевым файлом и переименование: nginx не увидит
      # наполовину записанный файл и при откате.
      cp -p -- "$file" "$APP_DIR/$dir/.$name.restore" &&
        mv -f -- "$APP_DIR/$dir/.$name.restore" "$APP_DIR/$dir/$name" ||
        return 1
    done
  done
}

restore_services() {
  local service result=0

  for service in "${replaced_services[@]}"; do
    docker tag "$(previous_image "$service")" "$(local_image "$service")" || result=1
  done

  compose up -d --no-deps "${replaced_services[@]}" || return 1

  for service in "${replaced_services[@]}"; do
    wait_until_ready "$service" || result=1
  done

  return "$result"
}

rollback_and_fail() {
  local reason=$1 restored=1

  log "Ошибка: $reason. Возврат к прежнему состоянию"

  if ((static_replaced)); then
    restore_static || restored=0
  fi

  if ((${#replaced_services[@]} > 0)); then
    restore_services || restored=0
  fi

  # Рабочую копию возвращает restore_checkout при выходе.
  if ((restored)); then
    fail "выкладка $new_tag отменена, работает прежняя версия ${previous_tag:-}"
  fi

  # Какие части работают в какой версии, теперь неизвестно. Без отметки
  # о текущей версии следующая выкладка обновит все части.
  rm -f -- "$STATE_DIR/current-tag"
  fail "выкладка $new_tag отменена, но прежнее состояние вернуть полностью не удалось: нужна проверка вручную"
}

restore_checkout() {
  local status=$1

  if ((status == 0)) || [[ -z "$previous_tag" ]]; then
    return
  fi

  git -C "$APP_DIR" checkout --quiet --detach "refs/tags/$previous_tag" ||
    log "Не удалось вернуть рабочую копию на версию $previous_tag"
}

smoke_check() {
  local static=$1 port_var port

  for port_var in CONSOLE_API_PORT WIDGET_API_PORT; do
    port=$(env_value "$port_var")

    curl -fsS --max-time 10 -o /dev/null "http://127.0.0.1:$port/health" || {
      log "Служба на порту $port не отвечает на /health"
      return 1
    }
  done

  if ((!static)); then
    return 0
  fi

  # Через nginx должна отдаваться именно новая index.html.
  local page asset
  page=$(curl -fsS --max-time 15 "$CONSOLE_URL/") || {
    log "Консоль $CONSOLE_URL не открывается"
    return 1
  }
  asset=$(grep -oE 'assets/[^"]+\.js' "$APP_DIR/console/index.html" | head -n 1)

  [[ -n "$asset" && "$page" == *"$asset"* ]] || {
    log "Консоль $CONSOLE_URL отдает не новую index.html"
    return 1
  }

  local widget_url remote_size local_size
  widget_url=$(env_value WIDGET_SCRIPT_URL)
  remote_size=$(curl -fsS --max-time 15 -o /dev/null -w '%{size_download}' "$widget_url") || {
    log "Скрипт виджета $widget_url не загружается"
    return 1
  }
  local_size=$(wc -c <"$APP_DIR/widget/reviews-widget.js" | tr -d ' ')

  [[ "$remote_size" == "$local_size" ]] || {
    log "Скрипт виджета $widget_url отдается не новый: $remote_size байт вместо $local_size"
    return 1
  }
}

record_success() {
  printf '%s\n' "$new_tag" >"$STATE_DIR/current-tag.partial"
  mv -f -- "$STATE_DIR/current-tag.partial" "$STATE_DIR/current-tag"
  log "Версия $new_tag развернута"
}

# Из образов реестра хранятся только текущая и прежняя версии.
prune_images() {
  local image version

  while IFS= read -r image; do
    version=${image##*:}

    if [[ "$version" != "$new_tag" && "$version" != "$previous_tag" ]]; then
      docker rmi "$image" >/dev/null 2>&1 || true
    fi
  done < <(docker images --format '{{.Repository}}:{{.Tag}}' | grep -F -- "$REGISTRY_PREFIX-" || true)

  docker image prune -f --filter "label=$IMAGE_SOURCE_LABEL" >/dev/null 2>&1 || true
}

main() {
  if [[ "${1:-}" == --apply ]]; then
    shift
    apply "$@"
  else
    start "$@"
  fi
}

main "$@"
