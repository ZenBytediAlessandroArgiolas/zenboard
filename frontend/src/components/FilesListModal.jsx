import React, { useEffect, useState } from 'react';
import { X, FolderOpen, RefreshCw, FileText, ArrowRight, Clock, HardDrive } from 'lucide-react';

export default function FilesListModal({
  isOpen,
  onClose,
  onLoadLesson,
  backendUrl
}) {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchFiles = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${backendUrl}/api/files`);
      const data = await response.json();
      if (data.success) {
        setFiles(data.files);
      } else {
        setError(data.error || 'Errore nel recupero dei file.');
      }
    } catch (err) {
      setError('Impossibile contattare il server per leggere i file.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFiles();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in-slide">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header Modale */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-50 to-amber-50/50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-600/10 text-amber-600 flex items-center justify-center">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">Lezioni su Google Drive</h3>
              <p className="text-xs text-slate-500">File JSON salvati nella cartella condivisa /app/data</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={fetchFiles}
              disabled={isLoading}
              title="Aggiorna lista"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 mb-4 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-xs gap-2">
              <div className="animate-spin w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full" />
              <span>Caricamento elenco lezioni da Drive...</span>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
              <HardDrive className="w-10 h-10 stroke-1 mb-2 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">Nessuna lezione salvata</p>
              <p className="text-xs mt-1 text-slate-400 max-w-xs">
                Usa il pulsante "💾 Salva su Drive" per archiviare la tua prima lezione direttamente nella cartella cloud.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {files.map((file) => (
                <div
                  key={file.filename}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-amber-50/50 border border-slate-200/80 hover:border-amber-200 transition-all group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-9 h-9 rounded-xl bg-white text-amber-600 flex items-center justify-center shadow-sm border border-slate-100 flex-shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="text-sm font-semibold text-slate-800 truncate group-hover:text-amber-700 transition-colors">
                        {file.filename}
                      </h4>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(file.updatedAt).toLocaleString('it-IT', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        <span>•</span>
                        <span>{file.sizeFormatted}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onLoadLesson(file.filename)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white group-hover:bg-amber-600 group-hover:text-white text-slate-700 text-xs font-semibold border border-slate-200 group-hover:border-transparent shadow-sm transition-all flex-shrink-0"
                  >
                    <span>Carica</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>{files.length} lezioni trovate in archivio</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200/70 font-medium transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
