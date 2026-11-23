FROM node:24-bookworm-slim AS base
# Prisma's query engine needs OpenSSL.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY tsconfig.json schema.prisma ./
COPY src ./src
RUN npx prisma generate && npm run build

FROM deps AS test
COPY . .
RUN npx prisma generate
CMD ["npm", "test"]

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY schema.prisma ./
COPY migrations ./migrations
RUN npx prisma generate
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["npm", "start"]
