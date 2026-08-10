FROM node:20-alpine AS deps
WORKDIR /app
COPY backend/package.json backend/yarn.lock ./
RUN corepack enable && yarn install

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY backend ./
RUN yarn prisma generate
RUN yarn build

FROM node:20-alpine AS prod
WORKDIR /app
RUN apk add --no-cache curl
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY backend/package.json ./
COPY backend/prisma ./prisma
COPY backend/scripts ./scripts
RUN printf '#!/bin/sh\nset -e\nnode scripts/migrate-deploy.js\nyarn prisma db seed || true\nexec node dist/main\n' > /usr/local/bin/entrypoint.sh && chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
