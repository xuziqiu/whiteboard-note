import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, NoteData, Connection, Position, ToolType } from '../types';
import { NoteCard } from './NoteCard';
import { Maximize2, Minimize2 } from 'lucide-react';

interface CanvasProps {
  notes: NoteData[];
  connections: Connection[];
  onNoteUpdate: (id: string, data: Partial<NoteData>) => void;
  onNoteSelect: (id: string | null) => void;
  onNoteMove: (id: string, pos: Position) => void;
  onNoteDelete: (id: string) => void;
  onBrainstorm: (id: string) => void;
  onCanvasClick: (pos: Position) => void;
  selectedNoteId: string | null;
  camera: Camera;
  setCamera: React.Dispatch<React.SetStateAction<Camera>>;
}

export const Canvas: React.FC<CanvasProps> = ({
  notes,
  connections,
  onNoteUpdate,
  onNoteSelect,
  onNoteMove,
  onNoteDelete,
  onBrainstorm,
  onCanvasClick,
  selectedNoteId,
  camera,
  setCamera,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Interaction State
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [isDraggingNote, setIsDraggingNote] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
  
  // Helper to get raw coordinates relative to the screen
  const getClientCoords = (e: React.MouseEvent | MouseEvent) => ({
    x: e.clientX,
    y: e.clientY,
  });

  // Convert screen coordinates to world coordinates
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    return {
      x: (screenX - camera.x) / camera.z,
      y: (screenY - camera.y) / camera.z,
    };
  }, [camera]);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const newZoom = Math.min(Math.max(0.1, camera.z - e.deltaY * zoomSensitivity), 5);
      
      // Zoom towards mouse pointer
      const mouseWorld = screenToWorld(e.clientX, e.clientY);
      const newX = e.clientX - mouseWorld.x * newZoom;
      const newY = e.clientY - mouseWorld.y * newZoom;

      setCamera({ x: newX, y: newY, z: newZoom });
    } else {
      // Pan
      setCamera(prev => ({
        ...prev,
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle mouse or Space+Click initiates canvas drag
    if (e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey)) {
      setIsDraggingCanvas(true);
      setDragStart(getClientCoords(e));
      return;
    }
    
    // Left click on empty space
    if (e.button === 0 && e.target === containerRef.current) {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      onCanvasClick(worldPos); // Potential double click logic handled in parent or here? For now just deselect.
      onNoteSelect(null);
    }
  };

  const handleNoteMouseDown = (e: React.MouseEvent, id: string) => {
    if (e.button !== 0) return; // Only left click drags notes
    setIsDraggingNote(id);
    setDragStart(getClientCoords(e));
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDraggingCanvas) {
      const current = getClientCoords(e);
      const delta = { x: current.x - dragStart.x, y: current.y - dragStart.y };
      setCamera(prev => ({ ...prev, x: prev.x + delta.x, y: prev.y + delta.y }));
      setDragStart(current);
    } 
    else if (isDraggingNote) {
      const current = getClientCoords(e);
      // Delta in screen pixels needs to be divided by zoom to get world delta
      const delta = { 
        x: (current.x - dragStart.x) / camera.z, 
        y: (current.y - dragStart.y) / camera.z 
      };
      
      const note = notes.find(n => n.id === isDraggingNote);
      if (note) {
        onNoteMove(isDraggingNote, {
          x: note.position.x + delta.x,
          y: note.position.y + delta.y
        });
      }
      setDragStart(current);
    }
  }, [isDraggingCanvas, isDraggingNote, dragStart, camera.z, notes, onNoteMove, setCamera]);

  const handleMouseUp = useCallback(() => {
    setIsDraggingCanvas(false);
    setIsDraggingNote(null);
  }, []);

  // Global event listeners for drag operations to handle going outside the window
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div 
      className="w-full h-full overflow-hidden bg-slate-50 relative cursor-default select-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => e.preventDefault()} // Prevent native context menu
    >
      {/* Zoom/Pan Container */}
      <div 
        ref={containerRef}
        className="absolute inset-0 origin-top-left dot-grid"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.z})`,
        }}
      >
        {/* Connections Layer (SVG) */}
        <svg className="absolute top-0 left-0 w-[100000px] h-[100000px] pointer-events-none overflow-visible">
          {connections.map(conn => {
            const startNote = notes.find(n => n.id === conn.fromId);
            const endNote = notes.find(n => n.id === conn.toId);
            if (!startNote || !endNote) return null;

            // Calculate centers
            const start = {
              x: startNote.position.x + startNote.size.width / 2,
              y: startNote.position.y + startNote.size.height / 2,
            };
            const end = {
              x: endNote.position.x + endNote.size.width / 2,
              y: endNote.position.y + endNote.size.height / 2,
            };

            return (
              <line
                key={conn.id}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke="#cbd5e1"
                strokeWidth="2"
                strokeDasharray="5,5"
              />
            );
          })}
        </svg>

        {/* Notes Layer */}
        {notes.map(note => (
          <NoteCard
            key={note.id}
            note={note}
            scale={camera.z}
            isSelected={selectedNoteId === note.id}
            onSelect={onNoteSelect}
            onUpdate={onNoteUpdate}
            onDelete={onNoteDelete}
            onBrainstorm={onBrainstorm}
            onMouseDown={handleNoteMouseDown}
          />
        ))}
      </div>

      {/* Mini Controls overlay (Bottom Right) */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2 bg-white p-2 rounded-lg shadow-md border border-slate-200 z-50">
        <button 
          className="p-2 hover:bg-slate-50 rounded text-slate-600" 
          onClick={() => setCamera(c => ({ ...c, z: Math.min(c.z + 0.1, 5) }))}
        >
          <Maximize2 size={20} />
        </button>
        <div className="text-center text-xs text-slate-400 font-mono py-1">
          {Math.round(camera.z * 100)}%
        </div>
        <button 
          className="p-2 hover:bg-slate-50 rounded text-slate-600"
          onClick={() => setCamera(c => ({ ...c, z: Math.max(c.z - 0.1, 0.1) }))}
        >
          <Minimize2 size={20} />
        </button>
      </div>
    </div>
  );
};