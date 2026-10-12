import React, { useEffect, useState } from 'react';
import { X, FolderOpen, RefreshCw, FileText, ArrowRight, Clock, HardDrive, Tag } from 'lucide-react';

export default function FilesListModal({
  isOpen,
  onClose,
  onLoadLesson,
  backendUrl,
  authFetch
}) {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchFiles = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await authFetch(`${backendUrl}/api/files`);
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
              <p className="text-xs text-slate-500">File salvati con codice stanza dedicato</p>
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

        {/* Lista File */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-2">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
              <p className="text-xs">Lettura file da Google Drive in corso...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          ) : files.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <HardDrive className="w-8 h-8 stroke-1 text-slate-300" />
              <p className="text-xs font-medium">Nessuna lezione salvata trovata.</p>
              <p className="text-[11px] text-slate-400 text-center max-w-xs">
                I file salvati con il pulsante "Salva su Drive" appariranno qui.
              </p>
            </div>
          ) : (
            files.map((file) => (
              <div
                key={file.filename}
                className="group p-3 rounded-2xl border border-slate-100 hover:border-amber-200 bg-slate-50/50 hover:bg-amber-50/30 transition-all flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center flex-shrink-0 group-hover:border-amber-300 group-hover:text-amber-700 transition-colors">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-amber-900 transition-colors">
                        {file.lessonName || file.filename.replace('.json', '')}
                      </p>
                      {file.roomId && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100/70 text-amber-800 border border-amber-200/50">
                          {file.roomId}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
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
                  onClick={() => onLoadLesson(file.filename, file.roomId)}
                  className="px-3 py-1.5 rounded-xl bg-white group-hover:bg-amber-600 border border-slate-200 group-hover:border-amber-600 text-slate-700 group-hover:text-white text-xs font-semibold transition-all flex items-center gap-1 flex-shrink-0 shadow-2xs cursor-pointer"
                >
                  <span>Carica</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>Zero-API Cloud Storage</span>
          <button
            onClick={onClose}
            className="hover:text-slate-700 transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
