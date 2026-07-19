FROM node:22-alpine AS base

WORKDIR /app

RUN apk add --no-cache sqlite-libs tini

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline --no-audit

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

RUN mkdir -p /data && chown -R node:node /data

USER node

EXPOSE 8080

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]