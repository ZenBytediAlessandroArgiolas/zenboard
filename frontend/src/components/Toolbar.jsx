import React, { useState } from 'react';
import {
  MousePointer,
  Pen,
  Highlighter,
  Eraser,
  Image as ImageIcon,
  Type,
  Square,
  Circle,
  ArrowRight,
  Trash2,
  Undo,
  Redo,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

/**
 * Dock Didattico Orizzontale Fluttuante a Fondo Schermo (Stile Apple Freeform / Miro / Figma).
 * Posizionato in basso al centro per lasciare il lato sinistro dello schermo COMPLETAMENTE
 * libero per i menu a comparsa e i pannelli delle proprietà di Excalidraw (colori, stili, ecc.).
 */
export default function Toolbar({
  activeTool,
  onSelectTool,
  onUploadImage,
  onClearBoard,
  onUndo,
  onRedo
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const mainTools = [
    {
      id: 'selection',
      label: 'Seleziona / Sposta (V)',
      icon: MousePointer
    },
    {
      id: 'pen',
      label: 'Penna Inchiostro (P)',
      icon: Pen
    },
    {
      id: 'highlighter',
      label: 'Evidenziatore Fluo (H)',
      icon: Highlighter
    },
    {
      id: 'eraser',
      label: 'Gomma Tratti (E)',
      icon: Eraser
    },
    {
      id: 'image',
      label: 'Carica Immagine (I)',
      icon: ImageIcon,
      action: onUploadImage
    },
    {
      id: 'text',
      label: 'Testo (T)',
      icon: Type
    }
  ];

  const shapeTools = [
    {
      id: 'rectangle',
      label: 'Rettangolo (R)',
      icon: Square
    },
    {
      id: 'ellipse',
      label: 'Cerchio (C)',
      icon: Circle
    },
    {
      id: 'arrow',
      label: 'Freccia (A)',
      icon: ArrowRight
    }
  ];

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 transition-all duration-200 select-none">
      <div className="flex items-center gap-1.5 p-1.5 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/80 hover:shadow-2xl">
        {/* Pulsante Minimizza / Espandi Dock */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Mostra strumenti' : 'Minimizza barra strumenti'}
          className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {!isCollapsed && (
          <>
            {/* Strumenti Principali Didattici */}
            <div className="flex items-center gap-1">
              {mainTools.map((tool) => {
                const Icon = tool.icon;
                const isActive = activeTool === tool.id;

                return (
                  <button
                    key={tool.id}
                    onClick={() => {
                      if (tool.action) {
                        tool.action();
                      } else {
                        onSelectTool(tool.id);
                      }
                    }}
                    title={tool.label}
                    className={`relative group flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-md shadow-slate-900/30 scale-105'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 stroke-[2.2]" />

                    {/* Tooltip in alto */}
                    <span className="absolute bottom-12 px-2.5 py-1 bg-slate-900 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 shadow-lg z-50">
                      {tool.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="w-px h-6 bg-slate-200 mx-0.5" />

            {/* Forme Geometriche */}
            <div className="flex items-center gap-1">
              {shapeTools.map((tool) => {
                const Icon = tool.icon;
                const isActive = activeTool === tool.id;

                return (
                  <button
                    key={tool.id}
                    onClick={() => onSelectTool(tool.id)}
                    title={tool.label}
                    className={`relative group flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-md shadow-slate-900/30 scale-105'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 stroke-[2.2]" />

                    {/* Tooltip in alto */}
                    <span className="absolute bottom-12 px-2.5 py-1 bg-slate-900 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 shadow-lg z-50">
                      {tool.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="w-px h-6 bg-slate-200 mx-0.5" />

            {/* Operazioni Rapide (Undo / Redo / Clear) */}
            <div className="flex items-center gap-1">
              <button
                onClick={onUndo}
                title="Annulla (Ctrl+Z)"
                className="group relative flex items-center justify-center w-10 h-10 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <Undo className="w-4 h-4" />
                <span className="absolute bottom-12 px-2 py-1 bg-slate-900 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                  Annulla
                </span>
              </button>

              <button
                onClick={onRedo}
                title="Ripristina (Ctrl+Y)"
                className="group relative flex items-center justify-center w-10 h-10 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <Redo className="w-4 h-4" />
                <span className="absolute bottom-12 px-2 py-1 bg-slate-900 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                  Ripristina
                </span>
              </button>

              <button
                onClick={onClearBoard}
                title="Pulisci pagina attuale"
                className="group relative flex items-center justify-center w-10 h-10 rounded-xl text-rose-500 hover:text-white hover:bg-rose-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span className="absolute bottom-12 px-2 py-1 bg-rose-600 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                  Pulisci Pagina
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
