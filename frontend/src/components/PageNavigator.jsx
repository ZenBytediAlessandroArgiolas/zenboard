import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Copy,
  Trash2,
  Layers,
  Lock
} from 'lucide-react';

/**
 * Componente di Navigazione Pagine / Frame (Stile Google Jamboard).
 * Integrato nella barra superiore senza sovrapporsi ai menu di Excalidraw.
 * Aggiungere/duplicare/eliminare pagine è riservato agli utenti Premium:
 * gli Ospiti possono comunque navigare tra le pagine esistenti.
 */
export default function PageNavigator({
  pages,
  currentPageIndex,
  onPageChange,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  userRole,
  isPremium
}) {
  const [isOpenMenu, setIsOpenMenu] = useState(false);
  const menuRef = useRef(null);

  const totalPages = pages.length;
  const isFirstPage = currentPageIndex === 0;
  const isLastPage = currentPageIndex === totalPages - 1;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpenMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex items-center gap-1 bg-slate-100/90 px-1.5 py-1 rounded-xl border border-slate-200/70 shadow-sm">
      {/* Pagina Precedente */}
      <button
        onClick={() => onPageChange(currentPageIndex - 1)}
        disabled={isFirstPage}
        title="Pagina precedente"
        className="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
      </button>

      {/* Indicatore Pagina Corrente & Menu a tendina */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpenMenu(!isOpenMenu)}
          title="Gestisci pagine della lezione"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white transition-colors text-xs font-semibold text-slate-700 shadow-none hover:shadow-xs"
        >
          <Layers className="w-3.5 h-3.5 text-amber-600" />
          <span>
            {currentPageIndex + 1} <span className="text-slate-400 font-normal">/</span> {totalPages}
          </span>
        </button>

        {/* Dropdown Gestione Pagine */}
        {isOpenMenu && (
          <div className="absolute top-9 left-1/2 -translate-x-1/2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-1.5 z-50 animate-fade-in-slide">
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
              Pagine Lezione ({totalPages})
            </div>

            {/* Elenco Pagine */}
            <div className="max-h-48 overflow-y-auto py-1">
              {pages.map((page, idx) => (
                <button
                  key={page.id || idx}
                  onClick={() => {
                    onPageChange(idx);
                    setIsOpenMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors ${
                    idx === currentPageIndex
                      ? 'bg-amber-50 text-amber-900 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{page.title || `Pagina ${idx + 1}`}</span>
                  {idx === currentPageIndex && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                  )}
                </button>
              ))}
            </div>

            <div className="h-px bg-slate-100 my-1" />

            {/* Azioni Duplica ed Elimina (Solo Premium) */}
            <button
              onClick={() => {
                onDuplicatePage(currentPageIndex);
                setIsOpenMenu(false);
              }}
              disabled={!isPremium}
              title={isPremium ? undefined : 'Disponibile solo per utenti Premium (Docente)'}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                isPremium ? 'text-slate-700 hover:bg-slate-50' : 'text-slate-400 cursor-not-allowed'
              }`}
            >
              {isPremium ? <Copy className="w-3.5 h-3.5 text-slate-500" /> : <Lock className="w-3.5 h-3.5" />}
              <span>Duplica questa pagina</span>
            </button>

            {totalPages > 1 && (
              <button
                onClick={() => {
                  onDeletePage(currentPageIndex);
                  setIsOpenMenu(false);
                }}
                disabled={!isPremium}
                title={isPremium ? undefined : 'Disponibile solo per utenti Premium (Docente)'}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                  isPremium ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-400 cursor-not-allowed'
                }`}
              >
                {isPremium ? <Trash2 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                <span>Elimina questa pagina</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pagina Successiva */}
      <button
        onClick={() => onPageChange(currentPageIndex + 1)}
        disabled={isLastPage}
        title="Pagina successiva"
        className="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        <ChevronRight className="w-4 h-4 stroke-[2.2]" />
      </button>

      <div className="w-px h-3.5 bg-slate-200 mx-0.5" />

      {/* Aggiungi Nuova Pagina (+) - Solo Premium */}
      <button
        onClick={onAddPage}
        disabled={!isPremium}
        title={isPremium ? 'Aggiungi una nuova pagina vuota alla lezione' : 'Disponibile solo per utenti Premium (Docente)'}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
          isPremium
            ? 'bg-amber-100 hover:bg-amber-200 text-amber-900'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
        }`}
      >
        {isPremium ? <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> : <Lock className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline text-[11px]">Nuova</span>
      </button>
    </div>
  );
}
