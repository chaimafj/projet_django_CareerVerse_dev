FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

RUN apk add --no-cache gettext

COPY nginx.conf /etc/nginx/careerverse/default.conf.template
COPY --from=build /app/dist/careerverse/browser /usr/share/nginx/html
COPY docker-entrypoint.sh /docker-entrypoint.d/40-careerverse-envsubst.sh
RUN chmod +x /docker-entrypoint.d/40-careerverse-envsubst.sh

EXPOSE 80
ENV PORT=80 \
    BACKEND_HOSTPORT=backend:8000
