# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app
# Prisma on Alpine needs OpenSSL + libc compat to resolve its query engine.
RUN apk add --no-cache openssl libc6-compat
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl libc6-compat
COPY package*.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=build /app/dist ./dist
# The non-root `node` user must own the app dir so Prisma can access its engine.
RUN chown -R node:node /app
EXPOSE 4000
USER node
CMD ["node", "dist/server.js"]
