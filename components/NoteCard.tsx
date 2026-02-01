import React, { useRef, useEffect, useState, forwardRef } from 'react';
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
  onInteractionStart: () => void;
}

export const NoteCard = React.memo(forwardRef<HTMLDivElement, NoteCardProps>(({
  note,
  isSelected,
  isDragging, // We keep this prop but visual dragging is now handled by parent via ref
  isTarget,
  scale,
  onUpdate,
  onSelect,
  onMouseDown,
  onInteractionStart,
}, ref) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localContent, setLocalContent] = useState(note.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const internalRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  // Combine refs
  useEffect(() => {
    if (!ref) return;
    if (typeof ref === 'function') {
      ref(internalRef.current);
    } else {
      ref.current = internalRef.current;
    }
  }, [ref]);

  // Default to text if type is missing (legacy support)
  const noteType = note.type || 'text';
  const isLogicNode = noteType !== 'text';

  // Sync local content
  useEffect(() => {
    if (!isEditing) {
      setLocalContent(note.content);
    }
  }, [note.content, isEditing]);

  // Focus
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
    if (textareaRef.current && !isLogicNode) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [localContent, isEditing, note.size.width, isLogicNode]);

  // Sync actual rendered size
  useEffect(() => {
    const card = internalRef.current;
    if (!card) return;
    if (isLogicNode) return; 

    const observer = new ResizeObserver(() => {
       const newWidth = card.offsetWidth;
       const newHeight = card.offsetHeight;
       
       if (Math.abs(newWidth - note.size.width) > 1 || Math.abs(newHeight - note.size.height) > 1) {
           onUpdate(note.id, { size: { width: newWidth, height: newHeight } });
       }
    });
    
    observer.observe(card);
    return () => observer.disconnect();
  }, [note.id, note.size.width, note.size.height, onUpdate, isLogicNode]);

  // Handle Resizing
  const handleResizeStart = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onInteractionStart(); 
      setIsResizing(true);

      const startX = e.clientX;
      const startWidth = note.size.width;

      const handleMouseMove = (moveEvent: MouseEvent) => {
          const deltaX = (moveEvent.clientX - startX) / scale;
          const newWidth = Math.max(isLogicNode ? 60 : 200, startWidth + deltaX);
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

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onInteractionStart();
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (localContent !== note.content) {
        onUpdate(note.id, { content: localContent });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setLocalContent(e.target.value);
  };

  // --- Styles per type ---
  const getShapeStyles = () => {
      const base = "absolute flex flex-col transition-shadow duration-200 group items-center justify-center";
      // Removed transition-transform to avoid conflict with JS-driven dragging
      
      const selection = isSelected && !isDragging ? 'ring-2 ring-dashed ring-indigo-500 ring-offset-2 z-20' : '';
      const drag = isDragging 
        ? 'z-50 shadow-2xl scale-105 cursor-grabbing' 
        : 'z-10 shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-grab';
      const target = isTarget ? 'ring-4 ring-indigo-400/50 scale-105 z-30' : '';

      switch (noteType) {
          case 'logic_and':
              return `${base} ${selection} ${drag} ${target} rounded-full bg-blue-100 border-2 border-blue-500 text-blue-900 w-[80px] h-[80px]`;
          case 'logic_or':
              return `${base} ${selection} ${drag} ${target} bg-orange-100 border-2 border-orange-500 text-orange-900 w-[80px] h-[80px] rotate-45`;
          case 'logic_not':
               return `${base} ${selection} ${drag} ${target} bg-red-100 border-2 border-red-500 text-red-900 w-[80px] h-[80px] rounded-tl-[20px] rounded-br-[20px]`;
          case 'logic_decision':
              return `${base} ${selection} ${drag} ${target} bg-purple-100 border-2 border-purple-500 text-purple-900 w-[100px] h-[100px] rotate-45`;
          case 'text':
          default:
              const colors: Record<NoteColor, string> = {
                white: 'bg-white text-slate-800',
                blue: 'bg-[#E0F2FE] text-slate-800',
                yellow: 'bg-[#FEF3C7] text-slate-800',
                green: 'bg-[#DCFCE7] text-slate-800',
                red: 'bg-[#FEE2E2] text-slate-800',
                purple: 'bg-[#F3E8FF] text-slate-800',
              };
              return `${base} ${colors[note.color]} ${selection} ${drag} ${target} border-2 border-slate-700 rounded-sm`;
      }
  };

  const renderContent = () => {
      const contentRotate = (noteType === 'logic_or' || noteType === 'logic_decision') ? '-rotate-45' : '';
      const fontClass = isLogicNode ? "font-bold text-sm text-center" : "text-lg leading-snug font-hand";

      if (isEditing) {
          return (
            <textarea
              ref={textareaRef}
              value={localContent}
              onChange={handleChange}
              onBlur={handleBlur}
              onMouseDown={(e) => e.stopPropagation()} 
              className={`w-full h-full bg-transparent outline-none resize-none overflow-hidden text-center ${contentRotate} ${fontClass}`}
              style={{ fontFamily: isLogicNode ? 'sans-serif' : '"Patrick Hand", cursive' }}
              placeholder={isLogicNode ? "LOGIC" : "Type..."}
            />
          );
      }

      return (
          <div 
            className={`whitespace-pre-wrap pointer-events-none select-none w-full h-full flex items-center justify-center ${contentRotate} ${fontClass}`}
            style={{ fontFamily: isLogicNode ? 'sans-serif' : '"Patrick Hand", cursive' }}
          >
             {!isLogicNode ? (
                 <div className="w-full text-left">
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
             ) : (
                 <span>{note.content}</span>
             )}
          </div>
      );
  };

  return (
    <div
      ref={internalRef}
      className={getShapeStyles()}
      style={{
        left: note.position.x,
        top: note.position.y,
        width: isLogicNode ? undefined : note.size.width,
        minHeight: isLogicNode ? undefined : Math.max(note.size.height, 60),
        // Important: We allow transform to be controlled by CSS or JS, but we must ensure transition doesn't fight JS drag
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
      <div className={`flex-1 p-2 flex flex-col justify-center w-full h-full ${!isLogicNode ? 'p-4 min-h-[60px]' : ''}`}>
        {renderContent()}
      </div>

      {!isLogicNode && !isEditing && (isSelected || isResizing) && (
          <div 
            className="absolute bottom-0 right-0 p-1 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600"
            onMouseDown={handleResizeStart}
          >
              <ArrowDownRight size={16} />
          </div>
      )}
    </div>
  );
}));