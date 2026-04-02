FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_API_BASE_URL=/app-sales-report/api
ARG VITE_AMA_LOGIN_URL=https://ama.amoeba.site/login
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_AMA_LOGIN_URL=$VITE_AMA_LOGIN_URL
COPY package.json ./
RUN npm install --ignore-scripts
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
