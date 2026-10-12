# 🎓 ZenBoard - Lavagna Digitale Collaborativa in Tempo Reale
*by ZenByte*

**ZenBoard** è un'applicazione web containerizzata tramite **Docker & Docker Compose**, concepita come una lavagna interattiva collaborativa in tempo reale (in stile Google Jamboard).

Il sistema è progettato per girare localmente sulla macchina del docente (Host). Gli studenti (Guest) possono connettersi alla sessione via web, sia all'interno della stessa rete locale (LAN / Wi-Fi d'aula) sia da remoto tramite soluzioni di tunneling (ngrok / Cloudflare Tunnel).

Un pilastro fondamentale dell'architettura è l'**Approccio Zero-API Cloud**: il salvataggio dei file delle lezioni avviene direttamente in una cartella locale mappata su Google Drive tramite i volumi Docker, evitando qualsiasi complessità legata ad autenticazioni OAuth o quote API.

---

## 🔓 Livelli di Accesso: Free (Ospite) vs Premium (Docente)

ZenBoard distingue due modalità di utilizzo, pensate per essere condivise liberamente con gli studenti mantenendo gli strumenti di gestione riservati al docente:

| Funzionalità | 🔓 Free (Ospite) | 🔐 Premium (Docente) |
|---|---|---|
| Login richiesto | No | Sì (JWT) |
| Disegno collaborativo in tempo reale | ✅ | ✅ |
| Download lezione in **PDF** | ✅ | ✅ |
| Navigazione tra le pagine esistenti | ✅ | ✅ |
| Aggiungere / duplicare / eliminare pagine | ❌ | ✅ |
| Rinominare la lezione | ❌ | ✅ |
| Salvataggio / caricamento lezioni su **Google Drive** | ❌ | ✅ |

L'accesso Ospite non richiede nulla: si clicca su "Entra come Ospite" nella schermata iniziale. L'accesso Premium richiede username e password del docente, configurabili tramite variabili d'ambiente (vedi sotto); al login viene rilasciato un token **JWT** che sblocca sia le API REST (`/api/save`, `/api/load`, `/api/files`) sia le azioni via WebSocket (gestione pagine, rinomina) — entrambe verificate lato server, non solo nell'interfaccia.

### Configurare le credenziali del Docente

Copia `.env.example` in `.env` e personalizza:

```bash
ADMIN_USERNAME=docente
ADMIN_PASSWORD=la-tua-password-sicura
JWT_SECRET=una-stringa-lunga-casuale-e-segreta
JWT_EXPIRY=24h
```

> ⚠️ **Importante**: i valori di default (`docente` / `zenboard2024`) servono solo per lo sviluppo in locale. Se condividi ZenBoard oltre la tua rete (es. con ngrok / Cloudflare Tunnel), cambia **sempre** `ADMIN_PASSWORD` e `JWT_SECRET` prima di farlo. Il backend stampa un avviso in console all'avvio se sta ancora usando i valori predefiniti.

---

## 🛠️ Stack Tecnologico

- **Infrastruttura & Orchestrazione**: Docker, Docker Compose
- **Backend**: Node.js, Express.js, Socket.io (WebSockets real-time)
- **Frontend**: React 18, Vite, `@excalidraw/excalidraw` (motore vettoriale lavagna), `socket.io-client`, Tailwind CSS, Lucide Icons
- **Storage**: File System locale (`fs`) mappato su Google Drive Desktop (`/app/data`)

---

## 📂 Struttura del Progetto

```
zenboard/ (lavagna_digitale/)
├── docker-compose.yml          # Orchestrazione container, mapping porte e volumi
├── .env.example                # Modello per configurazione ambiente e percorso Drive
├── .env                        # File di configurazione locale
├── README.md                   # Documentazione completa
├── data/                       # Directory locale di fallback per le lezioni (.json)
├── backend/
│   ├── Dockerfile              # Dockerfile per il servizio Node.js
│   ├── .dockerignore
│   ├── package.json            # Dipendenze Express, Socket.io, Cors
│   └── server.js               # Server WebSockets & REST API per salvataggio su Drive
└── frontend/
    ├── Dockerfile              # Dockerfile per il servizio Vite/React
    ├── .dockerignore
    ├── package.json            # Dipendenze React, Excalidraw, Socket.io-client
    ├── vite.config.js          # Configurazione Vite (con shim process.env e polling Docker)
    ├── tailwind.config.js      # Configurazione Tailwind CSS
    ├── postcss.config.js
    ├── index.html              # Template HTML principale (Favicon ZenByte e titolo ZenBoard)
    ├── public/
    │   └── logo.png            # Logo ufficiale ZenByte
    └── src/
        ├── main.jsx            # Entry point React
        ├── App.jsx             # Router: LoginPage se non autenticato, Whiteboard altrimenti
        ├── index.css           # Stili globali, Excalidraw & Glassmorphism
        ├── contexts/
        │   └── AuthContext.jsx # Stato login (Guest/Premium), token JWT, fetch autenticate
        └── components/
            ├── Whiteboard.jsx  # Motore lavagna con Excalidraw, Socket.io e gestione Drive
            ├── LoginPage.jsx   # Schermata di accesso: tab Docente Premium / Ospite
            ├── Toolbar.jsx     # Toolbar semplificata (Penna, Evidenziatore, Gomma, Immagini)
            ├── Header.jsx      # Barra superiore compatta con logo ZenByte e popup menu
            ├── PageNavigator.jsx # Navigatore Frame/Pagine stile Google Jamboard (< 1 / N >)
            ├── SaveModal.jsx   # Modale per il salvataggio personalizzato su Drive
            ├── FilesListModal.jsx # Modale per visualizzare e riaprire lezioni da Drive
            └── Toast.jsx       # Notifiche toast non invadenti
```

---

## 🚀 Avvio Rapido con Docker

### 1. Avvia con Docker Compose
```bash
docker compose up --build
```

### 2. Accedi all'applicazione
- **Lavagna ZenBoard**: [http://localhost:5173](http://localhost:5173)
- **Backend API & WebSockets**: [http://localhost:3001](http://localhost:3001)

---

## 🎨 Caratteristiche Principali

### 1. Header Minimalista & Popup di Controllo
- **Logo ZenByte** e titolo della lezione modificabile al volo.
- **Barra comandi compatta**: in alto a destra compare una discreta pillola (`🟢 👥 3 Docente ▾`).
- Cliccando sulla pillola si apre l'elegante **Pannello ZenBoard**:
  - Stato ping / connessione in tempo reale
  - Numero partecipanti connessi
  - Selettore Ruolo (👨‍🏫 Docente / 🎒 Studente)
  - 💾 **Salva Lezione su Drive** (rapido o con nome)
  - 📂 **Apri Lezioni da Drive**
  - 🔗 **Copia Link di Condivisione** per gli studenti

### 2. Gestione Multi-Pagina (Frame Jamboard)
- Navigatore in alto al centro: `< 1 / 4 >`.
- Aggiunta di nuovi fogli bianchi con `+ Nuova`.
- Possibilità di duplicare o eliminare singole slide.
- **Voltagiri sincronizzato**: quando il docente cambia pagina, tutti gli studenti connessi vengono portati automaticamente sulla nuova pagina.

### 3. Strumenti Didattici Immediati
- **Penna (Freedraw)**: inchiostro scuro fluido.
- **Evidenziatore**: tratto fluorescente semitrasparente (35% opacità) per marcare testi e formule senza coprirli.
- **Gomma**: cancellazione rapida.
- **Immagini**: supporto caricamento file picker e **Drag & Drop** diretto sul canvas.
