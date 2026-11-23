# The Playwright version here must match @playwright/test in package.json (browsers are baked into the image).
FROM mcr.microsoft.com/playwright:v1.49.1-noble
WORKDIR /e2e
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
CMD ["npx", "playwright", "test"]
