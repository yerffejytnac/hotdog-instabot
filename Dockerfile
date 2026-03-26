FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ ./src/
RUN bun run build

# Re-install production deps only for the runtime stage
RUN rm -rf node_modules && bun install --frozen-lockfile --production

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY keywords.json ./
COPY email-templates/ ./email-templates/

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/index.js"]
