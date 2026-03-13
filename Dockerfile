# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY src/ src/
COPY public/ public/
COPY index.html vite.config.js ./
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 2: Backend + serve frontend
FROM node:20-alpine
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY backend/ ./
COPY --from=frontend-build /app/dist ./public

EXPOSE 5000
CMD ["sh", "-c", "node scripts/migrate.js && node server.js"]
