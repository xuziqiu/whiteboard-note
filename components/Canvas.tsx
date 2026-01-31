import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, NoteData, Connection, Position, Size, ConnectionStyle } from '../types';
import { NoteCard } from './NoteCard';
import { Maximize2, Minimize2 } from 'lucide-react';

interface CanvasProps {
  notes: NoteData[];
  connections: Connection[];
  connectionStyle: ConnectionStyle;
  onNoteUpdate: (id: string, data: Partial<NoteData>) => void;
  onNoteSelect: (id: string | null) => void;
  onNoteMove: (id: string, pos: Position) => void;
  onConnect: (sourceId: string, targetId: string) => void;
  onCanvasClick: (pos: Position) => void;
  onCanvasContextMenu: (e: React.MouseEvent) => void;
  selectedNoteId: string | null;
  camera: Camera;
  setCamera: React.Dispatch<React.SetStateAction<Camera>>;
}

/**
 * Calculates the intersection point between a line (from center to target)
 * and the border of a rectangle (centered at `center` with `size`).
 */
function getIntersection(
  center: Position,
  size: Size,
  target: Position
): Position {
  const dx = target.x - center.x;
  const dy = target.y - center.y;

  if (dx === 0 && dy === 0) return center;

  const w = size.width / 2;
  const h = size.height / 2;

  if (Math.abs(dx) * h > Math.abs(dy) * w) {
    if (dx > 0) return { x: center.x + w, y: center.y + (dy / dx) * w };
    else return { x: center.x - w, y: center.y - (dy / dx) * w };
  } else {
    if (dy > 0) return { x: center.x + (dx / dy) * h, y: center.y + h };
    else return { x: center.x - (dx / dy) * h, y: center.y - h };
  }
}

function getPath(style: ConnectionStyle, start: Position, end: Position): string {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  switch (style) {
    case 'curve':
      const c1 = { x: start.x + dx / 2, y: start.y };
      const c2 = { x: end.x - dx / 2, y: end.y };
      // Vertical curve preference
      if (Math.abs(dy) > Math.abs(dx)) {
         return `M ${start.x} ${start.y} C ${start.x} ${start.y + dy/2}, ${end.x} ${end.y - dy/2}, ${end.x} ${end.y}`;
      }
      return `M ${start.x} ${start.y} C ${start.x + dx / 2} ${start.y}, ${end.x - dx / 2} ${end.y}, ${end.x} ${end.y}`;
    
    case 'step':
      const midX = start.x + dx / 2;
      return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
    
    case 'straight':
    default:
      return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }
}

export const Canvas: React.FC<CanvasProps> = ({
  notes,
  connections,
  connectionStyle,
  onNoteUpdate,
  onNoteSelect,
  onNoteMove,
  onConnect,
  onCanvasClick,
  onCanvasContextMenu,
  selectedNoteId,
  camera,
  setCamera,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Interaction State
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [isDraggingNote, setIsDraggingNote] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
  
  // Connection State
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStartId, setConnectionStartId] = useState<string | null>(null);
  const [mouseWorldPos, setMouseWorldPos] = useState<Position>({ x: 0, y: 0 });
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);

  const getClientCoords = (e: React.MouseEvent | MouseEvent) => ({
    x: e.clientX,
    y: e.clientY,
  });

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
      const mouseWorld = screenToWorld(e.clientX, e.clientY);
      const newX = e.clientX - mouseWorld.x * newZoom;
      const newY = e.clientY - mouseWorld.y * newZoom;
      setCamera({ x: newX, y: newY, z: newZoom });
    } else {
      setCamera(prev => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Left Click: Drag Canvas if on background
    if (e.button === 0) {
        if (e.target === containerRef.current) {
            setIsDraggingCanvas(true);
            setDragStart(getClientCoords(e));
            onCanvasClick(screenToWorld(e.clientX, e.clientY));
            onNoteSelect(null);
        }
    }
  };

  const handleNoteMouseDown = (e: React.MouseEvent, id: string) => {
    if (e.button === 0) {
        // Left Click: Drag Note
        setIsDraggingNote(id);
        setDragStart(getClientCoords(e));
    } else if (e.button === 2) {
        // Right Click: Start Connection
        setIsConnecting(true);
        setConnectionStartId(id);
        setMouseWorldPos(screenToWorld(e.clientX, e.clientY));
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);
    
    if (isConnecting) {
        setMouseWorldPos(worldPos);
        const targetNote = notes.find(n => {
            if (n.id === connectionStartId) return false;
            return (
                worldPos.x >= n.position.x &&
                worldPos.x <= n.position.x + n.size.width &&
                worldPos.y >= n.position.y &&
                worldPos.y <= n.position.y + n.size.height
            );
        });
        setHoveredTargetId(targetNote ? targetNote.id : null);
    } else if (isDraggingCanvas) {
      const current = getClientCoords(e);
      const delta = { x: current.x - dragStart.x, y: current.y - dragStart.y };
      setCamera(prev => ({ ...prev, x: prev.x + delta.x, y: prev.y + delta.y }));
      setDragStart(current);
    } else if (isDraggingNote) {
      const current = getClientCoords(e);
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
  }, [isDraggingCanvas, isDraggingNote, isConnecting, connectionStartId, dragStart, camera, notes, onNoteMove, setCamera, screenToWorld]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (isConnecting && connectionStartId && hoveredTargetId) {
        onConnect(connectionStartId, hoveredTargetId);
    }

    setIsDraggingCanvas(false);
    setIsDraggingNote(null);
    setIsConnecting(false);
    setConnectionStartId(null);
    setHoveredTargetId(null);
  }, [isConnecting, connectionStartId, hoveredTargetId, onConnect]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const renderConnection = (id: string, startNote: NoteData, endCenter: Position, endSize?: Size) => {
    const startCenter = {
      x: startNote.position.x + startNote.size.width / 2,
      y: startNote.position.y + startNote.size.height / 2,
    };
    const startPoint = getIntersection(startCenter, startNote.size, endCenter);
    const endPoint = endSize ? getIntersection(endCenter, endSize, startCenter) : endCenter;
    const d = getPath(connectionStyle, startPoint, endPoint);

    return (
      <path
        key={id}
        d={d}
        stroke="#94a3b8"
        strokeWidth="2"
        fill="none"
        markerEnd="url(#arrow)"
      />
    );
  };

  return (
    <div 
      className="w-full h-full overflow-hidden bg-slate-50 relative cursor-default select-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => {
          e.preventDefault();
          // Only show context menu if clicking on canvas, not while dragging connection
          if (!isConnecting && e.target === containerRef.current) {
             onCanvasContextMenu(e);
          }
      }}
    >
      <div 
        ref={containerRef}
        className="absolute inset-0 origin-top-left dot-grid"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.z})`,
        }}
      >
        <svg className="absolute top-0 left-0 w-[100000px] h-[100000px] pointer-events-none overflow-visible">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
            </marker>
          </defs>

          {connections.map(conn => {
            const startNote = notes.find(n => n.id === conn.fromId);
            const endNote = notes.find(n => n.id === conn.toId);
            if (!startNote || !endNote) return null;
             const endCenter = {
                x: endNote.position.x + endNote.size.width / 2,
                y: endNote.position.y + endNote.size.height / 2,
             };
             return renderConnection(conn.id, startNote, endCenter, endNote.size);
          })}

          {isConnecting && connectionStartId && (
              (() => {
                  const startNote = notes.find(n => n.id === connectionStartId);
                  if (!startNote) return null;
                  let endCenter = mouseWorldPos;
                  let endSize = undefined;
                  if (hoveredTargetId) {
                      const target = notes.find(n => n.id === hoveredTargetId);
                      if (target) {
                          endCenter = {
                              x: target.position.x + target.size.width / 2,
                              y: target.position.y + target.size.height / 2,
                          };
                          endSize = target.size;
                      }
                  }
                  return renderConnection("temp", startNote, endCenter, endSize);
              })()
          )}
        </svg>

        {notes.map(note => (
          <NoteCard
            key={note.id}
            note={note}
            scale={camera.z}
            isSelected={selectedNoteId === note.id}
            isTarget={hoveredTargetId === note.id}
            onSelect={onNoteSelect}
            onUpdate={onNoteUpdate}
            onMouseDown={handleNoteMouseDown}
          />
        ))}
      </div>

      {/* Mini Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2 bg-white p-2 rounded-lg shadow-md border border-slate-200 z-50">
        <button className="p-2 hover:bg-slate-50 rounded text-slate-600" onClick={() => setCamera(c => ({ ...c, z: Math.min(c.z + 0.1, 5) }))}>
          <Maximize2 size={20} />
        </button>
        <button className="p-2 hover:bg-slate-50 rounded text-slate-600" onClick={() => setCamera(c => ({ ...c, z: Math.max(c.z - 0.1, 0.1) }))}>
          <Minimize2 size={20} />
        </button>
      </div>
    </div>
  );
};
