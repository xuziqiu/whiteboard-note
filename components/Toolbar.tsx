import React from 'react';
import { NoteColor } from '../types';
import { Trash2, Sparkles, FileText } from 'lucide-react';

interface ToolbarProps {
  position: { x: number; y: number };
  onColorChange: (color: NoteColor) => void;
  onDelete: () => void;
  onBrainstorm: () => void;
  onSummarize: () => void;
  isBrainstorming: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  position,
  onColorChange,
  onDelete,
  onBrainstorm,
  onSummarize,
  isBrainstorming,
}) => {
  const colors: NoteColor[] = ['white', 'blue', 'yellow', 'green', 'red', 'purple'];

  const colorStyles: Record<NoteColor, string> = {
    white: 'bg-white border-slate-200',
    blue: 'bg-[#E0F2FE] border-blue-200',
    yellow: 'bg-[#FEF3C7] border-yellow-200',
    green: 'bg-[#DCFCE7] border-green-200',
    red: 'bg-[#FEE2E2] border-red-200',
    purple: 'bg-[#F3E8FF] border-purple-200',
  };

  return (
    <div
      className="fixed z-50 flex items-center gap-2 p-2 bg-white rounded-full shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%) translateY(-12px)',
      }}
      onMouseDown={(e) => e.stopPropagation()} // Prevent canvas drag
    >
      {/* AI Actions */}
      <div className="flex gap-1">
          <button
            onClick={onBrainstorm}
            disabled={isBrainstorming}
            className={`p-2 rounded-full transition-all flex items-center gap-1.5 px-3
                ${isBrainstorming 
                    ? 'bg-slate-100 text-slate-400 cursor-wait' 
                    : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-md hover:scale-105'}
            `}
            title="Generate related ideas with AI"
          >
            <Sparkles size={16} className={isBrainstorming ? 'animate-spin' : ''} />
            <span className="text-xs font-bold hidden sm:inline">Brainstorm</span>
          </button>
          
          <button
            onClick={onSummarize}
            disabled={isBrainstorming}
            className={`p-2 rounded-full transition-all flex items-center gap-1.5 px-3 hover:bg-slate-100 text-slate-700
                ${isBrainstorming ? 'cursor-wait opacity-50' : ''}
            `}
            title="Summarize content"
          >
             <FileText size={16} />
             <span className="text-xs font-bold hidden sm:inline">Summarize</span>
          </button>
      </div>

      <div className="w-px h-6 bg-slate-200 mx-1" />

      {/* Color Picker */}
      <div className="flex gap-1">
        {colors.map((c) => (
          <button
            key={c}
            onClick={() => onColorChange(c)}
            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${colorStyles[c]}`}
            title={`Set color to ${c}`}
          />
        ))}
      </div>

      <div className="w-px h-6 bg-slate-200 mx-1" />

      {/* Delete */}
      <button
        onClick={onDelete}
        className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
        title="Delete Note"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
};