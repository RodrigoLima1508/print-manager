# Estágio 1: Build do Frontend
FROM node:20 AS build-frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Estágio 2: Configuração do Backend
FROM node:20
WORKDIR /app

# --- NOVO: Instala o ping dentro do container ---
RUN apt-get update && apt-get install -y iputils-ping && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --only=production
COPY . .
COPY --from=build-frontend /app/frontend/dist ./frontend/dist

EXPOSE 7860
CMD ["node", "server.js"]