FROM node:22.23.1-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps --no-optional

COPY tsconfig.json tsconfig.build.json nest-cli.json .swcrc ./
COPY src ./src

RUN npm run build && npm prune --omit=dev


FROM node:22.23.1-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

RUN groupadd --system twilite \
    && useradd --system --gid twilite --create-home --no-log-init twilite

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src/database/migrations ./src/database/migrations

USER twilite

EXPOSE 3000

CMD ["node", "dist/main.js"]