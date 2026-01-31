import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, NoteData, Connection, Position, Size, ConnectionStyle } from '../types';
import { NoteCard } from './NoteCard';
import { Trash2 } from 'lucide-react';

interface CanvasProps {
  notes: NoteData[];
  connections: Connection[];
  connectionStyle: ConnectionStyle;
  onNoteUpdate: (id: string, data: Partial<NoteData>) => void;
  onNoteSelect: (ids: string[]) => void;
  onNoteMove: (id: string, delta: Position) => void;
  onConnect: (sourceId: string, targetId: string) => void;
  onDeleteNotes: (ids: string[]) => void;
  onCanvasDoubleClick: (pos: Position) => void;
  selectedNoteIds: string[];
  camera: Camera;
  setCamera: React.Dispatch<React.SetStateAction<Camera>>;
}

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
  onDeleteNotes,
  onCanvasDoubleClick,
  selectedNoteIds,
  camera,
  setCamera,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // --- Interaction States ---
  type InteractionMode = 'NONE' | 'PANNING' | 'SELECTING' | 'DRAGGING_NOTES' | 'CONNECTING';
  const [mode, setMode] = useState<InteractionMode>('NONE');

  // Tracking data
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 }); // Screen coords
  const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [potentialSelectionIds, setPotentialSelectionIds] = useState<string[]>([]); // Highlighting during drag
  
  // Connection specific
  const [connectionStartId, setConnectionStartId] = useState<string | null>(null);
  const [mouseWorldPos, setMouseWorldPos] = useState<Position>({ x: 0, y: 0 });
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);

  // Delete Zone
  const [isOverDeleteZone, setIsOverDeleteZone] = useState(false);

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
    const isRightClick = e.button === 2;
    const isLeftClick = e.button === 0;
    const target = e.target as HTMLElement;
    const isCanvas = target === containerRef.current || target.tagName === 'svg';
    const isNote = target.closest('.note-card');

    setDragStart(getClientCoords(e));

    if (isCanvas) {
        if (isRightClick) {
            setMode('PANNING');
        } else if (isLeftClick) {
            setMode('SELECTING');
            if (!e.shiftKey) {
                onNoteSelect([]);
                setPotentialSelectionIds([]);
            }
            const worldPos = screenToWorld(e.clientX, e.clientY);
            setSelectionBox({ x: worldPos.x, y: worldPos.y, w: 0, h: 0 });
        }
    }
  };

  const handleNoteMouseDown = (e: React.MouseEvent, id: string) => {
      e.stopPropagation(); 
      const isRightClick = e.button === 2;
      const isLeftClick = e.button === 0;

      setDragStart(getClientCoords(e));

      if (isRightClick) {
          setMode('CONNECTING');
          setConnectionStartId(id);
          setMouseWorldPos(screenToWorld(e.clientX, e.clientY));
      } else if (isLeftClick) {
          setMode('DRAGGING_NOTES');
          if (!selectedNoteIds.includes(id)) {
              if (e.shiftKey) {
                  onNoteSelect([...selectedNoteIds, id]);
              } else {
                  onNoteSelect([id]);
              }
          }
      }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (mode === 'NONE') return;

    const current = getClientCoords(e);
    const worldPos = screenToWorld(e.clientX, e.clientY);

    if (mode === 'PANNING') {
        const delta = { x: current.x - dragStart.x, y: current.y - dragStart.y };
        setCamera(prev => ({ ...prev, x: prev.x + delta.x, y: prev.y + delta.y }));
        setDragStart(current);
    } 
    else if (mode === 'SELECTING') {
        if (selectionBox) {
            const newW = worldPos.x - selectionBox.x;
            const newH = worldPos.y - selectionBox.y;
            
            setSelectionBox(prev => ({ ...prev!, w: newW, h: newH }));

            // Calculate potential selection in real-time
            const x = newW < 0 ? selectionBox.x + newW : selectionBox.x;
            const y = newH < 0 ? selectionBox.y + newH : selectionBox.y;
            const w = Math.abs(newW);
            const h = Math.abs(newH);

            const hitNotes = notes.filter(n => 
                n.position.x < x + w &&
                n.position.x + n.size.width > x &&
                n.position.y < y + h &&
                n.position.y + n.size.height > y
            ).map(n => n.id);
            
            setPotentialSelectionIds(hitNotes);
        }
    }
    else if (mode === 'DRAGGING_NOTES') {
        const delta = { 
            x: (current.x - dragStart.x) / camera.z, 
            y: (current.y - dragStart.y) / camera.z 
        };
        if (selectedNoteIds.length > 0) {
            onNoteMove(selectedNoteIds[0], delta);
        }
        setDragStart(current);

        // Check Delete Zone (Larger Zone: 200px)
        const deleteZoneSize = 200;
        const distToCorner = Math.sqrt(
            Math.pow(window.innerWidth - e.clientX, 2) + 
            Math.pow(window.innerHeight - e.clientY, 2)
        );
        setIsOverDeleteZone(distToCorner < deleteZoneSize);
    }
    else if (mode === 'CONNECTING') {
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
    }
  }, [mode, dragStart, camera, selectionBox, selectedNoteIds, onNoteMove, notes, connectionStartId, screenToWorld]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (mode === 'CONNECTING' && connectionStartId && hoveredTargetId) {
        onConnect(connectionStartId, hoveredTargetId);
    }

    if (mode === 'SELECTING') {
        if (e.shiftKey) {
             const newSet = new Set([...selectedNoteIds, ...potentialSelectionIds]);
             onNoteSelect(Array.from(newSet));
        } else {
             onNoteSelect(potentialSelectionIds);
        }
    }

    if (mode === 'DRAGGING_NOTES' && isOverDeleteZone) {
        onDeleteNotes(selectedNoteIds);
    }

    // Reset
    setMode('NONE');
    setSelectionBox(null);
    setPotentialSelectionIds([]);
    setConnectionStartId(null);
    setHoveredTargetId(null);
    setIsOverDeleteZone(false);
  }, [mode, connectionStartId, hoveredTargetId, onConnect, potentialSelectionIds, selectedNoteIds, onNoteSelect, isOverDeleteZone, onDeleteNotes]);

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
        stroke="#334155"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        markerEnd="url(#arrow)"
      />
    );
  };

  // Determine which notes to highlight visually
  const isNoteHighlighted = (id: string) => {
      if (mode === 'SELECTING') {
          return selectedNoteIds.includes(id) || potentialSelectionIds.includes(id);
      }
      return selectedNoteIds.includes(id);
  };

  return (
    <div 
      className="w-full h-full overflow-hidden relative cursor-default select-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onDoubleClick={(e) => {
          if (e.target === containerRef.current) {
              onCanvasDoubleClick(screenToWorld(e.clientX, e.clientY));
          }
      }}
      onContextMenu={(e) => e.preventDefault()}
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
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#334155" />
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

          {mode === 'CONNECTING' && connectionStartId && (
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

        {/* Selection Box */}
        {mode === 'SELECTING' && selectionBox && (
            <div 
                className="absolute bg-slate-900/5 border-2 border-dashed border-slate-600 rounded-sm z-50 pointer-events-none"
                style={{
                    left: selectionBox.w < 0 ? selectionBox.x + selectionBox.w : selectionBox.x,
                    top: selectionBox.h < 0 ? selectionBox.y + selectionBox.h : selectionBox.y,
                    width: Math.abs(selectionBox.w),
                    height: Math.abs(selectionBox.h)
                }}
            />
        )}

        {notes.map(note => (
          <NoteCard
            key={note.id}
            note={note}
            scale={camera.z}
            isSelected={isNoteHighlighted(note.id)}
            isDragging={mode === 'DRAGGING_NOTES' && selectedNoteIds.includes(note.id)}
            isTarget={hoveredTargetId === note.id}
            onSelect={(id) => onNoteSelect([id])}
            onUpdate={onNoteUpdate}
            onMouseDown={handleNoteMouseDown}
          />
        ))}
      </div>

      {/* Delete Zone */}
      <div 
        className={`fixed bottom-0 right-0 w-[200px] h-[200px] flex items-center justify-center transition-all duration-300 pointer-events-none no-print
            ${isOverDeleteZone 
                ? 'bg-red-500/10 backdrop-blur-sm rounded-tl-[100px] scale-110' 
                : 'bg-transparent'
            }
        `}
      >
          <div className={`transition-all duration-300 ${mode === 'DRAGGING_NOTES' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
             <Trash2 
                size={isOverDeleteZone ? 64 : 48} 
                className={`transition-all ${isOverDeleteZone ? 'text-red-600' : 'text-slate-300'}`} 
                strokeWidth={isOverDeleteZone ? 2 : 1.5}
             />
             {isOverDeleteZone && <div className="text-red-600 font-bold text-center mt-2 font-hand">Drop to Delete</div>}
          </div>
      </div>
    </div>
  );
};
