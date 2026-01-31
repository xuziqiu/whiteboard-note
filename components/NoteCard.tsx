import React, { useState, useRef, useEffect } from 'react';
import { NoteData } from '../types';
import { MoreHorizontal, Sparkles, X, Move, Maximize2, Minimize2 } from 'lucide-react';

interface NoteCardProps {
  note: NoteData;
  isSelected: boolean;
  scale: number;
  onUpdate: (id: string, data: Partial<NoteData>) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onBrainstorm: (id: string) => void;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  isSelected,
  scale,
  onUpdate,
  onSelect,
  onDelete,
  onBrainstorm,
  onMouseDown,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.style.height = 'auto';
      contentRef.current.style.height = contentRef.current.scrollHeight + 'px';
    }
  }, [note.content]);

  const colorClasses = {
    white: 'bg-white border-slate-200',
    blue: 'bg-blue-50 border-blue-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200',
    purple: 'bg-purple-50 border-purple-200',
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(note.id);
    onMouseDown(e, note.id);
  };

  const handleAI = (e: React.MouseEvent) => {
    e.stopPropagation();
    onBrainstorm(note.id);
  };

  return (
    <div
      className={`absolute flex flex-col rounded-xl shadow-sm transition-shadow duration-200 group
        ${colorClasses[note.color]}
        ${isSelected ? 'ring-2 ring-indigo-500 shadow-xl z-20' : 'hover:shadow-md z-10'}
      `}
      style={{
        left: note.position.x,
        top: note.position.y,
        width: note.size.width,
        minHeight: note.size.height,
        // Scale transform is handled by the canvas parent usually, 
        // but here we just position absolutely. 
        // The scale prop helps us adjust interaction thresholds if needed, but not used for CSS scale here.
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(note.id);
      }}
    >
      {/* Header / Drag Handle */}
      <div
        className="h-8 flex items-center justify-between px-3 cursor-grab active:cursor-grabbing border-b border-black/5"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
           <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-indigo-500' : 'bg-slate-300'}`} />
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
           <button 
             onClick={handleAI}
             className="p-1 hover:bg-black/5 rounded text-indigo-600 transition-colors"
             title="Brainstorm with AI"
           >
             <Sparkles size={14} />
           </button>
           <button 
             onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
             className="p-1 hover:bg-red-100 rounded text-red-400 hover:text-red-500 transition-colors"
           >
             <X size={14} />
           </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-4 flex flex-col gap-2 cursor-text">
        <input
          ref={titleRef}
          value={note.title}
          onChange={(e) => onUpdate(note.id, { title: e.target.value })}
          placeholder="Title"
          className="w-full bg-transparent font-semibold text-slate-800 placeholder-slate-400 outline-none text-lg"
        />
        <textarea
          ref={contentRef}
          value={note.content}
          onChange={(e) => onUpdate(note.id, { content: e.target.value })}
          placeholder="Start typing..."
          className="w-full bg-transparent text-slate-600 placeholder-slate-300 outline-none resize-none text-sm leading-relaxed no-scrollbar flex-1 min-h-[60px]"
        />
      </div>
      
      {/* AI Indicator (Visual flair) */}
      {note.id.startsWith('ai-pending') && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-xl z-30">
           <div className="flex flex-col items-center gap-2 text-indigo-600 animate-pulse">
              <Sparkles className="animate-spin-slow" size={24} />
              <span className="text-xs font-medium">Thinking...</span>
           </div>
        </div>
      )}
    </div>
  );
};
