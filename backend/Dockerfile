FROM node:20-alpine

# Imposta la directory di lavoro nel container
WORKDIR /app

# Copia i manifesti delle dipendenze per sfruttare il layer caching di Docker
COPY package*.json ./

# Installa le dipendenze
RUN npm install --omit=dev

# Copia il resto del codice applicativo
COPY . .

# Esponi la porta del server backend
EXPOSE 3001

# Avvia l'applicazione Node.js
CMD ["npm", "start"]
