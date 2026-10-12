const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);

// Configurazione Porta e Directory Volume Storage (Google Drive)
const PORT = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

// ============================================================
// CONFIGURAZIONE AUTENTICAZIONE
// ============================================================
const JWT_SECRET = process.env.JWT_SECRET || 'zenboard-secret-key-2024-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

// Credenziali docente (configurabili via .env)
// In produzione usare bcrypt hash; qui usiamo un default per semplicità
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'docente';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || null;
const ADMIN_PASSWORD_PLAIN = process.env.ADMIN_PASSWORD || 'zenboard2024';

// Genera l'hash all'avvio se non fornito
let adminPasswordHash = ADMIN_PASSWORD_HASH;
if (!adminPasswordHash) {
  adminPasswordHash = bcrypt.hashSync(ADMIN_PASSWORD_PLAIN, 10);
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`[Storage] Creata directory dati: ${DATA_DIR}`);
} else {
  console.log(`[Storage] Directory dati pronta: ${DATA_DIR}`);
}

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================================
// MIDDLEWARE AUTENTICAZIONE JWT
// ============================================================

/**
 * Middleware che verifica il token JWT nell'header Authorization.
 * Usato per le route "Premium" (salvataggio, caricamento, gestione file Drive).
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Accesso non autorizzato. Effettua il login come Docente.',
      code: 'AUTH_REQUIRED'
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Sessione scaduta o token non valido. Effettua nuovamente il login.',
      code: 'TOKEN_INVALID'
    });
  }
}

/**
 * Middleware opzionale: non blocca ma aggiunge req.user se il token è valido.
 * Utile per le route che devono funzionare sia per guest che per premium.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // Token invalido, ma non blocchiamo la richiesta
      req.user = null;
    }
  }
  next();
}

// ----------------------------------------------------
// STATO MULTI-PAGINA DELLA LAVAGNA (Stile Jamboard Frames)
// ----------------------------------------------------
let currentScene = {
  pages: [
    {
      id: 'page-1',
      title: 'Pagina 1',
      elements: [],
      files: {}
    }
  ],
  currentPageIndex: 0,
  appState: {
    viewBackgroundColor: '#ffffff'
  },
  lessonName: 'Nuova Lezione'
};

// ----------------------------------------------------
// WEBSOCKETS (Socket.io)
// ----------------------------------------------------
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 1e8
});

/**
 * Autenticazione a livello Socket.io: legge il token JWT opzionale passato
 * dal client in fase di handshake (socket.handshake.auth.token) e marca
 * la connessione come Premium o Guest. Le azioni riservate (gestione pagine,
 * rinomina lezione) vengono poi bloccate lato server per i Guest, così la
 * restrizione non dipende solo dai controlli lato client.
 */
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  socket.data.isPremium = false;
  socket.data.username = 'guest';

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.data.isPremium = decoded.role === 'premium';
      socket.data.username = decoded.username;
    } catch (err) {
      // Token invalido/scaduto: la connessione prosegue come Guest
    }
  }
  next();
});

function requirePremiumSocket(socket) {
  if (!socket.data.isPremium) {
    socket.emit('action-denied', {
      message: 'Azione riservata agli utenti Premium (Docente). Effettua il login.'
    });
    return false;
  }
  return true;
}

io.on('connection', (socket) => {
  console.log(`[Socket] Nuovo client connesso: ${socket.id} (${socket.data.isPremium ? 'Premium' : 'Guest'})`);

  // Invia conteggio utenti e stato multi-pagina completo
  io.emit('users-count', io.engine.clientsCount);
  socket.emit('init-scene', currentScene);

  // 1. Aggiornamento disegno sulla pagina corrente
  socket.on('excalidraw-update', (data) => {
    try {
      if (!data) return;
      const pageIndex = typeof data.pageIndex === 'number' ? data.pageIndex : currentScene.currentPageIndex;

      if (currentScene.pages[pageIndex]) {
        if (Array.isArray(data.elements)) {
          currentScene.pages[pageIndex].elements = data.elements;
        }
        if (data.files && typeof data.files === 'object') {
          currentScene.pages[pageIndex].files = {
            ...currentScene.pages[pageIndex].files,
            ...data.files
          };
        }
      }

      if (data.appState) {
        currentScene.appState = {
          ...currentScene.appState,
          viewBackgroundColor: data.appState.viewBackgroundColor || currentScene.appState.viewBackgroundColor
        };
      }
      if (data.lessonName) {
        currentScene.lessonName = data.lessonName;
      }

      socket.broadcast.emit('excalidraw-update', {
        ...data,
        pageIndex,
        senderId: socket.id
      });
    } catch (err) {
      console.error('[Socket] Errore excalidraw-update:', err.message);
    }
  });

  // 2. Cambio pagina sincronizzato (es. docente volta pagina -> studenti seguono)
  socket.on('page-change', (data) => {
    const pageIndex = typeof data === 'number' ? data : data.pageIndex;
    if (pageIndex >= 0 && pageIndex < currentScene.pages.length) {
      currentScene.currentPageIndex = pageIndex;
      socket.broadcast.emit('page-change', { pageIndex, senderId: socket.id });
    }
  });

  // 3. Aggiunta nuova pagina vuota
  socket.on('page-add', (data) => {
    if (!requirePremiumSocket(socket)) return;
    if (data && Array.isArray(data.pages)) {
      currentScene.pages = data.pages;
      currentScene.currentPageIndex = typeof data.currentPageIndex === 'number' ? data.currentPageIndex : (data.pages.length - 1);
    } else {
      const newPage = {
        id: `page-${Date.now()}`,
        title: `Pagina ${currentScene.pages.length + 1}`,
        elements: [],
        files: {}
      };
      currentScene.pages.push(newPage);
      currentScene.currentPageIndex = currentScene.pages.length - 1;
    }
    socket.broadcast.emit('pages-updated', {
      pages: currentScene.pages,
      currentPageIndex: currentScene.currentPageIndex
    });
  });

  // 4. Duplicazione pagina
  socket.on('page-duplicate', (data) => {
    if (!requirePremiumSocket(socket)) return;
    if (data && Array.isArray(data.pages)) {
      currentScene.pages = data.pages;
      currentScene.currentPageIndex = data.currentPageIndex;
    } else {
      const sourceIndex = typeof data === 'number' ? data : currentScene.currentPageIndex;
      const sourcePage = currentScene.pages[sourceIndex];
      if (sourcePage) {
        const duplicatedPage = {
          id: `page-${Date.now()}`,
          title: `${sourcePage.title} (Copia)`,
          elements: JSON.parse(JSON.stringify(sourcePage.elements || [])),
          files: JSON.parse(JSON.stringify(sourcePage.files || {}))
        };
        currentScene.pages.splice(sourceIndex + 1, 0, duplicatedPage);
        currentScene.currentPageIndex = sourceIndex + 1;
      }
    }
    socket.broadcast.emit('pages-updated', {
      pages: currentScene.pages,
      currentPageIndex: currentScene.currentPageIndex
    });
  });

  // 5. Eliminazione pagina
  socket.on('page-delete', (data) => {
    if (!requirePremiumSocket(socket)) return;
    if (data && Array.isArray(data.pages)) {
      currentScene.pages = data.pages;
      currentScene.currentPageIndex = data.currentPageIndex;
    } else {
      if (currentScene.pages.length <= 1) return;
      const targetIndex = typeof data === 'number' ? data : currentScene.currentPageIndex;
      currentScene.pages.splice(targetIndex, 1);
      if (currentScene.currentPageIndex >= currentScene.pages.length) {
        currentScene.currentPageIndex = currentScene.pages.length - 1;
      }
    }
    socket.broadcast.emit('pages-updated', {
      pages: currentScene.pages,
      currentPageIndex: currentScene.currentPageIndex
    });
  });

  // 5bis. Nuova lezione: svuota la lavagna condivisa e la rinomina (es. per iniziare un nuovo corso)
  socket.on('new-lesson', (data) => {
    if (!requirePremiumSocket(socket)) return;
    const lessonName = typeof data?.lessonName === 'string' && data.lessonName.trim()
      ? data.lessonName.trim()
      : 'Nuova Lezione';

    currentScene.pages = [
      {
        id: `page-${Date.now()}`,
        title: 'Pagina 1',
        elements: [],
        files: {}
      }
    ];
    currentScene.currentPageIndex = 0;
    currentScene.lessonName = lessonName;

    console.log(`[Lezione] Nuova lezione creata da ${socket.data.username}: "${lessonName}"`);
    socket.broadcast.emit('init-scene', currentScene);
  });

  // 6. Cursori collaborativi
  socket.on('cursor-update', (cursorData) => {
    socket.broadcast.emit('cursor-update', {
      socketId: socket.id,
      ...cursorData
    });
  });

  // 7. Reset pagina corrente
  socket.on('clear-board', () => {
    if (currentScene.pages[currentScene.currentPageIndex]) {
      currentScene.pages[currentScene.currentPageIndex].elements = [];
      currentScene.pages[currentScene.currentPageIndex].files = {};
    }
    io.emit('board-cleared');
  });

  // 8. Titolo lezione
  socket.on('update-lesson-name', (name) => {
    if (!requirePremiumSocket(socket)) return;
    if (typeof name === 'string' && name.trim()) {
      currentScene.lessonName = name.trim();
      io.emit('lesson-name-updated', currentScene.lessonName);
    }
  });

  socket.on('disconnect', () => {
    socket.broadcast.emit('cursor-remove', { socketId: socket.id });
    io.emit('users-count', io.engine.clientsCount);
  });
});

function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `lezione_${dateStr}.json`;
  }
  let safeName = filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\.\.+/g, '.').trim();
  if (!safeName.endsWith('.json')) safeName += '.json';
  return safeName;
}

// ============================================================
// REST API - AUTENTICAZIONE
// ============================================================

/**
 * POST /api/auth/login
 * Login docente → restituisce JWT token
 */
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username e password sono obbligatori.'
      });
    }

    // Verifica credenziali
    if (username !== ADMIN_USERNAME) {
      return res.status(401).json({
        success: false,
        error: 'Credenziali non valide.'
      });
    }

    const isPasswordValid = bcrypt.compareSync(password, adminPasswordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Credenziali non valide.'
      });
    }

    // Genera JWT Token
    const token = jwt.sign(
      {
        username: ADMIN_USERNAME,
        role: 'premium',
        iat: Math.floor(Date.now() / 1000)
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    console.log(`[Auth] Login effettuato con successo per: ${username}`);

    return res.status(200).json({
      success: true,
      token,
      user: {
        username: ADMIN_USERNAME,
        role: 'premium',
        displayName: 'Docente'
      },
      expiresIn: JWT_EXPIRY,
      message: 'Accesso Premium attivato. Tutte le funzionalità sono sbloccate.'
    });
  } catch (error) {
    console.error('[Auth] Errore login:', error);
    return res.status(500).json({
      success: false,
      error: 'Errore interno del server durante il login.'
    });
  }
});

/**
 * GET /api/auth/verify
 * Verifica se il token JWT è ancora valido
 */
app.get('/api/auth/verify', requireAuth, (req, res) => {
  return res.status(200).json({
    success: true,
    user: {
      username: req.user.username,
      role: req.user.role,
      displayName: 'Docente'
    }
  });
});

// ============================================================
// REST API - PUBBLICHE (Guest + Premium)
// ============================================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ZenBoard Backend Multi-Page',
    uptime: process.uptime(),
    connectedClients: io.engine.clientsCount,
    totalPages: currentScene.pages.length,
    currentPage: currentScene.currentPageIndex + 1,
    storageDirectory: DATA_DIR,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/scene
 * Endpoint pubblico: restituisce lo stato attuale della scena per l'esportazione PDF da parte dei guest.
 */
app.get('/api/scene', (req, res) => {
  return res.status(200).json({
    success: true,
    data: currentScene
  });
});

// ============================================================
// REST API - PREMIUM (Solo Docente Autenticato)
// ============================================================

/**
 * POST /api/save
 * Salva l'intera lezione multi-pagina su file system (Google Drive Volume)
 * PROTETTO: Solo utenti Premium (docente autenticato)
 */
app.post('/api/save', requireAuth, (req, res) => {
  try {
    const { filename, lessonName, pages, currentPageIndex, elements, files, appState } = req.body;

    const cleanFilename = sanitizeFilename(filename || lessonName);
    const filePath = path.join(DATA_DIR, cleanFilename);

    // Supporta sia formato multi-pagina che singolo array di elementi
    const finalPages = Array.isArray(pages) && pages.length > 0
      ? pages
      : [
          {
            id: 'page-1',
            title: 'Pagina 1',
            elements: elements || [],
            files: files || {}
          }
        ];

    const payloadToSave = {
      version: '2.0',
      appName: 'ZenBoard',
      lessonName: lessonName || cleanFilename.replace('.json', ''),
      savedAt: new Date().toISOString(),
      savedBy: req.user.username,
      currentPageIndex: typeof currentPageIndex === 'number' ? currentPageIndex : 0,
      pages: finalPages,
      appState: {
        viewBackgroundColor: appState?.viewBackgroundColor || '#ffffff'
      }
    };

    fs.writeFileSync(filePath, JSON.stringify(payloadToSave, null, 2), 'utf8');
    const stats = fs.statSync(filePath);

    console.log(`[Storage] Lezione salvata con successo (${finalPages.length} pagine): ${cleanFilename} (${(stats.size / 1024).toFixed(2)} KB)`);

    return res.status(200).json({
      success: true,
      message: 'Lezione multi-pagina salvata con successo su Google Drive',
      filename: cleanFilename,
      filePath: filePath,
      totalPages: finalPages.length,
      sizeBytes: stats.size,
      savedAt: payloadToSave.savedAt
    });
  } catch (error) {
    console.error('[Storage] Errore salvataggio:', error);
    return res.status(500).json({
      success: false,
      error: 'Errore interno durante la scrittura del file su Drive.',
      details: error.message
    });
  }
});

/**
 * GET /api/load/:filename
 * Carica la lezione e normalizza i dati nel formato multi-pagina
 * PROTETTO: Solo utenti Premium (docente autenticato)
 */
app.get('/api/load/:filename', requireAuth, (req, res) => {
  try {
    const cleanFilename = sanitizeFilename(req.params.filename);
    const filePath = path.join(DATA_DIR, cleanFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: `File "${cleanFilename}" non trovato.`
      });
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const parsedData = JSON.parse(fileContent);

    // Normalizzazione retrocompatibile: se il file proviene dalla v1 (singola pagina),
    // convertilo trasparentemente in struttura a pagine
    if (!Array.isArray(parsedData.pages) || parsedData.pages.length === 0) {
      parsedData.pages = [
        {
          id: 'page-1',
          title: 'Pagina 1',
          elements: parsedData.elements || [],
          files: parsedData.files || {}
        }
      ];
      parsedData.currentPageIndex = 0;
    }

    if (req.query.broadcast === 'true') {
      currentScene.pages = parsedData.pages;
      currentScene.currentPageIndex = parsedData.currentPageIndex || 0;
      if (parsedData.appState) {
        currentScene.appState = parsedData.appState;
      }
      currentScene.lessonName = parsedData.lessonName || cleanFilename.replace('.json', '');
      io.emit('init-scene', currentScene);
    }

    return res.status(200).json({
      success: true,
      filename: cleanFilename,
      data: parsedData
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossibile leggere il file JSON specificato.',
      details: error.message
    });
  }
});

/**
 * GET /api/files
 * Lista tutti i file JSON salvati nella cartella Drive
 * PROTETTO: Solo utenti Premium (docente autenticato)
 */
app.get('/api/files', requireAuth, (req, res) => {
  try {
    const files = fs.readdirSync(DATA_DIR);
    const jsonFiles = files
      .filter((file) => file.endsWith('.json'))
      .map((file) => {
        const filePath = path.join(DATA_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          sizeBytes: stats.size,
          sizeFormatted: `${(stats.size / 1024).toFixed(1)} KB`,
          updatedAt: stats.mtime.toISOString(),
          createdAt: stats.birthtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    return res.status(200).json({
      success: true,
      count: jsonFiles.length,
      files: jsonFiles
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossibile leggere la cartella dei file su Drive.',
      details: error.message
    });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🚀 ZenBoard Backend Multi-Page attivo sulla porta ${PORT}`);
  console.log(`📁 Directory Storage Drive: ${DATA_DIR}`);
  console.log(`🔐 Login Docente: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD_PLAIN}`);
  if (!process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET) {
    console.warn(`⚠️  Stai usando credenziali/JWT_SECRET di default. Impostali in .env prima di esporre ZenBoard fuori dalla rete locale.`);
  }
  console.log(`===============================================`);
});
