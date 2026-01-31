import React, { useRef, useEffect, useState } from 'react';
import { NoteData } from '../types';
import { Sparkles } from 'lucide-react';

interface NoteCardProps {
  note: NoteData;
  isSelected: boolean;
  isDragging: boolean;
  isTarget?: boolean;
  scale: number;
  onUpdate: (id: string, data: Partial<NoteData>) => void;
  onSelect: (id: string) => void;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onBrainstorm?: (id: string) => void; // Optional for safety
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  isSelected,
  isDragging,
  isTarget,
  scale,
  onUpdate,
  onSelect,
  onMouseDown,
  onBrainstorm,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
    }
  }, [isEditing]);

  // Auto-resize
  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [note.content, isEditing]);

  // Sketch-style colors
  const colorClasses = {
    white: 'bg-white text-slate-800',
    blue: 'bg-[#E0F2FE] text-slate-800',
    yellow: 'bg-[#FEF3C7] text-slate-800',
    green: 'bg-[#DCFCE7] text-slate-800',
    red: 'bg-[#FEE2E2] text-slate-800',
    purple: 'bg-[#F3E8FF] text-slate-800',
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  return (
    <div
      className={`absolute flex flex-col transition-transform group
        ${colorClasses[note.color]}
        /* Sketch Style Borders and Shadows */
        border-2 border-slate-700
        ${isDragging 
            ? 'z-50 shadow-[8px_8px_0px_0px_rgba(51,65,85,0.4)] scale-[1.02] cursor-grabbing transition-none' 
            : 'z-10 shadow-[4px_4px_0px_0px_rgba(51,65,85,1)] hover:shadow-[6px_6px_0px_0px_rgba(51,65,85,1)] hover:-translate-y-0.5 cursor-grab duration-200'}
        
        ${isSelected && !isDragging ? 'ring-2 ring-dashed ring-indigo-500 ring-offset-2 z-20' : ''}
        ${isTarget ? 'ring-4 ring-indigo-400/50 scale-[1.05] z-30' : ''}
      `}
      style={{
        left: note.position.x,
        top: note.position.y,
        width: note.size.width,
        minHeight: Math.max(note.size.height, 60),
        borderRadius: '2px', // Slight rounding but mostly boxy for sketch feel
      }}
      onMouseDown={(e) => {
        if (!isEditing) {
             onMouseDown(e, note.id);
        }
      }}
      onDoubleClick={handleDoubleClick}
    >
      <div className="flex-1 p-4 flex flex-col justify-center min-h-[60px]">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={note.content}
            onChange={(e) => onUpdate(note.id, { content: e.target.value })}
            onBlur={handleBlur}
            onMouseDown={(e) => e.stopPropagation()} 
            className="w-full h-full bg-transparent outline-none resize-none text-lg leading-snug overflow-hidden"
            style={{ fontFamily: '"Patrick Hand", cursive' }}
            placeholder="Type your thought..."
          />
        ) : (
          <div 
            className="whitespace-pre-wrap text-lg leading-snug pointer-events-none select-none empty:text-slate-400 empty:after:content-['Empty_card']"
            style={{ fontFamily: '"Patrick Hand", cursive' }}
          >
            {note.content}
          </div>
        )}
      </div>

      {/* Suggestion: AI Button (visible on hover or selection) */}
      {!isDragging && !isEditing && (isSelected || true) && (
          <div className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                  onClick={(e) => {
                      e.stopPropagation();
                      if(onBrainstorm) onBrainstorm(note.id);
                  }}
                  className="bg-indigo-600 text-white p-1.5 rounded-full shadow-lg hover:bg-indigo-700 hover:scale-110 transition-all border-2 border-white"
                  title="AI Brainstorm"
              >
                  <Sparkles size={14} />
              </button>
          </div>
      )}
      
      {note.id.startsWith('ai-pending') && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-30">
           <div className="w-5 h-5 border-2 border-slate-700 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
};
