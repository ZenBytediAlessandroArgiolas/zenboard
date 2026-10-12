import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Whiteboard from './components/Whiteboard';
import LoginPage from './components/LoginPage';

/**
 * Router principale dell'app ZenBoard:
 * - Se l'utente non è autenticato → LoginPage
 * - Se l'utente è autenticato (Guest o Premium) → Whiteboard
 */
function AppRouter() {
  const { user, isLoading } = useAuth();

  // Spinner di caricamento durante la verifica del token salvato
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

  // Se non c'è utente (né guest né premium) → mostra login
  if (!user) {
    return <LoginPage />;
  }

  // Utente autenticato (guest o premium) → mostra lavagna
  return (
    <main className="w-screen h-screen overflow-hidden">
      <Whiteboard />
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
