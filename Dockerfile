# Build stage: full toolchain, then ship only what runtime needs.
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps --no-optional

COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S twilite && adduser -S twilite -G twilite

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src/database/migrations ./src/database/migrations

USER twilite
EXPOSE 3000

# Deploys run migrations as a separate step; the container only serves traffic.
CMD ["node", "dist/main.js"]
