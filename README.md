# ShadowProxy

Платформа аренды прокси (residential / premium residential / mobile / mobile GB / IPv6):
витрина, личный кабинет, генератор прокси, оплата (crypto), реферальная система,
API для клиентов и админ-панель.

## Стек

| Слой | Технологии |
|------|-----------|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, GSAP, TanStack Query, react-hook-form + Zod |
| **Backend** | NestJS, Prisma, PostgreSQL, Redis |
| **Proxy agent** | Go (`proxy-server-code/`) |
| **Инфраструктура** | Docker Compose (postgres, redis, backend, frontend) |

## Структура

```
frontend/           — Next.js приложение (витрина + ЛК + админка)
backend/            — NestJS API (auth, payments, proxy, admin, customer-api)
proxy-server-code/  — Go-агент прокси-сервера
docs/               — спецификации и операционные заметки
docker-compose.yml  — локальный/прод запуск
```

## Быстрый старт (локально)

Требования: Node.js 20+, Docker, Docker Compose.

```bash
# 1. Конфиг окружения
cp .env.example .env                 # корневой (docker-compose)
cp backend/.env.example backend/.env # backend
cp frontend/.env.example frontend/.env
# заполните реальными значениями

# 2. Поднять инфраструктуру (postgres + redis + сервисы)
docker compose up -d --build

# 3. Dev-режим фронтенда (опционально, вне docker)
cd frontend && npm install && npm run dev   # http://localhost:3000

# 4. Dev-режим бэкенда (опционально, вне docker)
cd backend && npm install && npm run start:dev
```

Миграции Prisma применяются из `backend` (`npx prisma migrate deploy`).

## Конфигурация

Все секреты — в `.env` файлах, которые **не** коммитятся (см. `.gitignore`).
Шаблоны: `.env.example` (корень), `backend/.env.example`, `frontend/.env.example`.

## Деплой

CI: `.github/workflows/main.yml` — по пушу в `develope` деплоит на сервер по SSH
и пересобирает docker-compose. Требуются GitHub Secrets:
`SSH_PRIVATE_KEY`, `DEPLOY_HOST`, `DEPLOY_TOKEN`.

## Лицензия

Проприетарный проект. Все права защищены.
