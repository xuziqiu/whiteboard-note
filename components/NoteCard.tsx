import React, { useRef, useEffect, useState } from 'react';
import { NoteData } from '../types';

interface NoteCardProps {
  note: NoteData;
  isSelected: boolean;
  isTarget?: boolean;
  scale: number;
  onUpdate: (id: string, data: Partial<NoteData>) => void;
  onSelect: (id: string) => void;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  isSelected,
  isTarget,
  scale,
  onUpdate,
  onSelect,
  onMouseDown,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
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

  const colorClasses = {
    white: 'bg-white border-slate-200 text-slate-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    // Remove empty notes automatically? Optional. keeping for now.
  };

  return (
    <div
      className={`absolute flex flex-col rounded-lg shadow-sm transition-all duration-200
        ${colorClasses[note.color]}
        ${isSelected ? 'ring-2 ring-indigo-500 shadow-xl z-20' : 'hover:shadow-md z-10'}
        ${isTarget ? 'ring-2 ring-indigo-400 scale-[1.02] z-30' : ''}
        border
      `}
      style={{
        left: note.position.x,
        top: note.position.y,
        width: note.size.width,
        minHeight: Math.max(note.size.height, 60),
      }}
      onMouseDown={(e) => {
        // If editing, don't trigger drag unless clicking border (handled by propagation)
        // If not editing, trigger drag
        if (!isEditing) {
             onSelect(note.id);
             onMouseDown(e, note.id);
        }
      }}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => {
        // Right click on note initiates connection in parent, suppress default menu
        e.preventDefault();
        e.stopPropagation();
        if (!isEditing) {
            onMouseDown(e, note.id); // Pass to canvas to handle "Right Click Drag"
        }
      }}
    >
      <div className="flex-1 p-4 flex flex-col justify-center min-h-[60px]">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={note.content}
            onChange={(e) => onUpdate(note.id, { content: e.target.value })}
            onBlur={handleBlur}
            onMouseDown={(e) => e.stopPropagation()} // Allow text selection without dragging note
            className="w-full h-full bg-transparent outline-none resize-none text-base leading-relaxed overflow-hidden font-medium"
            placeholder="Type your thought..."
          />
        ) : (
          <div className="whitespace-pre-wrap text-base leading-relaxed font-medium pointer-events-none select-none empty:text-slate-400 empty:after:content-['Empty_card']">
            {note.content}
          </div>
        )}
      </div>
      
      {/* AI Loading Indicator */}
      {note.id.startsWith('ai-pending') && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-lg z-30">
           <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
};
