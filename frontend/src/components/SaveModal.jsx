import React, { useState } from 'react';
import { X, HardDrive, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SaveModal({
  isOpen,
  onClose,
  onSave,
  defaultName,
  isSaving
}) {
  const [filename, setFilename] = useState(defaultName || '');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!filename.trim()) {
      setError('Inserisci un nome valido per il file della lezione.');
      return;
    }
    setError('');
    onSave(filename.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in-slide">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-md overflow-hidden">
        {/* Header Modale */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-50 to-amber-50/50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-600/10 text-amber-600 flex items-center justify-center">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">Salva su Google Drive</h3>
              <p className="text-xs text-slate-500">Approccio Zero-API Cloud tramite Docker Volume</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Nome File Lezione (.json)
            </label>
            <div className="relative">
              <input
                type="text"
                value={filename}
                onChange={(e) => {
                  setFilename(e.target.value);
                  if (error) setError('');
                }}
                placeholder="es. Lezione_Matematica_Derivate"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                autoFocus
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 select-none">
                .json
              </span>
            </div>
            {error && (
              <p className="mt-1.5 text-xs text-rose-500 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {error}
              </p>
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-100 text-xs text-amber-900 leading-relaxed">
            💡 <strong>Zero-API Cloud:</strong> Il file verrà scritto istantaneamente in <code className="bg-white/80 px-1 py-0.5 rounded font-mono text-[11px]">/app/data</code>, mappato sulla cartella locale di Google Drive per il salvataggio automatico.
          </div>

          {/* Footer Bottoni */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-md shadow-amber-600/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                  Salvataggio in corso...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Conferma e Salva
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
