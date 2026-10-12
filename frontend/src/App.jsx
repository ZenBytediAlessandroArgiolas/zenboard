import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Whiteboard, { getBackendUrl } from './components/Whiteboard';
import LoginPage from './components/LoginPage';
import TeacherHub from './components/TeacherHub';
import GuestJoinScreen from './components/GuestJoinScreen';

/**
 * Router di ZenBoard basato su:
 * 1. Ruolo utente: Non autenticato | Guest | Premium (Docente)
 * 2. Parametro URL: ?lezione=codice-stanza
 *
 * Casi d'uso gestiti:
 * - Link con codice (?lezione=matematica-3a):
 *    - Se Docente o Guest entra direttamente nella Whiteboard collegata a quella stanza.
 *    - Se Guest entra e la stanza è scaduta (>72h) o inesistente: mostra messaggio chiaro con opzione per reinserire codice o accedere come docente.
 * - Link "nudo" (nessun codice nell'URL):
 *    - Se Docente: mostra TeacherHub con due scelte chiare ("Nuova Lezione" o "Apri da Drive").
 *    - Se Ospite (o appena cliccato "Entra come Ospite"): mostra GuestJoinScreen ("Inserisci il codice della lezione").
 *    - Se non autenticato: mostra LoginPage con i due tab.
 */
function AppRouter() {
  const { user, isPremium, isLoading, logout, authFetch, enterAsGuest } = useAuth();
  const [roomCode, setRoomCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('lezione') || '';
  });
  const [roomErrorMessage, setRoomErrorMessage] = useState('');

  // Ascolta cambi manuali dell'URL (es. back/forward del browser)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setRoomCode(params.get('lezione') || '');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Aggiorna l'URL del browser senza ricaricare la pagina
  const updateUrlRoomCode = (newCode) => {
    setRoomCode(newCode);
    setRoomErrorMessage('');
    const url = new URL(window.location.href);
    if (newCode) {
      url.searchParams.set('lezione', newCode);
    } else {
      url.searchParams.delete('lezione');
    }
    window.history.pushState({}, '', url.toString());
  };

  // Creazione nuova lezione dal TeacherHub
  const handleTeacherCreateLesson = async (lessonName) => {
    try {
      const backendUrl = getBackendUrl();
      const res = await authFetch(`${backendUrl}/api/rooms/create`, {
        method: 'POST',
        body: JSON.stringify({ lessonName })
      });
      const data = await res.json();
      if (data.success && data.roomId) {
        updateUrlRoomCode(data.roomId);
      }
    } catch (err) {
      console.error('[Router] Errore creazione stanza:', err);
    }
  };

  // Caricamento lezione salvata da Drive dal TeacherHub
  const handleTeacherLoadLesson = (filename, loadedRoomId) => {
    if (loadedRoomId) {
      updateUrlRoomCode(loadedRoomId);
    }
  };

  // Spinner di caricamento iniziale della sessione
  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <img
              src="/logo.png"
              alt="ZenBoard"
              className="w-14 h-14 object-contain rounded-2xl"
            />
            <div className="absolute inset-0 animate-ping rounded-2xl bg-amber-400/20" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-semibold text-slate-700">
              Zen<span className="text-amber-600">Board</span>
            </p>
            <p className="text-xs text-slate-400">Caricamento sessione...</p>
          </div>
          <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // 1. Utente non loggato: mostra LoginPage
  if (!user) {
    return <LoginPage />;
  }

  // 2. Errore stanza non trovata o evaporata dalla RAM (>72h) per un ospite
  if (roomErrorMessage) {
    return (
      <GuestJoinScreen
        onJoinRoom={(code) => updateUrlRoomCode(code)}
        onGoToLogin={logout}
        initialRoomCode=""
        errorMessage={roomErrorMessage}
      />
    );
  }

  // 3. Link "nudo" (nessun parametro ?lezione= nell'URL)
  if (!roomCode) {
    // A) Se è il Docente (Premium), mostra TeacherHub con "Nuova Lezione" o "Apri da Drive"
    if (isPremium) {
      return (
        <TeacherHub
          onCreateLesson={handleTeacherCreateLesson}
          onLoadLesson={handleTeacherLoadLesson}
          onLogout={logout}
          backendUrl={getBackendUrl()}
          authFetch={authFetch}
          userDisplayName={user?.displayName || 'Docente'}
        />
      );
    }

    // B) Se è un Ospite, mostra il prompt "Inserisci il codice della lezione"
    return (
      <GuestJoinScreen
        onJoinRoom={(code) => updateUrlRoomCode(code)}
        onGoToLogin={logout}
        initialRoomCode=""
      />
    );
  }

  // 4. C'è un codice stanza: monta la lavagna collegata a quella specifica stanza!
  return (
    <main className="w-screen h-screen overflow-hidden">
      <Whiteboard
        roomId={roomCode}
        onRoomChange={(newRoomId) => updateUrlRoomCode(newRoomId)}
        onRoomError={(err) => setRoomErrorMessage(err)}
      />
    </main>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
