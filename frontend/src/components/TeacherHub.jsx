import React, { useState } from 'react';
import {
  PlusCircle,
  FolderOpen,
  ArrowRight,
  LogOut,
  Sparkles,
  BookOpen,
  HelpCircle
} from 'lucide-react';
import FilesListModal from './FilesListModal';

/**
 * Schermata di benvenuto per il Docente quando accede a ZenBoard senza un codice lezione specifico.
 * Offre due scelte immediate:
 * 1. "Nuova Lezione" (chiede il nome e genera lo slug URL)
 * 2. "Apri Lezione da Google Drive" (apre il modale dei file per selezionarne una)
 */
export default function TeacherHub({
  onCreateLesson,
  onLoadLesson,
  onLogout,
  backendUrl,
  authFetch,
  userDisplayName = 'Docente'
}) {
  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false);
  const [newLessonName, setNewLessonName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    const trimmed = newLessonName.trim();
    onCreateLesson(trimmed || 'Nuova Lezione');
  };

  return (
    <div className="login-page">
      {/* Sfondo animato coordinato con la login page */}
      <div className="login-bg">
        <div className="login-bg-orb login-bg-orb-1" />
        <div className="login-bg-orb login-bg-orb-2" />
        <div className="login-bg-orb login-bg-orb-3" />
      </div>

      <div className="login-container" style={{ maxWidth: '540px' }}>
        {/* Header con Logo e Saluto */}
        <div className="login-header">
          <div className="login-logo-wrapper">
            <img src="/logo.png" alt="ZenByte Logo" className="login-logo" />
            <div className="login-logo-glow" />
          </div>

          <div className="login-brand">
            <h1 className="login-title">
              Zen<span className="login-title-accent">Board</span>
            </h1>
            <p className="login-subtitle">Pannello Docente • {userDisplayName}</p>
          </div>
        </div>

        {/* Card di Selezione Azione */}
        <div className="login-content">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-slate-700 text-xs flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              Per iniziare, avvia una <strong>nuova lezione</strong> per la tua classe oppure <strong>riapri una lezione</strong> precedentemente salvata su Google Drive.
            </span>
          </div>

          {!showNameInput ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {/* Opzione 1: Nuova Lezione */}
              <button
                type="button"
                onClick={() => setShowNameInput(true)}
                className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/50 hover:bg-amber-100/60 transition-all text-slate-800 group hover:shadow-md cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform mb-3">
                  <PlusCircle className="w-6 h-6" />
                </div>
                <span className="font-bold text-sm text-slate-900">Nuova Lezione</span>
                <span className="text-[11px] text-slate-500 text-center mt-1">
                  Genera una lavagna vuota con link dedicato per la classe
                </span>
              </button>

              {/* Opzione 2: Apri da Drive */}
              <button
                type="button"
                onClick={() => setIsFilesModalOpen(true)}
                className="flex flex-col items-center justify-center p-6 rounded-2xl border border-slate-200 hover:border-slate-300 bg-white/80 hover:bg-white transition-all text-slate-800 group hover:shadow-md cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 group-hover:bg-amber-600 group-hover:text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-all mb-3">
                  <FolderOpen className="w-6 h-6" />
                </div>
                <span className="font-bold text-sm text-slate-900">Apri da Drive</span>
                <span className="text-[11px] text-slate-500 text-center mt-1">
                  Carica una lezione salvata preservandone il codice link
                </span>
              </button>
            </div>
          ) : (
            /* Input del nome lezione prima della creazione */
            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-3 pt-2 animate-fade-in-slide">
              <div className="login-field">
                <label className="login-label">Titolo della lezione / Classe</label>
                <div className="login-input-wrapper">
                  <input
                    type="text"
                    value={newLessonName}
                    onChange={(e) => setNewLessonName(e.target.value)}
                    placeholder="Es. Matematica 3A - Frazioni"
                    className="login-input"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1 pl-1">
                  Verrà generato un link condivisibile (es. <code className="font-mono text-amber-700">?lezione=matematica-3a-frazioni</code>)
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNameInput(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 login-submit login-submit-premium m-0"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Avvia Lavagna</span>
                  <ArrowRight className="w-4 h-4 ml-auto" />
                </button>
              </div>
            </form>
          )}

          {/* Pulsante Logout */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-600 transition-colors p-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Esci dall'account</span>
            </button>

            <span className="text-[10px] text-slate-400">
              Zero-API Cloud attiva
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="login-footer">
          <span>ZenBoard</span>
          <span className="login-footer-sep">•</span>
          <span>by ZenByte</span>
        </div>
      </div>

      {/* Modale per aprire file salvati da Drive */}
      <FilesListModal
        isOpen={isFilesModalOpen}
        onClose={() => setIsFilesModalOpen(false)}
        onLoadLesson={(filename, loadedRoomId) => {
          setIsFilesModalOpen(false);
          onLoadLesson(filename, loadedRoomId);
        }}
        backendUrl={backendUrl}
        authFetch={authFetch}
      />
    </div>
  );
}
