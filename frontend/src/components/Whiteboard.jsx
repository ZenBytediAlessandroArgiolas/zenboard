import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import Toolbar from './Toolbar';
import Header from './Header';
import SaveModal from './SaveModal';
import FilesListModal from './FilesListModal';
import Toast from './Toast';

export const getBackendUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }
  const protocol = window.location.protocol;
  const host = window.location.hostname || 'localhost';
  return `${protocol}//${host}:3001`;
};

const getRandomCollaboratorColor = () => {
  const colors = [
    { background: '#3b82f6', stroke: '#1d4ed8' },
    { background: '#10b981', stroke: '#047857' },
    { background: '#8b5cf6', stroke: '#6d28d9' },
    { background: '#f59e0b', stroke: '#b45309' },
    { background: '#ec4899', stroke: '#be185d' },
    { background: '#06b6d4', stroke: '#0e7490' }
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

export default function Whiteboard() {
  const { isPremium, isGuest, authFetch, user, token, logout } = useAuth();

  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [activeTool, setActiveTool] = useState('selection');
  const [lessonName, setLessonName] = useState('Lezione Senza Titolo');
  const [isConnected, setIsConnected] = useState(false);
  const [usersCount, setUsersCount] = useState(1);
  const [userRole, setUserRole] = useState(isPremium ? 'teacher' : 'student');
  const [toast, setToast] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // ----------------------------------------------------
  // GESTIONE MULTI-PAGINA (Frame Stile Google Jamboard)
  // ----------------------------------------------------
  const [pages, setPages] = useState([
    {
      id: 'page-1',
      title: 'Pagina 1',
      elements: [],
      files: {}
    }
  ]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // Riferimenti per evitare stale closure nei listener Socket
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const currentPageIndexRef = useRef(currentPageIndex);
  currentPageIndexRef.current = currentPageIndex;

  const socketRef = useRef(null);
  const isRemoteUpdateRef = useRef(false);
  const lastSceneVersionRef = useRef(0);
  const lastEmitTimeRef = useRef(0);
  const fileInputRef = useRef(null);
  const collaboratorsMapRef = useRef(new Map());
  const userColorRef = useRef(getRandomCollaboratorColor());
  const userNameRef = useRef(
    isPremium ? (user?.displayName || 'Docente') : `Studente-${Math.floor(Math.random() * 900 + 100)}`
  );

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const backendUrl = getBackendUrl();

  const computeSceneVersion = (elements) => {
    if (!elements || !Array.isArray(elements)) return 0;
    return elements.reduce((acc, el) => acc + (el.version || 1) + (el.versionNonce || 0), 0);
  };

  // Carica i dati di una pagina all'interno del canvas Excalidraw
  const loadPageIntoCanvas = useCallback((targetPage) => {
    if (!excalidrawAPI || !targetPage) return;
    isRemoteUpdateRef.current = true;
    try {
      if (targetPage.files && Object.keys(targetPage.files).length > 0) {
        excalidrawAPI.addFiles(Object.values(targetPage.files));
      }
      if (!targetPage.elements || targetPage.elements.length === 0) {
        excalidrawAPI.resetScene();
      } else {
        excalidrawAPI.updateScene({
          elements: targetPage.elements
        });
      }
      lastSceneVersionRef.current = computeSceneVersion(targetPage.elements || []);
    } catch (err) {
      console.error('[ZenBoard] Errore caricamento pagina nel canvas:', err);
    } finally {
      setTimeout(() => {
        isRemoteUpdateRef.current = false;
      }, 100);
    }
  }, [excalidrawAPI]);

  // ----------------------------------------------------
  // INIZIALIZZAZIONE WEBSOCKET
  // ----------------------------------------------------
  useEffect(() => {
    const socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      auth: { token: token || null }
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('users-count', (count) => {
      setUsersCount(count);
    });

    // Inizializzazione scena (supporta sia v1 a pagina singola sia v2 multi-pagina)
    socket.on('init-scene', (sceneData) => {
      if (!sceneData || !excalidrawAPI) return;

      if (Array.isArray(sceneData.pages) && sceneData.pages.length > 0) {
        setPages(sceneData.pages);
        pagesRef.current = sceneData.pages;
        const targetIdx = sceneData.currentPageIndex || 0;
        setCurrentPageIndex(targetIdx);
        currentPageIndexRef.current = targetIdx;
        loadPageIntoCanvas(sceneData.pages[targetIdx]);
      } else if (sceneData.elements) {
        // Fallback retrocompatibile v1
        const initialPage = {
          id: 'page-1',
          title: 'Pagina 1',
          elements: sceneData.elements,
          files: sceneData.files || {}
        };
        setPages([initialPage]);
        pagesRef.current = [initialPage];
        setCurrentPageIndex(0);
        currentPageIndexRef.current = 0;
        loadPageIntoCanvas(initialPage);
      }

      if (sceneData.lessonName) {
        setLessonName(sceneData.lessonName);
      }
    });

    // Aggiornamento tratti in tempo reale
    socket.on('excalidraw-update', (data) => {
      if (!data || !excalidrawAPI) return;
      const incomingPageIndex = typeof data.pageIndex === 'number' ? data.pageIndex : 0;

      // Aggiorna lo stato della pagina nella cache
      if (pagesRef.current[incomingPageIndex]) {
        pagesRef.current[incomingPageIndex].elements = data.elements || [];
        if (data.files) {
          pagesRef.current[incomingPageIndex].files = {
            ...pagesRef.current[incomingPageIndex].files,
            ...data.files
          };
        }
      }

      // Se l'aggiornamento riguarda la pagina attualmente visibile dall'utente, renderizza a video
      if (incomingPageIndex === currentPageIndexRef.current) {
        isRemoteUpdateRef.current = true;
        try {
          if (data.files && Object.keys(data.files).length > 0) {
            excalidrawAPI.addFiles(Object.values(data.files));
          }
          if (data.elements) {
            excalidrawAPI.updateScene({
              elements: data.elements,
              appState: data.appState ? { viewBackgroundColor: data.appState.viewBackgroundColor } : undefined
            });
            lastSceneVersionRef.current = computeSceneVersion(data.elements);
          }
        } catch (err) {
          console.error('[ZenBoard] Errore elaborazione tratti remoti:', err);
        } finally {
          setTimeout(() => {
            isRemoteUpdateRef.current = false;
          }, 100);
        }
      }
    });

    // Cambio pagina inviato dal docente
    socket.on('page-change', ({ pageIndex }) => {
      if (typeof pageIndex === 'number' && pagesRef.current[pageIndex]) {
        setCurrentPageIndex(pageIndex);
        currentPageIndexRef.current = pageIndex;
        loadPageIntoCanvas(pagesRef.current[pageIndex]);
        showToast(`Passato a Pagina ${pageIndex + 1}`, 'info');
      }
    });

    // Pagine aggiunte, duplicate o eliminate
    socket.on('pages-updated', ({ pages: newPages, currentPageIndex: newIdx }) => {
      setPages(newPages);
      pagesRef.current = newPages;
      setCurrentPageIndex(newIdx);
      currentPageIndexRef.current = newIdx;
      loadPageIntoCanvas(newPages[newIdx]);
    });

    // Cursori collaborativi
    socket.on('cursor-update', (cursorData) => {
      if (!cursorData || !excalidrawAPI || !cursorData.socketId) return;

      collaboratorsMapRef.current.set(cursorData.socketId, {
        pointer: cursorData.pointer,
        button: cursorData.button || 'up',
        username: cursorData.username || 'Partecipante',
        color: cursorData.color || { background: '#3b82f6', stroke: '#1d4ed8' }
      });

      excalidrawAPI.updateScene({
        collaborators: new Map(collaboratorsMapRef.current)
      });
    });

    socket.on('cursor-remove', ({ socketId }) => {
      if (collaboratorsMapRef.current.has(socketId) && excalidrawAPI) {
        collaboratorsMapRef.current.delete(socketId);
        excalidrawAPI.updateScene({
          collaborators: new Map(collaboratorsMapRef.current)
        });
      }
    });

    socket.on('lesson-name-updated', (newName) => {
      setLessonName(newName);
      showToast(`Titolo aggiornato: "${newName}"`, 'info');
    });

    socket.on('board-cleared', () => {
      if (excalidrawAPI) {
        isRemoteUpdateRef.current = true;
        excalidrawAPI.resetScene();
        lastSceneVersionRef.current = 0;
        showToast('Pagina corrente ripulita.', 'info');
        setTimeout(() => {
          isRemoteUpdateRef.current = false;
        }, 150);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [excalidrawAPI, backendUrl, loadPageIntoCanvas, token]);

  // ----------------------------------------------------
  // GESTIONE CAMBIO SCENA CON THROTTLE
  // ----------------------------------------------------
  const handleSceneChange = useCallback(
    (elements, appState, files) => {
      if (isRemoteUpdateRef.current) return;

      const currentVersion = computeSceneVersion(elements);
      if (currentVersion === lastSceneVersionRef.current) return;

      // Aggiorna la memoria locale della pagina corrente
      const activeIdx = currentPageIndexRef.current;
      if (pagesRef.current[activeIdx]) {
        pagesRef.current[activeIdx].elements = elements;
        pagesRef.current[activeIdx].files = files;
      }

      const now = Date.now();
      if (now - lastEmitTimeRef.current < 60) return;

      lastEmitTimeRef.current = now;
      lastSceneVersionRef.current = currentVersion;

      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('excalidraw-update', {
          pageIndex: activeIdx,
          elements,
          files,
          appState: {
            viewBackgroundColor: appState.viewBackgroundColor
          },
          lessonName
        });
      }
    },
    [lessonName]
  );

  const handlePointerUpdate = useCallback(({ pointer, button }) => {
    if (!socketRef.current || !socketRef.current.connected) return;

    socketRef.current.emit('cursor-update', {
      pointer,
      button,
      username: userNameRef.current,
      color: userColorRef.current
    });
  }, []);

  // ----------------------------------------------------
  // GESTIONE NAVIGAZIONE MULTI-PAGINA
  // ----------------------------------------------------
  const handlePageChange = (targetIndex) => {
    if (!excalidrawAPI || targetIndex < 0 || targetIndex >= pages.length) return;

    // 1. Salva lo stato della pagina attuale prima di voltare pagina
    const currentElements = excalidrawAPI.getSceneElements();
    const currentFiles = excalidrawAPI.getFiles();

    const updatedPages = [...pagesRef.current];
    updatedPages[currentPageIndexRef.current] = {
      ...updatedPages[currentPageIndexRef.current],
      elements: currentElements,
      files: currentFiles
    };

    pagesRef.current = updatedPages;
    setPages(updatedPages);

    // 2. Passa alla nuova pagina
    setCurrentPageIndex(targetIndex);
    currentPageIndexRef.current = targetIndex;
    loadPageIntoCanvas(updatedPages[targetIndex]);

    // 3. Sincronizza tutti gli studenti
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('page-change', { pageIndex: targetIndex });
    }
  };

  const handleAddPage = () => {
    // Solo Premium può aggiungere pagine
    if (!isPremium) {
      showToast('🔒 Gestione pagine disponibile solo per utenti Premium', 'error');
      return;
    }

    // 1. Salva sempre lo stato della pagina attuale prima di crearne una nuova
    if (excalidrawAPI) {
      const currentElements = excalidrawAPI.getSceneElements();
      const currentFiles = excalidrawAPI.getFiles();
      pagesRef.current[currentPageIndexRef.current] = {
        ...pagesRef.current[currentPageIndexRef.current],
        elements: currentElements,
        files: currentFiles
      };
    }

    // 2. Crea la nuova pagina vuota
    const newPage = {
      id: `page-${Date.now()}`,
      title: `Pagina ${pagesRef.current.length + 1}`,
      elements: [],
      files: {}
    };

    const nextPages = [...pagesRef.current, newPage];
    const nextIndex = nextPages.length - 1;

    // 3. Aggiorna IMMEDIATAMENTE lo stato locale su questo client
    pagesRef.current = nextPages;
    setPages(nextPages);
    currentPageIndexRef.current = nextIndex;
    setCurrentPageIndex(nextIndex);

    // 4. Resetta il canvas per la nuova pagina
    if (excalidrawAPI) {
      isRemoteUpdateRef.current = true;
      excalidrawAPI.resetScene();
      lastSceneVersionRef.current = 0;
      setTimeout(() => {
        isRemoteUpdateRef.current = false;
      }, 100);
    }

    // 5. Invia al server Socket.io per allineare gli altri partecipanti
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('page-add', {
        pages: nextPages,
        currentPageIndex: nextIndex
      });
    }

    showToast(`Creata Pagina ${nextPages.length}`, 'success');
  };

  const handleDuplicatePage = (indexToDuplicate) => {
    if (!isPremium) {
      showToast('🔒 Gestione pagine disponibile solo per utenti Premium', 'error');
      return;
    }

    const sourceIndex = typeof indexToDuplicate === 'number' ? indexToDuplicate : currentPageIndexRef.current;
    const sourcePage = pagesRef.current[sourceIndex];
    if (!sourcePage) return;

    if (excalidrawAPI && sourceIndex === currentPageIndexRef.current) {
      sourcePage.elements = excalidrawAPI.getSceneElements();
      sourcePage.files = excalidrawAPI.getFiles();
    }

    const duplicatedPage = {
      id: `page-${Date.now()}`,
      title: `${sourcePage.title} (Copia)`,
      elements: JSON.parse(JSON.stringify(sourcePage.elements || [])),
      files: JSON.parse(JSON.stringify(sourcePage.files || {}))
    };

    const nextPages = [...pagesRef.current];
    nextPages.splice(sourceIndex + 1, 0, duplicatedPage);
    const nextIndex = sourceIndex + 1;

    pagesRef.current = nextPages;
    setPages(nextPages);
    currentPageIndexRef.current = nextIndex;
    setCurrentPageIndex(nextIndex);
    loadPageIntoCanvas(duplicatedPage);

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('page-duplicate', {
        pages: nextPages,
        currentPageIndex: nextIndex
      });
    }
    showToast(`Pagina duplicata`, 'success');
  };

  const onDeletePage = (indexToDelete) => {
    if (!isPremium) {
      showToast('🔒 Gestione pagine disponibile solo per utenti Premium', 'error');
      return;
    }

    if (pagesRef.current.length <= 1) {
      showToast("Impossibile eliminare l'unica pagina della lavagna.", 'error');
      return;
    }

    if (window.confirm(`Eliminare definitivamente la Pagina ${indexToDelete + 1}?`)) {
      const nextPages = [...pagesRef.current];
      nextPages.splice(indexToDelete, 1);

      let nextIndex = currentPageIndexRef.current;
      if (nextIndex >= nextPages.length) {
        nextIndex = nextPages.length - 1;
      }

      pagesRef.current = nextPages;
      setPages(nextPages);
      currentPageIndexRef.current = nextIndex;
      setCurrentPageIndex(nextIndex);
      loadPageIntoCanvas(nextPages[nextIndex]);

      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('page-delete', {
          pages: nextPages,
          currentPageIndex: nextIndex
        });
      }
      showToast(`Pagina eliminata`, 'info');
    }
  };

  // ----------------------------------------------------
  // GESTIONE STRUMENTI
  // ----------------------------------------------------
  const handleSelectTool = (toolId) => {
    if (!excalidrawAPI) return;
    setActiveTool(toolId);

    switch (toolId) {
      case 'selection':
        excalidrawAPI.setActiveTool({ type: 'selection' });
        break;
      case 'pen':
        excalidrawAPI.setActiveTool({ type: 'freedraw' });
        excalidrawAPI.updateScene({
          appState: {
            currentItemStrokeColor: '#1e293b',
            currentItemOpacity: 100,
            currentItemStrokeWidth: 2,
            currentItemRoughness: 0
          }
        });
        break;
      case 'highlighter':
        excalidrawAPI.setActiveTool({ type: 'freedraw' });
        excalidrawAPI.updateScene({
          appState: {
            currentItemStrokeColor: '#facc15',
            currentItemOpacity: 35,
            currentItemStrokeWidth: 6,
            currentItemRoughness: 0
          }
        });
        break;
      case 'eraser':
        excalidrawAPI.setActiveTool({ type: 'eraser' });
        break;
      case 'text':
        excalidrawAPI.setActiveTool({ type: 'text' });
        break;
      case 'rectangle':
        excalidrawAPI.setActiveTool({ type: 'rectangle' });
        break;
      case 'ellipse':
        excalidrawAPI.setActiveTool({ type: 'ellipse' });
        break;
      case 'arrow':
        excalidrawAPI.setActiveTool({ type: 'arrow' });
        break;
      default:
        break;
    }
  };

  const handleTriggerUploadImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !excalidrawAPI) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataURL = reader.result;
      const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      const binaryFileData = {
        id: fileId,
        dataURL: dataURL,
        mimeType: file.type,
        created: Date.now(),
        lastRetrieved: Date.now()
      };

      excalidrawAPI.addFiles([binaryFileData]);

      const imageElement = {
        type: 'image',
        fileId: fileId,
        status: 'saved',
        x: Math.max(100, window.innerWidth / 2 - 200),
        y: Math.max(100, window.innerHeight / 2 - 150),
        width: 360,
        height: 240,
        strokeColor: 'transparent',
        backgroundColor: 'transparent',
        fillStyle: 'hachure',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 100,
        angle: 0,
        seed: Math.floor(Math.random() * 100000),
        version: 1,
        versionNonce: Math.floor(Math.random() * 100000),
        isDeleted: false,
        groupIds: [],
        frameId: null,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false
      };

      const currentElements = excalidrawAPI.getSceneElements();
      const updatedElements = [...currentElements, imageElement];

      excalidrawAPI.updateScene({ elements: updatedElements });

      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('excalidraw-update', {
          pageIndex: currentPageIndexRef.current,
          elements: updatedElements,
          files: { [fileId]: binaryFileData },
          lessonName
        });
      }

      showToast(`Immagine "${file.name}" inserita!`, 'success');
      e.target.value = '';
    };

    reader.readAsDataURL(file);
  };

  // ----------------------------------------------------
  // NUOVA LEZIONE (Solo Premium): svuota la lavagna condivisa e la rinomina,
  // utile per passare da un corso all'altro mantenendo lezioni separate su Drive.
  // ----------------------------------------------------
  const handleNewLesson = () => {
    if (!isPremium) {
      showToast('🔒 Creare una nuova lezione è disponibile solo per utenti Premium', 'error');
      return;
    }

    if (!window.confirm('Creare una nuova lezione vuota? Se vuoi conservare quella attuale, salvala prima su Drive.')) {
      return;
    }

    const newName = window.prompt('Nome della nuova lezione:', 'Nuova Lezione');
    if (newName === null) return;
    const finalName = newName.trim() || 'Nuova Lezione';

    const blankPage = {
      id: `page-${Date.now()}`,
      title: 'Pagina 1',
      elements: [],
      files: {}
    };

    pagesRef.current = [blankPage];
    setPages([blankPage]);
    currentPageIndexRef.current = 0;
    setCurrentPageIndex(0);
    setLessonName(finalName);

    if (excalidrawAPI) {
      isRemoteUpdateRef.current = true;
      excalidrawAPI.resetScene();
      lastSceneVersionRef.current = 0;
      setTimeout(() => {
        isRemoteUpdateRef.current = false;
      }, 100);
    }

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('new-lesson', { lessonName: finalName });
    }

    showToast(`📋 Nuova lezione creata: "${finalName}"`, 'success');
  };

  const handleClearBoard = () => {
    if (window.confirm('Vuoi ripulire la pagina attuale?')) {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('clear-board');
      } else if (excalidrawAPI) {
        excalidrawAPI.resetScene();
      }
    }
  };

  const handleUndo = () => excalidrawAPI?.history?.undo();
  const handleRedo = () => excalidrawAPI?.history?.redo();

  const handleUpdateLessonName = (newName) => {
    if (!isPremium) {
      showToast('🔒 Rinominare la lezione è disponibile solo per utenti Premium', 'error');
      return;
    }
    setLessonName(newName);
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('update-lesson-name', newName);
    }
  };

  const handleToggleRole = () => {
    if (!isPremium) return;
    const nextRole = userRole === 'teacher' ? 'student' : 'teacher';
    setUserRole(nextRole);
    userNameRef.current = nextRole === 'teacher' ? 'Docente' : `Studente-${Math.floor(Math.random() * 900 + 100)}`;
    showToast(`Ruolo: ${nextRole === 'teacher' ? 'Docente' : 'Studente'}`, 'info');
  };

  // ----------------------------------------------------
  // EXPORT PDF (Disponibile per TUTTI: Guest + Premium)
  // ----------------------------------------------------
  const handleExportPdf = async () => {
    if (!excalidrawAPI) return;

    setIsExportingPdf(true);
    showToast('📄 Generazione PDF in corso...', 'info');

    try {
      const { jsPDF } = await import('jspdf');

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [1920, 1080]
      });

      // Esporta tutte le pagine
      const allPages = [...pagesRef.current];

      // Aggiorna la pagina corrente con gli elementi attuali
      allPages[currentPageIndexRef.current] = {
        ...allPages[currentPageIndexRef.current],
        elements: excalidrawAPI.getSceneElements(),
        files: excalidrawAPI.getFiles()
      };

      for (let i = 0; i < allPages.length; i++) {
        const page = allPages[i];
        if (i > 0) {
          pdf.addPage([1920, 1080], 'landscape');
        }

        const pageElements = page.elements || [];
        if (pageElements.length === 0) continue;

        try {
          // Usa exportToBlob di Excalidraw per generare un'immagine della pagina
          const blob = await exportToBlob({
            elements: pageElements,
            appState: {
              exportWithDarkMode: false,
              exportBackground: true,
              viewBackgroundColor: '#ffffff'
            },
            files: page.files || {},
            getDimensions: () => ({ width: 1920, height: 1080, scale: 2 })
          });

          const imgUrl = URL.createObjectURL(blob);
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imgUrl;
          });

          pdf.addImage(img, 'PNG', 0, 0, 1920, 1080);
          URL.revokeObjectURL(imgUrl);
        } catch (exportErr) {
          console.warn(`[ZenBoard] Errore export pagina ${i + 1}:`, exportErr);
          // Pagina vuota nel PDF se l'export fallisce
          pdf.setFontSize(24);
          pdf.text(`Pagina ${i + 1} - ${page.title || ''}`, 60, 60);
        }
      }

      const fileName = `${lessonName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fileName);

      showToast(`📄 PDF "${fileName}" scaricato con successo! (${allPages.length} pagine)`, 'success');
    } catch (err) {
      console.error('[ZenBoard] Errore generazione PDF:', err);
      showToast('Errore durante la generazione del PDF.', 'error');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // ----------------------------------------------------
  // SALVATAGGIO & CARICAMENTO SU GOOGLE DRIVE (Solo Premium)
  // ----------------------------------------------------
  const handleSaveToDrive = async (customFilename) => {
    if (!excalidrawAPI || !isPremium) {
      if (!isPremium) showToast('🔒 Salvataggio su Drive disponibile solo per utenti Premium', 'error');
      return;
    }

    setIsSaving(true);
    try {
      // Aggiorna gli elementi della pagina corrente prima del salvataggio
      const currentElements = excalidrawAPI.getSceneElements();
      const currentFiles = excalidrawAPI.getFiles();
      const appState = excalidrawAPI.getAppState();

      const finalPages = [...pagesRef.current];
      finalPages[currentPageIndexRef.current] = {
        ...finalPages[currentPageIndexRef.current],
        elements: currentElements,
        files: currentFiles
      };

      const filename = customFilename || `${lessonName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;

      const response = await authFetch(`${backendUrl}/api/save`, {
        method: 'POST',
        body: JSON.stringify({
          filename,
          lessonName,
          pages: finalPages,
          currentPageIndex: currentPageIndexRef.current,
          appState: {
            viewBackgroundColor: appState.viewBackgroundColor
          }
        })
      });

      const result = await response.json();
      if (result.success) {
        showToast(`💾 Salvate ${result.totalPages} pagine su Drive: ${result.filename}`, 'success');
        setIsSaveModalOpen(false);
      } else {
        showToast(`Errore salvataggio: ${result.error}`, 'error');
      }
    } catch (err) {
      console.error('[ZenBoard] Errore salvataggio:', err);
      showToast('Impossibile contattare il backend per il salvataggio.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadFromDrive = async (filename) => {
    if (!excalidrawAPI || !isPremium) return;

    try {
      showToast(`Caricamento lezione "${filename}" in corso...`, 'info');
      const response = await authFetch(`${backendUrl}/api/load/${encodeURIComponent(filename)}?broadcast=true`);
      const result = await response.json();

      if (result.success && result.data) {
        const { pages: loadedPages, lessonName: loadedLessonName } = result.data;

        if (Array.isArray(loadedPages) && loadedPages.length > 0) {
          setPages(loadedPages);
          pagesRef.current = loadedPages;
          setCurrentPageIndex(0);
          currentPageIndexRef.current = 0;
          loadPageIntoCanvas(loadedPages[0]);
        }

        if (loadedLessonName) {
          setLessonName(loadedLessonName);
        }

        setIsFilesModalOpen(false);
        showToast(`Lezione "${filename}" caricata (${loadedPages?.length || 1} pagine)!`, 'success');
      } else {
        showToast(`Errore caricamento: ${result.error}`, 'error');
      }
    } catch (err) {
      console.error('[ZenBoard] Errore caricamento:', err);
      showToast('Errore lettura da Google Drive.', 'error');
    }
  };

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-slate-50 select-none">
      {/* 1. Header Superiore ZenBoard (Altezza fissa, mai sovrapposto al canvas) */}
      <Header
        lessonName={lessonName}
        onUpdateLessonName={handleUpdateLessonName}
        isConnected={isConnected}
        usersCount={usersCount}
        onOpenSaveModal={isPremium ? () => setIsSaveModalOpen(true) : null}
        onOpenFilesModal={isPremium ? () => setIsFilesModalOpen(true) : null}
        onQuickSave={isPremium ? () => handleSaveToDrive() : null}
        onNewLesson={isPremium ? handleNewLesson : null}
        isSaving={isSaving}
        userRole={userRole}
        onToggleRole={handleToggleRole}
        pages={pages}
        currentPageIndex={currentPageIndex}
        onPageChange={handlePageChange}
        onAddPage={handleAddPage}
        onDuplicatePage={handleDuplicatePage}
        onDeletePage={onDeletePage}
        isPremium={isPremium}
        onExportPdf={handleExportPdf}
        isExportingPdf={isExportingPdf}
        onLogout={logout}
        userDisplayName={user?.displayName || (isPremium ? 'Docente' : 'Ospite')}
      />

      {/* 2. Area Canvas della Lavagna (Occupa tutto lo spazio rimanente) */}
      <div className="relative flex-1 w-full h-[calc(100vh-3.25rem)]">
        {/* Toolbar Galleggiante Jamboard */}
        <Toolbar
          activeTool={activeTool}
          onSelectTool={handleSelectTool}
          onUploadImage={handleTriggerUploadImage}
          onClearBoard={handleClearBoard}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />

        {/* Input File nascosto per caricamento immagini diretto */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />

        {/* Canvas Excalidraw */}
        <div className="excalidraw-wrapper">
          <Excalidraw
            excalidrawAPI={(api) => setExcalidrawAPI(api)}
            onChange={handleSceneChange}
            onPointerUpdate={handlePointerUpdate}
            UIOptions={{
              canvasActions: {
                changeViewBackgroundColor: true,
                clearCanvas: false,
                loadScene: false,
                saveToActiveFile: false,
                theme: true,
                saveAsImage: true,
                export: false
              },
              welcomeScreen: false
            }}
            langCode="it-IT"
          />
        </div>
      </div>

      {/* Modali Premium (Solo visibili per utenti autenticati) */}
      {isPremium && (
        <>
          <SaveModal
            isOpen={isSaveModalOpen}
            onClose={() => setIsSaveModalOpen(false)}
            onSave={handleSaveToDrive}
            defaultName={lessonName}
            isSaving={isSaving}
          />

          <FilesListModal
            isOpen={isFilesModalOpen}
            onClose={() => setIsFilesModalOpen(false)}
            onLoadLesson={handleLoadFromDrive}
            backendUrl={backendUrl}
            authFetch={authFetch}
          />
        </>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
