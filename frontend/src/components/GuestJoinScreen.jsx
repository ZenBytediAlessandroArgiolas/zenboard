import React, { useState } from 'react';
import {
  Users,
  ArrowRight,
  HelpCircle,
  AlertCircle,
  LogIn,
  Layers
} from 'lucide-react';

/**
 * Schermata mostrata a un utente Ospite (Guest) quando accede a un link "nudo"
 * (senza ?lezione=codice) oppure quando il codice lezione non è più attivo.
 */
export default function GuestJoinScreen({
  onJoinRoom,
  onGoToLogin,
  initialRoomCode = '',
  errorMessage = ''
}) {
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [localError, setLocalError] = useState(errorMessage);

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanCode = roomCode
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');

    if (!cleanCode) {
      setLocalError('Inserisci il codice della lezione.');
      return;
    }
    setLocalError('');
    onJoinRoom(cleanCode);
  };

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-bg-orb login-bg-orb-1" />
        <div className="login-bg-orb login-bg-orb-2" />
        <div className="login-bg-orb login-bg-orb-3" />
      </div>

      <div className="login-container" style={{ maxWidth: '480px' }}>
        {/* Header Branding */}
        <div className="login-header">
          <div className="login-logo-wrapper">
            <img src="/logo.png" alt="ZenByte Logo" className="login-logo" />
            <div className="login-logo-glow" />
          </div>

          <div className="login-brand">
            <h1 className="login-title">
              Zen<span className="login-title-accent">Board</span>
            </h1>
            <p className="login-subtitle">Accesso Lezione Ospite</p>
          </div>
        </div>

        <div className="login-content">
          {/* Se presente un messaggio di errore (es: lezione evaporata / inesistente) */}
          {(errorMessage || localError) && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-fade-in-slide">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Lezione non disponibile</p>
                <p className="mt-0.5 text-rose-700">
                  {errorMessage || localError}
                </p>
              </div>
            </div>
          )}

          <div className="login-guest-info">
            <div className="login-guest-icon-wrapper">
              <Layers className="w-7 h-7 text-sky-500" />
            </div>
            <h3 className="login-guest-title">Inserisci il Codice Lezione</h3>
            <p className="login-guest-desc">
              Per partecipare alla lavagna della tua classe, inserisci il codice fornito dal docente (es. <code className="font-mono text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">matematica-3a</code>).
            </p>
          </div>

          {/* Form Inserimento Codice */}
          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label className="login-label">Codice Lezione</label>
              <div className="login-input-wrapper">
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => {
                    setRoomCode(e.target.value);
                    if (localError) setLocalError('');
                  }}
                  placeholder="es. matematica-3a"
                  className="login-input font-mono tracking-wide"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              className="login-submit login-submit-guest"
            >
              <Users className="w-4 h-4" />
              <span>Entra nella Lezione</span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </button>
          </form>

          {/* Opzione per tornare alla schermata di Login Docente */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Sei il docente?</span>
            <button
              type="button"
              onClick={onGoToLogin}
              className="flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-800 font-semibold p-1 hover:underline"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Accedi come Docente</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="login-footer">
          <span>ZenBoard</span>
          <span className="login-footer-sep">•</span>
          <span>by ZenByte</span>
        </div>
      </div>
    </div>
  );
}
