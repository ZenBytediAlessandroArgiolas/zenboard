import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast({ toast, onClose }) {
  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    error: <AlertCircle className="w-4 h-4 text-rose-500" />,
    info: <Info className="w-4 h-4 text-blue-500" />
  };

  const borderColors = {
    success: 'border-emerald-200/80 bg-white/95 text-slate-800',
    error: 'border-rose-200/80 bg-white/95 text-slate-800',
    info: 'border-blue-200/80 bg-white/95 text-slate-800'
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in-slide">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-md ${
          borderColors[toast.type || 'info']
        }`}
      >
        {icons[toast.type || 'info']}
        <div className="text-xs font-medium max-w-sm leading-snug">
          {toast.message}
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg ml-1"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
