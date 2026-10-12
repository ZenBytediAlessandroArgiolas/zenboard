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

> 💡 **Architettura Multi-Stanza (Isolamento per Classe)**: ZenBoard gestisce lavagne isolate tramite stanze (`Map<roomId, RoomState>`). Il codice stanza è generato automaticamente dal titolo della lezione (es. "Matematica 3A" → `matematica-3a`), resta fisso per l'intera sessione e permette di condividere link diretti per classe (`?lezione=matematica-3a`). Le stanze inattive in RAM vengono ripulite automaticamente dopo 72 ore; le lezioni salvate su Drive preservano il loro codice-stanza al ricaricamento.

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
├── .env.example                # Modello per configurazione ambiente, Drive e Vercel/tunnel
├── .env                        # File di configurazione locale (MAI committato)
├── .gitignore                  # Esclude node_modules, .env, dist, lezioni salvate
├── README.md                   # Documentazione completa
├── restart-tunnel.ps1          # Script: riavvia il tunnel Cloudflare e aggiorna Vercel in un comando
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
            ├── TeacherHub.jsx  # Hub iniziale Docente: Nuova Lezione / Apri da Drive
            ├── GuestJoinScreen.jsx # Schermata codice per Ospite (link nudo o stanza scaduta)
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
- Aggiunta di nuovi fogli bianchi con `+ Nuova` (Solo Premium — gli Ospiti vedono i controlli bloccati con lucchetto).
- Possibilità di duplicare o eliminare singole slide (Solo Premium).
- **Voltagiri sincronizzato**: quando il docente cambia pagina, tutti gli studenti connessi vengono portati automaticamente sulla nuova pagina.
- Tutte le azioni di gestione pagine sono verificate anche **lato server** (non solo nell'interfaccia) tramite il token JWT passato in fase di connessione WebSocket.

### 3. Nuova Lezione (Solo Premium)
- Pulsante dedicato nel pannello ZenBoard: svuota la lavagna condivisa e la rinomina, utile per passare da un corso all'altro (es. da "Matematica 3A" a "Inglese 2B") mantenendo le lezioni precedenti salvabili separatamente su Drive.
- Richiede conferma prima di procedere, per evitare di perdere lavoro non salvato.

### 4. Strumenti Didattici Immediati
- **Penna (Freedraw)**: inchiostro scuro fluido.
- **Evidenziatore**: tratto fluorescente semitrasparente (35% opacità) per marcare testi e formule senza coprirli.
- **Gomma**: cancellazione rapida.
- **Immagini**: supporto caricamento file picker e **Drag & Drop** diretto sul canvas.

---

## ☁️ Pubblicazione Online (Frontend su Vercel + Backend locale)

ZenBoard può essere pubblicato con un indirizzo web pubblico mantenendo il backend (Socket.io + salvataggio lezioni) sul PC del docente, secondo il modello "docente come host" descritto sopra:

- **Frontend**: build statica React/Vite pubblicata su **Vercel** (piano gratuito)
- **Backend**: resta su Docker, sul PC del docente, esposto pubblicamente tramite un **Cloudflare Tunnel** ("quick tunnel", gratuito)
- Il frontend su Vercel comunica col backend tramite la variabile d'ambiente `VITE_BACKEND_URL`, impostata sull'URL pubblico generato dal tunnel

**Limite del tunnel gratuito**: un "quick tunnel" Cloudflare genera un URL casuale (`https://xxxx.trycloudflare.com`) che può cambiare o smettere di funzionare se il tunnel viene riavviato (es. dopo un riavvio del PC). Essendo `VITE_BACKEND_URL` "iniettata" nel codice al momento della build, ogni volta che l'URL cambia serve un nuovo deploy del frontend.

### Script di automazione: `restart-tunnel.ps1`

Per evitare di ripetere a mano tutti i passaggi, lo script `restart-tunnel.ps1` nella radice del progetto automatizza l'intero ciclo in un comando:
1. Verifica che il backend Docker locale sia attivo (porta 3001).
2. Controlla il tunnel Cloudflare (`cloudflared`): se è già attivo e funzionante lo mantiene, altrimenti ne avvia uno nuovo e ne estrae l'URL (`*.trycloudflare.com`).
3. Aggiorna la variabile `VITE_BACKEND_URL` in Production su Vercel.
4. Avvia la build su Vercel (sfruttando il Deploy Hook di produzione).
5. Riaggancia automaticamente l'alias del dominio personalizzato (`zenboard.zenbyte.it`) all'ultimo deploy completato.

```powershell
.\restart-tunnel.ps1
```

Richiede nel file `.env` locale (mai committato):
```bash
VERCEL_TOKEN=...           # Account Settings -> Tokens su vercel.com
VERCEL_SCOPE=...           # Slug del team/account Vercel
VERCEL_DEPLOY_HOOK_URL=... # Settings -> Git -> Deploy Hooks del progetto Vercel
```

---

## 📋 Guida Operativa Quotidiana: Avvio Backend e Riavvio Tunnel

Quando accendi il computer o inizi una nuova sessione di lezione:

### 1. Avvia il Backend su Docker
Assicurati che Docker Desktop sia aperto e lancia dal terminale del progetto:

```powershell
docker compose up -d
```
> 💡 *Nota*: Se hai fatto modifiche al codice o alle dipendenze del backend e vuoi riavviarlo:
> ```powershell
> docker compose restart backend
> ```

### 2. Riavvia / Verifica il Tunnel Cloudflare verso Vercel
Una volta attivo il backend su Docker, lancia:

```powershell
.\restart-tunnel.ps1
```
Lo script si occuperà di verificare la connettività, aggiornare Vercel e garantire che **`https://zenboard.zenbyte.it`** sia online e connesso al tuo computer.

---

## 📝 Registro Modifiche Recenti (Changelog)

- **Architettura Multi-Stanza (Isolamento per Classe)**:
  - Sostituita la lavagna globale singola con un sistema a stanze in memoria RAM (`Map<roomId, RoomState>`).
  - Generazione automatica dello slug univoco dal nome lezione (es. *"Matematica 3A"* → `?lezione=matematica-3a`).
  - Il codice stanza resta fisso per l'intera durata della lezione per non invalidare i link già inviati agli studenti.
  - Pulizia automatica periodica delle stanze in RAM inattive da più di 72 ore.
- **Supporto Google Drive Esteso**:
  - Il salvataggio `.json` memorizza il `roomId` originale.
  - All'apertura di una lezione da Drive, la stanza viene ripristinata con lo stesso codice stanza originario.
- **Nuove Schermate e Flussi**:
  - **Teacher Hub (`TeacherHub.jsx`)**: schermata iniziale per il docente che accede senza codice ("Nuova Lezione" o "Apri da Drive").
  - **Guest Join Screen (`GuestJoinScreen.jsx`)**: schermata per ospiti con link non valido o lezione terminata/scaduta.
- **Automazione Deploy e Tunnel Robusta**:
  - Script `restart-tunnel.ps1` potenziato con rilevamento automatico del percorso di `cloudflared.exe`, health check del tunnel esistente, trigger via Deploy Hook e riaggancio automatico dell'alias dominio `zenboard.zenbyte.it`.

