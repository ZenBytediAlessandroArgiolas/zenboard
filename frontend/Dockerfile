FROM node:20-alpine

# Imposta la cartella di lavoro
WORKDIR /app

# Copia i manifesti delle dipendenze
COPY package*.json ./

# Installa le dipendenze
RUN npm install

# Copia il codice sorgente
COPY . .

# Esponi la porta del server di sviluppo Vite
EXPOSE 5173

# Avvia il server di sviluppo su 0.0.0.0
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
