# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app

# Necesario para Prisma en alpine
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./
RUN npm ci

# ---- build ----
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma client (no necesita DB)
RUN npx prisma generate
RUN npm run build

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache libc6-compat openssl

# Next standalone output (requiere que en next.config.* esté output:'standalone')
# Pero como create-next-app no lo trae siempre, vamos por la ruta simple:
COPY --from=builder /app ./

EXPOSE 3000
CMD ["npm","run","start"]
