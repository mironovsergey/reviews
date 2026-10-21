# syntax=docker/dockerfile:1

# Сборка рабочего пространства: один файл дает три образа служб и два
# каталога статики, которые забираются из целей `console-dist` и
# `widget-dist` через `--output`.

# Основная версия Node та же, что на сервере. Образ на Debian, а не Alpine:
# `@node-rs/argon2` поставляет готовые бинарники под glibc, и собирать
# нативный модуль при установке не приходится.
ARG NODE_VERSION=24-slim

FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Сборка идет без терминала: иначе pnpm ждет подтверждения на очистку
# node_modules и падает.
ENV CI=true
# Версия pnpm берется из поля packageManager в package.json.
RUN corepack enable
WORKDIR /app

# Зависимости ставятся до копирования исходников: слой переиспользуется,
# пока не менялись манифесты.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/console-api/package.json apps/console-api/
COPY apps/widget-api/package.json apps/widget-api/
COPY apps/sync-worker/package.json apps/sync-worker/
COPY apps/console/package.json apps/console/
COPY apps/widget/package.json apps/widget/
COPY packages/config/package.json packages/config/
COPY packages/database/package.json packages/database/
COPY packages/aggregator/package.json packages/aggregator/
COPY packages/testing/package.json packages/testing/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .

# --- Службы ------------------------------------------------------------

# `deploy` переносит в отдельный каталог только рабочие зависимости, тогда
# как `install --prod` в рабочем пространстве сохраняет общий store целиком.
# Флаг `--legacy` требуется для любого рабочего пространства: с pnpm 10
# развертывание иначе предполагает inject-workspace-packages.

FROM build AS console-api-build
RUN pnpm --filter @reviews/console-api... build
RUN pnpm deploy --filter=@reviews/console-api --prod --legacy /out

FROM node:${NODE_VERSION} AS console-api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=console-api-build /out ./
USER node

# Проверка живости: `restart: unless-stopped` поднимает упавший процесс, но
# зависший продолжает считаться работающим. Запрос выполняется самим Node -
# в образе нет ни curl, ни wget, а ставить их ради одной проверки незачем.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.CONSOLE_API_PORT}/health`).then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "dist/main.js"]

FROM build AS widget-api-build
RUN pnpm --filter @reviews/widget-api... build
RUN pnpm deploy --filter=@reviews/widget-api --prod --legacy /out

FROM node:${NODE_VERSION} AS widget-api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=widget-api-build /out ./
USER node

# Проверка живости: `restart: unless-stopped` поднимает упавший процесс, но
# зависший продолжает считаться работающим. Запрос выполняется самим Node -
# в образе нет ни curl, ни wget, а ставить их ради одной проверки незачем.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.WIDGET_API_PORT}/health`).then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "dist/main.js"]

FROM build AS sync-worker-build
RUN pnpm --filter @reviews/sync-worker... build
RUN pnpm deploy --filter=@reviews/sync-worker --prod --legacy /out

FROM node:${NODE_VERSION} AS sync-worker
ENV NODE_ENV=production
WORKDIR /app
COPY --from=sync-worker-build /out ./
USER node
# HEALTHCHECK здесь нет: обработчик не слушает порт, и проверить его живость
# запросом невозможно. Признаком служит запись в журнале о завершенном
# прогоне; отслеживать ее должен сборщик логов, а не докер.
CMD ["node", "dist/main.js"]

# --- Статика -----------------------------------------------------------

FROM build AS console-build
# Адрес API вшивается в бандл на этапе сборки: задним числом его не сменить.
ARG VITE_CONSOLE_API_URL
ENV VITE_CONSOLE_API_URL=${VITE_CONSOLE_API_URL}
RUN pnpm --filter @reviews/console build

FROM scratch AS console-dist
COPY --from=console-build /app/apps/console/dist /

FROM build AS widget-build
# Адрес API вшивается в бандл: в коде вставки на сайте клиента его нет.
# Без переменной сборка падает: молча собранный виджет пошел бы за
# отзывами на сайт клиента и не работал бы нигде.
ARG VITE_WIDGET_API_URL
ENV VITE_WIDGET_API_URL=${VITE_WIDGET_API_URL}
RUN pnpm --filter @reviews/widget build

FROM scratch AS widget-dist
COPY --from=widget-build /app/apps/widget/dist /

# Статика консоли и виджета одним образом для автоматической выкладки: она
# забирает статику из реестра вместе с образами служб, поэтому версии всегда
# совпадают. Скрипт выкладки только копирует файлы из образа и никогда его не
# запускает.
FROM scratch AS static
COPY --from=console-build /app/apps/console/dist /console
COPY --from=widget-build /app/apps/widget/dist /widget
