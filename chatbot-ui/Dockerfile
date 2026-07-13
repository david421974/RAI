# Stage 1: Construir la aplicación Angular
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
# Construye la app para producción
RUN npm run build 

# Stage 2: Servir con Nginx
FROM nginx:alpine
# AÑADIMOS "/browser" al final de la ruta de origen
COPY --from=build /app/dist/chatbot-ui /usr/share/nginx/html 

COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
