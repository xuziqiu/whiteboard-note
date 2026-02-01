import React, { useRef, useEffect, useState } from 'react';
import { NoteColor, NoteData } from '../types';
import { ArrowDownRight } from 'lucide-react';

interface NoteCardProps {
  note: NoteData;
  isSelected: boolean;
  isDragging: boolean;
  isTarget?: boolean;
  scale: number;
  onUpdate: (id: string, data: Partial<NoteData>) => void;
  onSelect: (id: string) => void;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
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
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

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

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [note.content, isEditing, note.size.width]); // Also re-calc when width changes

  // Sync actual rendered size with state for correct arrow positioning
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const observer = new ResizeObserver(() => {
       const newWidth = card.offsetWidth;
       const newHeight = card.offsetHeight;
       
       // Update if dimensions mismatch significantly
       if (Math.abs(newWidth - note.size.width) > 1 || Math.abs(newHeight - note.size.height) > 1) {
           // We only push height updates from observer, width is controlled by state/resize
           onUpdate(note.id, { size: { width: newWidth, height: newHeight } });
       }
    });
    
    observer.observe(card);
    return () => observer.disconnect();
  }, [note.id, note.size.width, note.size.height, onUpdate]);

  // Handle Resizing
  const handleResizeStart = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsResizing(true);

      const startX = e.clientX;
      const startWidth = note.size.width;

      const handleMouseMove = (moveEvent: MouseEvent) => {
          const deltaX = (moveEvent.clientX - startX) / scale;
          const newWidth = Math.max(200, startWidth + deltaX); // Min width 200px
          onUpdate(note.id, { size: { ...note.size, width: newWidth } });
      };

      const handleMouseUp = () => {
          setIsResizing(false);
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
  };

  // Sketch-style colors
  const colorClasses: Record<NoteColor, string> = {
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
      ref={cardRef}
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
        borderRadius: '2px',
      }}
      onMouseDown={(e) => {
        if (!isEditing && !isResizing) {
             onMouseDown(e, note.id);
        }
      }}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
      }}
      onDragStart={(e) => e.preventDefault()}
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
            {note.content.split('\n').map((line, i) => {
                const trimmed = line.trim();
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                    return (
                        <div key={i} className="flex pl-1">
                            <span className="mr-2 text-slate-500">•</span>
                            <span>{line.replace(/^(\s*)[-*]\s+/, '$1')}</span>
                        </div>
                    );
                }
                return <div key={i} className="min-h-[1.2em]">{line}</div>;
            })}
          </div>
        )}
      </div>

      {/* Resize Handle */}
      {!isEditing && (isSelected || isResizing) && (
          <div 
            className="absolute bottom-0 right-0 p-1 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600"
            onMouseDown={handleResizeStart}
          >
              <ArrowDownRight size={16} />
          </div>
      )}
    </div>
  );
};