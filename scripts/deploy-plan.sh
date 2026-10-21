#!/usr/bin/env bash
#
# Определяет, какие части сервиса затрагивает переход между двумя версиями.
#
#   scripts/deploy-plan.sh <прежняя версия> <новая версия>
#
# Печатает по строке на каждую часть, которую нужно обновить: console-api,
# widget-api, sync-worker, static. Если прежняя версия не задана или не
# найдена в репозитории, печатает все части: обновить лишнее безопаснее, чем
# пропустить нужное.
#
# Части определяются по путям изменившихся файлов. Общие файлы сборки
# обновляют все части, пакеты рабочего пространства обновляют только
# службы, которые от них зависят. Перечень зависимостей повторяет поля
# dependencies в package.json приложений и меняется вместе с ними.

set -euo pipefail
export LC_ALL=C

ALL_COMPONENTS=(console-api widget-api sync-worker static)
SERVICE_COMPONENTS=(console-api widget-api sync-worker)

# Файлы, от которых зависит сборка любого образа.
COMMON_PATHS=(
  Dockerfile
  .dockerignore
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
  turbo.json
  tsconfig.base.json
)

# Описание боевых служб: его изменение касается всех служб, но не статики.
COMPOSE_PATH='docker-compose.prod.yml'

# Каталоги, от которых зависит каждая часть. packages/testing нужен только
# проверкам и в образы не попадает.
declare -A COMPONENT_PATHS=(
  [console-api]='apps/console-api/ packages/aggregator/ packages/config/ packages/database/'
  [widget-api]='apps/widget-api/ packages/config/ packages/database/'
  [sync-worker]='apps/sync-worker/ packages/aggregator/ packages/config/ packages/database/'
  [static]='apps/console/ apps/widget/'
)

if [[ $# -ne 2 ]]; then
  echo 'Использование: deploy-plan.sh <прежняя версия> <новая версия>' >&2
  exit 2
fi

from=$1
to=$2

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

git rev-parse -q --verify "$to^{commit}" >/dev/null || {
  echo "Новая версия не найдена в репозитории: $to" >&2
  exit 1
}

if [[ -z "$from" ]] || ! git rev-parse -q --verify "$from^{commit}" >/dev/null; then
  printf '%s\n' "${ALL_COMPONENTS[@]}"
  exit 0
fi

changed=$(git diff --name-only "$from" "$to")

declare -A selected=()

while IFS= read -r file; do
  [[ -n "$file" ]] || continue

  for common in "${COMMON_PATHS[@]}"; do
    if [[ "$file" == "$common" ]]; then
      printf '%s\n' "${ALL_COMPONENTS[@]}"
      exit 0
    fi
  done

  if [[ "$file" == "$COMPOSE_PATH" ]]; then
    for service in "${SERVICE_COMPONENTS[@]}"; do
      selected[$service]=1
    done
    continue
  fi

  for component in "${ALL_COMPONENTS[@]}"; do
    for prefix in ${COMPONENT_PATHS[$component]}; do
      if [[ "$file" == "$prefix"* ]]; then
        selected[$component]=1
      fi
    done
  done
done <<<"$changed"

for component in "${ALL_COMPONENTS[@]}"; do
  if [[ -n "${selected[$component]:-}" ]]; then
    echo "$component"
  fi
done
