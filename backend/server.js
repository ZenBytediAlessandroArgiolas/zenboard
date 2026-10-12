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

// ============================================================
// GESTIONE STANZE MULTIPLE (Multi-Room State)
// Map<roomId, RoomState>
// ============================================================
const rooms = new Map();

/**
 * Crea una nuova struttura per una pagina vuota
 */
function createDefaultPage(index = 1) {
  return {
    id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: `Pagina ${index}`,
    elements: [],
    files: {}
  };
}

/**
 * Trasforma il titolo in uno slug leggibile (es: "Matematica 3A" -> "matematica-3a")
 */
function slugify(text) {
  if (!text || typeof text !== 'string') return 'lezione';
  const slug = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // rimuove accenti
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'lezione';
}

/**
 * Genera un roomId univoco a partire dal nome della lezione.
 * Se lo slug esiste già in memoria o nei file salvati su disco, aggiunge un suffisso progressivo (-2, -3, ...)
 */
function generateUniqueRoomId(lessonName) {
  const baseSlug = slugify(lessonName);
  let candidate = baseSlug;
  let counter = 2;

  while (rooms.has(candidate)) {
    candidate = `${baseSlug}-${counter}`;
    counter++;
  }

  return candidate;
}

/**
 * Crea una stanza in memoria se non esiste già
 */
function createRoom(roomId, lessonName = 'Nuova Lezione', initialPages = null, appState = null) {
  const finalRoomId = roomId || generateUniqueRoomId(lessonName);
  const roomState = {
    roomId: finalRoomId,
    lessonName: lessonName || 'Nuova Lezione',
    pages: Array.isArray(initialPages) && initialPages.length > 0 ? initialPages : [createDefaultPage(1)],
    currentPageIndex: 0,
    appState: {
      viewBackgroundColor: appState?.viewBackgroundColor || '#ffffff'
    },
    createdAt: Date.now(),
    lastActivity: Date.now()
  };

  rooms.set(finalRoomId, roomState);
  console.log(`[Rooms] Creata stanza "${finalRoomId}" (Titolo: "${roomState.lessonName}")`);
  return roomState;
}

/**
 * Restituisce una stanza o undefined se non esiste
 */
function getRoom(roomId) {
  if (!roomId) return undefined;
  const room = rooms.get(roomId);
  if (room) {
    room.lastActivity = Date.now();
  }
  return room;
}

/**
 * Cerca di ripristinare una stanza da un file salvato su disco se non è in RAM
 */
function restoreRoomFromDisk(roomId) {
  if (!roomId || !fs.existsSync(DATA_DIR)) return null;

  try {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
        const parsed = JSON.parse(content);
        if (parsed.roomId === roomId || slugify(parsed.lessonName) === roomId) {
          const restoredPages = Array.isArray(parsed.pages) && parsed.pages.length > 0
            ? parsed.pages
            : [createDefaultPage(1)];

          const roomState = {
            roomId: parsed.roomId || roomId,
            lessonName: parsed.lessonName || 'Lezione Ripristinata',
            pages: restoredPages,
            currentPageIndex: typeof parsed.currentPageIndex === 'number' ? parsed.currentPageIndex : 0,
            appState: {
              viewBackgroundColor: parsed.appState?.viewBackgroundColor || '#ffffff'
            },
            createdAt: parsed.savedAt ? new Date(parsed.savedAt).getTime() : Date.now(),
            lastActivity: Date.now()
          };
          rooms.set(roomState.roomId, roomState);
          console.log(`[Rooms] Stanza "${roomState.roomId}" ripristinata dal file su disco: ${file}`);
          return roomState;
        }
      } catch (err) {
        // Ignora file malformati
      }
    }
  } catch (err) {
    console.error('[Rooms] Errore ripristino stanza da disco:', err);
  }

  return null;
}

// Pulizia periodica ogni ora delle stanze in RAM inattive da oltre 72 ore
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 ora
const INACTIVITY_TIMEOUT_MS = 72 * 60 * 60 * 1000; // 72 ore

setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  for (const [id, room] of rooms.entries()) {
    if (now - (room.lastActivity || room.createdAt) > INACTIVITY_TIMEOUT_MS) {
      rooms.delete(id);
      cleanedCount++;
    }
  }
  if (cleanedCount > 0) {
    console.log(`[Rooms] Pulizia automatica: eliminate ${cleanedCount} stanze inattive da >72h. Stanze attive rimaste: ${rooms.size}`);
  }
}, CLEANUP_INTERVAL_MS);

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
      // Token scaduto o invalido: connessione come guest
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

function broadcastUsersCount(roomId) {
  if (!roomId) return;
  const roomSockets = io.sockets.adapter.rooms.get(roomId);
  const count = roomSockets ? roomSockets.size : 0;
  io.to(roomId).emit('users-count', count);
}

io.on('connection', (socket) => {
  console.log(`[Socket] Connessione: ${socket.id} (${socket.data.isPremium ? 'Premium' : 'Guest'})`);

  // 1. Ingresso in una stanza
  socket.on('join-room', ({ roomId, lessonName }) => {
    try {
      if (!roomId) {
        socket.emit('room-error', { message: 'Codice stanza mancante.' });
        return;
      }

      // Se il socket era già in un'altra stanza, esce
      if (socket.data.currentRoomId) {
        const oldRoom = socket.data.currentRoomId;
        socket.leave(oldRoom);
        socket.to(oldRoom).emit('cursor-remove', { socketId: socket.id });
        broadcastUsersCount(oldRoom);
      }

      let room = getRoom(roomId);
      if (!room) {
        // Cerca di ripristinare la stanza dal file su disco se presente
        room = restoreRoomFromDisk(roomId);
      }

      // Se non esiste ancora:
      // Se è il Docente (Premium), crea la nuova stanza
      // Se è un Ospite (Guest), notifica che la stanza non esiste / non è più disponibile
      if (!room) {
        if (socket.data.isPremium) {
          room = createRoom(roomId, lessonName || 'Nuova Lezione');
        } else {
          socket.emit('room-not-found', {
            roomId,
            message: 'Questa lezione non è più disponibile. Chiedi un nuovo link al docente.'
          });
          return;
        }
      }

      socket.join(roomId);
      socket.data.currentRoomId = roomId;

      // Invia lo stato attuale della stanza al client appena entrato
      socket.emit('init-scene', {
        roomId: room.roomId,
        lessonName: room.lessonName,
        pages: room.pages,
        currentPageIndex: room.currentPageIndex,
        appState: room.appState
      });

      // Aggiorna il conteggio partecipanti per questa stanza
      broadcastUsersCount(roomId);
      console.log(`[Socket] ${socket.id} è entrato nella stanza "${roomId}"`);
    } catch (err) {
      console.error('[Socket] Errore in join-room:', err);
      socket.emit('room-error', { message: 'Errore durante l\'accesso alla stanza.' });
    }
  });

  // 2. Disegno ed elementi Excalidraw
  socket.on('excalidraw-update', (data) => {
    try {
      const roomId = socket.data.currentRoomId;
      if (!roomId) return;
      const room = getRoom(roomId);
      if (!room) return;

      const pageIndex = typeof data.pageIndex === 'number' ? data.pageIndex : room.currentPageIndex;

      if (room.pages[pageIndex]) {
        if (Array.isArray(data.elements)) {
          room.pages[pageIndex].elements = data.elements;
        }
        if (data.files && typeof data.files === 'object') {
          room.pages[pageIndex].files = {
            ...room.pages[pageIndex].files,
            ...data.files
          };
        }
      }

      if (data.appState) {
        room.appState = {
          ...room.appState,
          viewBackgroundColor: data.appState.viewBackgroundColor || room.appState.viewBackgroundColor
        };
      }
      if (data.lessonName) {
        room.lessonName = data.lessonName;
      }

      socket.to(roomId).emit('excalidraw-update', {
        ...data,
        pageIndex,
        senderId: socket.id
      });
    } catch (err) {
      console.error('[Socket] Errore excalidraw-update:', err.message);
    }
  });

  // 3. Cambio pagina sincronizzato
  socket.on('page-change', (data) => {
    const roomId = socket.data.currentRoomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;

    const pageIndex = typeof data === 'number' ? data : data.pageIndex;
    if (pageIndex >= 0 && pageIndex < room.pages.length) {
      room.currentPageIndex = pageIndex;
      socket.to(roomId).emit('page-change', { pageIndex, senderId: socket.id });
    }
  });

  // 4. Aggiunta nuova pagina vuota (Solo Premium)
  socket.on('page-add', (data) => {
    if (!requirePremiumSocket(socket)) return;
    const roomId = socket.data.currentRoomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;

    if (data && Array.isArray(data.pages)) {
      room.pages = data.pages;
      room.currentPageIndex = typeof data.currentPageIndex === 'number' ? data.currentPageIndex : (data.pages.length - 1);
    } else {
      const newPage = createDefaultPage(room.pages.length + 1);
      room.pages.push(newPage);
      room.currentPageIndex = room.pages.length - 1;
    }

    socket.to(roomId).emit('pages-updated', {
      pages: room.pages,
      currentPageIndex: room.currentPageIndex
    });
  });

  // 5. Duplicazione pagina (Solo Premium)
  socket.on('page-duplicate', (data) => {
    if (!requirePremiumSocket(socket)) return;
    const roomId = socket.data.currentRoomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;

    if (data && Array.isArray(data.pages)) {
      room.pages = data.pages;
      room.currentPageIndex = data.currentPageIndex;
    } else {
      const sourceIndex = typeof data === 'number' ? data : room.currentPageIndex;
      const sourcePage = room.pages[sourceIndex];
      if (sourcePage) {
        const duplicatedPage = {
          id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: `${sourcePage.title} (Copia)`,
          elements: JSON.parse(JSON.stringify(sourcePage.elements || [])),
          files: JSON.parse(JSON.stringify(sourcePage.files || {}))
        };
        room.pages.splice(sourceIndex + 1, 0, duplicatedPage);
        room.currentPageIndex = sourceIndex + 1;
      }
    }

    socket.to(roomId).emit('pages-updated', {
      pages: room.pages,
      currentPageIndex: room.currentPageIndex
    });
  });

  // 6. Eliminazione pagina (Solo Premium)
  socket.on('page-delete', (data) => {
    if (!requirePremiumSocket(socket)) return;
    const roomId = socket.data.currentRoomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;

    if (data && Array.isArray(data.pages)) {
      room.pages = data.pages;
      room.currentPageIndex = data.currentPageIndex;
    } else {
      if (room.pages.length <= 1) return;
      const targetIndex = typeof data === 'number' ? data : room.currentPageIndex;
      room.pages.splice(targetIndex, 1);
      if (room.currentPageIndex >= room.pages.length) {
        room.currentPageIndex = room.pages.length - 1;
      }
    }

    socket.to(roomId).emit('pages-updated', {
      pages: room.pages,
      currentPageIndex: room.currentPageIndex
    });
  });

  // 7. Nuova Lezione nella stanza corrente (Solo Premium)
  socket.on('new-lesson', (data) => {
    if (!requirePremiumSocket(socket)) return;
    const roomId = socket.data.currentRoomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;

    const lessonName = typeof data?.lessonName === 'string' && data.lessonName.trim()
      ? data.lessonName.trim()
      : 'Nuova Lezione';

    room.pages = [createDefaultPage(1)];
    room.currentPageIndex = 0;
    room.lessonName = lessonName;

    console.log(`[Lezione] Nuova lezione in stanza "${roomId}" da ${socket.data.username}: "${lessonName}"`);
    socket.to(roomId).emit('init-scene', {
      roomId: room.roomId,
      lessonName: room.lessonName,
      pages: room.pages,
      currentPageIndex: room.currentPageIndex,
      appState: room.appState
    });
  });

  // 8. Cursori collaborativi per stanza
  socket.on('cursor-update', (cursorData) => {
    const roomId = socket.data.currentRoomId;
    if (!roomId) return;

    socket.to(roomId).emit('cursor-update', {
      socketId: socket.id,
      ...cursorData
    });
  });

  // 9. Reset pagina corrente per stanza
  socket.on('clear-board', () => {
    const roomId = socket.data.currentRoomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;

    if (room.pages[room.currentPageIndex]) {
      room.pages[room.currentPageIndex].elements = [];
      room.pages[room.currentPageIndex].files = {};
    }
    io.to(roomId).emit('board-cleared');
  });

  // 10. Titolo lezione (Il roomId NON cambia, solo il titolo visualizzato)
  socket.on('update-lesson-name', (name) => {
    if (!requirePremiumSocket(socket)) return;
    const roomId = socket.data.currentRoomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;

    if (typeof name === 'string' && name.trim()) {
      room.lessonName = name.trim();
      io.to(roomId).emit('lesson-name-updated', room.lessonName);
    }
  });

  // Disconnessione
  socket.on('disconnect', () => {
    const roomId = socket.data.currentRoomId;
    if (roomId) {
      socket.to(roomId).emit('cursor-remove', { socketId: socket.id });
      broadcastUsersCount(roomId);
    }
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

app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username e password sono obbligatori.'
      });
    }

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

    const token = jwt.sign(
      {
        username: ADMIN_USERNAME,
        role: 'premium',
        iat: Math.floor(Date.now() / 1000)
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    return res.status(200).json({
      success: true,
      token,
      user: {
        username: ADMIN_USERNAME,
        role: 'premium',
        displayName: 'Docente'
      },
      expiresIn: JWT_EXPIRY,
      message: 'Accesso Premium attivato.'
    });
  } catch (error) {
    console.error('[Auth] Errore login:', error);
    return res.status(500).json({
      success: false,
      error: 'Errore interno del server durante il login.'
    });
  }
});

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
// REST API - STANZE
// ============================================================

/**
 * POST /api/rooms/create
 * Crea una nuova stanza per il docente e restituisce il roomId univoco generato dallo slug
 */
app.post('/api/rooms/create', requireAuth, (req, res) => {
  try {
    const { lessonName } = req.body;
    const finalLessonName = (typeof lessonName === 'string' && lessonName.trim()) ? lessonName.trim() : 'Nuova Lezione';
    const roomId = generateUniqueRoomId(finalLessonName);
    const room = createRoom(roomId, finalLessonName);

    return res.status(200).json({
      success: true,
      roomId: room.roomId,
      lessonName: room.lessonName
    });
  } catch (error) {
    console.error('[Rooms] Errore creazione stanza:', error);
    return res.status(500).json({
      success: false,
      error: 'Errore durante la creazione della nuova stanza.'
    });
  }
});

/**
 * GET /api/rooms/:roomId/status
 * Verifica se una stanza esiste (in RAM o su file salvato)
 */
app.get('/api/rooms/:roomId/status', (req, res) => {
  const { roomId } = req.params;
  const room = getRoom(roomId) || restoreRoomFromDisk(roomId);

  if (!room) {
    return res.status(404).json({
      success: false,
      exists: false,
      error: 'Stanza non trovata o scaduta.'
    });
  }

  return res.status(200).json({
    success: true,
    exists: true,
    roomId: room.roomId,
    lessonName: room.lessonName,
    totalPages: room.pages.length
  });
});

/**
 * GET /api/scene (con query ?roomId=...)
 * Restituisce lo stato della scena per la stanza specificata (usato anche per PDF)
 */
app.get('/api/scene', (req, res) => {
  const roomId = req.query.roomId;
  const room = getRoom(roomId) || restoreRoomFromDisk(roomId);

  if (!room) {
    return res.status(404).json({
      success: false,
      error: 'Stanza non specificata o inesistente.'
    });
  }

  return res.status(200).json({
    success: true,
    data: room
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ZenBoard Backend Multi-Room',
    uptime: process.uptime(),
    activeRoomsCount: rooms.size,
    totalConnectedClients: io.engine.clientsCount,
    storageDirectory: DATA_DIR,
    timestamp: new Date().toISOString()
  });
});

// ============================================================
// REST API - DRIVE STORAGE (Solo Docente Autenticato)
// ============================================================

/**
 * POST /api/save
 * Salva l'intera lezione su file system (Google Drive Volume), includendo il roomId
 */
app.post('/api/save', requireAuth, (req, res) => {
  try {
    const { filename, lessonName, roomId, pages, currentPageIndex, elements, files, appState } = req.body;

    const cleanFilename = sanitizeFilename(filename || lessonName);
    const filePath = path.join(DATA_DIR, cleanFilename);

    const finalPages = Array.isArray(pages) && pages.length > 0
      ? pages
      : [createDefaultPage(1)];

    // Se roomId non è specificato, lo ricava dallo slug del nome lezione
    const finalRoomId = roomId || slugify(lessonName || cleanFilename.replace('.json', ''));

    const payloadToSave = {
      version: '2.0',
      appName: 'ZenBoard',
      roomId: finalRoomId,
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

    // Mantiene aggiornata la stanza anche in memoria
    if (rooms.has(finalRoomId)) {
      const room = rooms.get(finalRoomId);
      room.pages = finalPages;
      room.lessonName = payloadToSave.lessonName;
      room.currentPageIndex = payloadToSave.currentPageIndex;
      room.lastActivity = Date.now();
    } else {
      createRoom(finalRoomId, payloadToSave.lessonName, finalPages, payloadToSave.appState);
    }

    console.log(`[Storage] Lezione salvata su Drive: ${cleanFilename} (Room: "${finalRoomId}", ${(stats.size / 1024).toFixed(2)} KB)`);

    return res.status(200).json({
      success: true,
      message: 'Lezione salvata con successo su Google Drive',
      filename: cleanFilename,
      roomId: finalRoomId,
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
 * Carica la lezione e ripristina la stanza in memoria usando il roomId salvato nel file
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

    if (!Array.isArray(parsedData.pages) || parsedData.pages.length === 0) {
      parsedData.pages = [createDefaultPage(1)];
      parsedData.currentPageIndex = 0;
    }

    // Ricava il roomId dal file salvato o genera dallo slug del nome
    const loadedRoomId = parsedData.roomId || slugify(parsedData.lessonName || cleanFilename.replace('.json', ''));
    parsedData.roomId = loadedRoomId;

    // Ripristina o aggiorna la stanza nella memoria attiva
    const existingRoom = rooms.get(loadedRoomId);
    if (existingRoom) {
      existingRoom.pages = parsedData.pages;
      existingRoom.currentPageIndex = parsedData.currentPageIndex || 0;
      existingRoom.lessonName = parsedData.lessonName || cleanFilename.replace('.json', '');
      if (parsedData.appState) existingRoom.appState = parsedData.appState;
      existingRoom.lastActivity = Date.now();
    } else {
      createRoom(loadedRoomId, parsedData.lessonName || cleanFilename.replace('.json', ''), parsedData.pages, parsedData.appState);
    }

    // Se broadcast=true, invia lo stato aggiornato ai client attualmente dentro quella stanza
    if (req.query.broadcast === 'true') {
      const room = rooms.get(loadedRoomId);
      io.to(loadedRoomId).emit('init-scene', {
        roomId: room.roomId,
        lessonName: room.lessonName,
        pages: room.pages,
        currentPageIndex: room.currentPageIndex,
        appState: room.appState
      });
    }

    return res.status(200).json({
      success: true,
      filename: cleanFilename,
      roomId: loadedRoomId,
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
 */
app.get('/api/files', requireAuth, (req, res) => {
  try {
    const files = fs.readdirSync(DATA_DIR);
    const jsonFiles = files
      .filter((file) => file.endsWith('.json'))
      .map((file) => {
        const filePath = path.join(DATA_DIR, file);
        const stats = fs.statSync(filePath);

        // Estrai roomId e lessonName velocemente se disponibili
        let roomId = null;
        let lessonName = null;
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const parsed = JSON.parse(content);
          roomId = parsed.roomId || null;
          lessonName = parsed.lessonName || null;
        } catch (_) {}

        return {
          filename: file,
          roomId,
          lessonName,
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
  console.log(`🚀 ZenBoard Backend Multi-Room attivo sulla porta ${PORT}`);
  console.log(`📁 Directory Storage Drive: ${DATA_DIR}`);
  console.log(`🔐 Login Docente: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD_PLAIN}`);
  if (!process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET) {
    console.warn(`⚠️  Stai usando credenziali/JWT_SECRET di default. Impostali in .env prima di esporre ZenBoard fuori dalla rete locale.`);
  }
  console.log(`===============================================`);
});
