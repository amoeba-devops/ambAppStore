FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --ignore-scripts
COPY . .
RUN npm run build

# 정적 산출물은 dist/ (base=/app-hscode/). 플랫폼 통합 배포 시 web-platform의
# html/app-hscode/ 로 복사하거나, 아래 standalone nginx 컨테이너로 단독 서빙한다.
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html/app-hscode
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/app-hscode/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
