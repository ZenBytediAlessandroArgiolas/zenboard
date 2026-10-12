import React, { useState, useRef, useEffect } from 'react';
import {
  Save,
  FolderOpen,
  Users,
  WifiOff,
  Share2,
  HardDrive,
  Edit2,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Download,
  LogOut,
  Lock,
  Shield,
  Loader2,
  PlusCircle,
  Hash
} from 'lucide-react';
import PageNavigator from './PageNavigator';

export default function Header({
  lessonName,
  onUpdateLessonName,
  roomId,
  isConnected,
  usersCount,
  onOpenSaveModal,
  onOpenFilesModal,
  onQuickSave,
  onNewLesson,
  isSaving,
  userRole,
  onToggleRole,
  pages,
  currentPageIndex,
  onPageChange,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  isPremium,
  onExportPdf,
  isExportingPdf,
  onLogout,
  userDisplayName
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(lessonName);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const handleTitleSubmit = (e) => {
    e.preventDefault();
    if (tempTitle.trim()) {
      onUpdateLessonName(tempTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const handleShare = () => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const shareUrl = roomId
      ? `${origin}${pathname}?lezione=${encodeURIComponent(roomId)}`
      : window.location.href;

    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="w-full h-13 px-4 py-2 bg-white/95 border-b border-slate-200/80 relative z-10 flex items-center justify-between gap-4 shadow-xs flex-shrink-0">
      {/* Sezione Sinistra: Logo ZenByte & Nome ZenBoard + Titolo Lezione + Codice Stanza */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="ZenByte Logo"
            className="w-7 h-7 object-contain rounded-lg filter drop-shadow-xs"
          />
          <div className="flex flex-col leading-none">
            <span className="font-extrabold text-slate-900 text-sm tracking-tight">
              Zen<span className="text-amber-600">Board</span>
            </span>
            <span className="text-[8px] font-medium text-slate-400 tracking-wider uppercase">
              by ZenByte
            </span>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-200 hidden sm:block mx-1" />

        {/* Titolo Lezione Modificabile al volo (Solo Premium) */}
        <div className="flex items-center gap-2">
          {isPremium && isEditingTitle ? (
            <form onSubmit={handleTitleSubmit} className="flex items-center gap-1">
              <input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                autoFocus
                onBlur={handleTitleSubmit}
                className="text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg border border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <button
                type="submit"
                className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <button
              onClick={() => {
                if (!isPremium) return;
                setTempTitle(lessonName);
                setIsEditingTitle(true);
              }}
              title={isPremium ? 'Clicca per rinominare la lezione' : 'Login come Docente per rinominare'}
              className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg transition-colors ${
                isPremium
                  ? 'text-slate-700 hover:text-amber-700 hover:bg-slate-100 cursor-pointer'
                  : 'text-slate-500 cursor-default'
              }`}
            >
              <span className="max-w-[120px] md:max-w-[200px] truncate">{lessonName}</span>
              {isPremium && <Edit2 className="w-3 h-3 text-slate-400" />}
            </button>
          )}

          {/* Badge pillola con codice stanza */}
          {roomId && (
            <span
              title={`Codice stanza per studenti: ${roomId}`}
              className="hidden lg:flex items-center gap-1 text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/70"
            >
              <Hash className="w-2.5 h-2.5 opacity-60" />
              <span>{roomId}</span>
            </span>
          )}
        </div>
      </div>

      {/* Sezione Centrale: Navigatore Frame Multi-Pagina */}
      <div className="flex-shrink-0">
        <PageNavigator
          pages={pages}
          currentPageIndex={currentPageIndex}
          onPageChange={onPageChange}
          onAddPage={onAddPage}
          onDuplicatePage={onDuplicatePage}
          onDeletePage={onDeletePage}
          userRole={userRole}
          isPremium={isPremium}
        />
      </div>

      {/* Sezione Destra: Pillola Ridotta con Popup Menu */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Pulsante Export PDF (Disponibile per TUTTI) */}
        <button
          onClick={onExportPdf}
          disabled={isExportingPdf}
          title="Scarica la lezione come PDF"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200/70 bg-slate-100/90 hover:bg-sky-100 hover:border-sky-300 text-slate-700 hover:text-sky-700 text-xs font-medium transition-all disabled:opacity-50 cursor-pointer"
        >
          {isExportingPdf ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">PDF</span>
        </button>

        {/* Menu Pannello */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            title="Gestione sessione, Google Drive e condivisione"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all duration-150 cursor-pointer ${
              isMenuOpen
                ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                : 'bg-slate-100/90 text-slate-700 hover:bg-slate-200/90 hover:text-slate-900 border-slate-200/70'
            }`}
          >
            {/* Indicatore Stato Connessione */}
            <span className="relative flex h-2 w-2">
              {isConnected ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              )}
            </span>

            {/* Conteggio Utenti Online nella stanza */}
            <div className="flex items-center gap-1 font-semibold">
              <Users className="w-3.5 h-3.5 opacity-70" />
              <span>{usersCount}</span>
            </div>

            <div className={`h-3 w-px ${isMenuOpen ? 'bg-slate-700' : 'bg-slate-300'}`} />

            {/* Badge Ruolo */}
            <span className="hidden sm:flex items-center gap-1">
              {isPremium ? (
                <>
                  <Shield className="w-3 h-3 text-amber-400" />
                  <span>{userDisplayName}</span>
                </>
              ) : (
                <span>Ospite</span>
              )}
            </span>

            {isMenuOpen ? (
              <ChevronUp className="w-3.5 h-3.5 opacity-70" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            )}
          </button>

          {/* POPUP CARD MODERNO ESPANDIBILE */}
          {isMenuOpen && (
            <div className="absolute right-0 top-11 w-84 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/90 p-4 z-50 animate-fade-in-slide flex flex-col gap-3">
              {/* Header del Popup */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="ZenByte" className="w-6 h-6 object-contain" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 leading-none">
                      Pannello ZenBoard
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      {isPremium ? 'Accesso Docente' : 'Modalità Ospite'}
                    </span>
                  </div>
                </div>

                {/* Status Badge */}
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                    isConnected
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                      : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                  }`}
                >
                  {isConnected ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Connesso</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3 h-3 text-rose-500" />
                      <span>Disconnesso</span>
                    </>
                  )}
                </div>
              </div>

              {/* Scheda Partecipanti e Ruolo */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100/80 text-amber-800 flex items-center justify-center">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      {usersCount} {usersCount === 1 ? 'partecipante' : 'partecipanti'}
                    </p>
                    <p className="text-[10px] text-slate-400">nella stanza live</p>
                  </div>
                </div>

                {/* Badge tipo di accesso */}
                <div className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                  isPremium
                    ? 'bg-amber-50 text-amber-800 border-amber-200/60'
                    : 'bg-sky-50 text-sky-800 border-sky-200/60'
                }`}>
                  {isPremium ? '🔐 Docente' : '🔓 Ospite'}
                </div>
              </div>

              {/* Informazione Codice Stanza */}
              {roomId && (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[11px] text-slate-500">Stanza:</span>
                    <span className="text-[11px] font-mono font-bold text-slate-800">{roomId}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">isolata per classe</span>
                </div>
              )}

              {/* Azioni Docente: Nuova Lezione e Google Drive */}
              {isPremium && (
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    Gestione Lezioni
                  </span>

                  {/* Pulsante Nuova Lezione per nuova classe */}
                  {onNewLesson && (
                    <button
                      onClick={() => {
                        onNewLesson();
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center justify-between w-full px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-all cursor-pointer border border-slate-200"
                    >
                      <div className="flex items-center gap-2">
                        <PlusCircle className="w-4 h-4 text-amber-600" />
                        <span>Nuova Lezione (Nuova Classe)</span>
                      </div>
                      <span className="text-[10px] text-slate-400">+ Nuova</span>
                    </button>
                  )}

                  {/* Salva su Drive */}
                  {onQuickSave && (
                    <button
                      onClick={() => {
                        onQuickSave();
                        setIsMenuOpen(false);
                      }}
                      disabled={isSaving}
                      className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-semibold shadow-sm shadow-amber-600/20 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Save className="w-4 h-4" />
                        <span>{isSaving ? 'Salvataggio...' : 'Salva Lezione su Drive'}</span>
                      </div>
                      <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">
                        .json
                      </span>
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {onOpenSaveModal && (
                      <button
                        onClick={() => {
                          onOpenSaveModal();
                          setIsMenuOpen(false);
                        }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
                      >
                        <HardDrive className="w-3.5 h-3.5" />
                        <span>Salva con nome</span>
                      </button>
                    )}

                    {onOpenFilesModal && (
                      <button
                        onClick={() => {
                          onOpenFilesModal();
                          setIsMenuOpen(false);
                        }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Apri Lezioni</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Azioni Guest */}
              {!isPremium && (
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    Funzionalità Ospite
                  </span>

                  <button
                    onClick={() => {
                      onExportPdf();
                      setIsMenuOpen(false);
                    }}
                    disabled={isExportingPdf}
                    className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white text-xs font-semibold shadow-sm shadow-sky-600/20 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      <span>{isExportingPdf ? 'Generazione...' : 'Scarica Lezione in PDF'}</span>
                    </div>
                    <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">
                      .pdf
                    </span>
                  </button>

                  <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-200/50 text-[10px] text-sky-900 leading-tight flex items-start gap-1.5">
                    <Lock className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span>
                      Il salvataggio su Google Drive e la gestione pagine sono riservati al Docente.
                    </span>
                  </div>
                </div>
              )}

              <div className="h-px bg-slate-100 my-0.5" />

              {/* Condivisione Sessione (Link specifico con ?lezione=codice) */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  Condivisione
                </span>
                <button
                  onClick={handleShare}
                  className={`flex items-center justify-between w-full px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    copiedLink
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Share2 className="w-3.5 h-3.5" />
                    <span>{copiedLink ? 'Link Copiato!' : 'Copia Link Studenti'}</span>
                  </div>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </button>
              </div>

              {/* Pulsante Logout / Cambia Modalità */}
              <button
                onClick={() => {
                  onLogout();
                  setIsMenuOpen(false);
                }}
                className="flex items-center gap-2 w-full px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-medium transition-colors border border-slate-200/60 hover:border-rose-200 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{isPremium ? 'Esci (Logout)' : 'Torna al Login'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
