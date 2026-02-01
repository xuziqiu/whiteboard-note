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
  onCreateAndConnect: (sourceId: string, position: Position) => void;
  onDeleteNotes: (ids: string[]) => void;
  onCanvasDoubleClick: (pos: Position) => void;
  
  // New props for connection selection
  selectedNoteIds: string[];
  selectedConnectionId: string | null;
  onConnectionSelect: (id: string | null) => void;
  
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

type InteractionMode = 'NONE' | 'PANNING' | 'SELECTING' | 'DRAGGING_NOTES' | 'CONNECTING';

export const Canvas: React.FC<CanvasProps> = (props) => {
  const {
    notes,
    connections,
    connectionStyle,
    onNoteUpdate,
    onNoteSelect,
    onNoteMove,
    onConnect,
    onCreateAndConnect,
    onDeleteNotes,
    onCanvasDoubleClick,
    selectedNoteIds,
    selectedConnectionId,
    onConnectionSelect,
    camera,
    setCamera,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  
  // --- UI Render States ---
  const [mode, setMode] = useState<InteractionMode>('NONE');
  const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [mouseWorldPos, setMouseWorldPos] = useState<Position>({ x: 0, y: 0 });
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const [isOverDeleteZone, setIsOverDeleteZone] = useState(false);

  // --- Logic State Ref ---
  const interactionState = useRef({
      mode: 'NONE' as InteractionMode,
      dragStart: { x: 0, y: 0 },
      dragDistance: 0,
      connectionStartId: null as string | null,
      selectionStartWorld: { x: 0, y: 0 },
      potentialSelectionIds: [] as string[],
      currentHoveredTargetId: null as string | null,
      isOverDeleteZone: false,
  });

  const propsRef = useRef(props);
  propsRef.current = props;

  const getClientCoords = (e: React.MouseEvent | MouseEvent) => ({
    x: e.clientX,
    y: e.clientY,
  });

  const screenToWorld = useCallback((screenX: number, screenY: number, currentCamera: Camera) => {
    return {
      x: (screenX - currentCamera.x) / currentCamera.z,
      y: (screenY - currentCamera.y) / currentCamera.z,
    };
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomSensitivity = 0.001;
    const newZoom = Math.min(Math.max(0.1, camera.z - e.deltaY * zoomSensitivity), 5);
    const mouseWorld = screenToWorld(e.clientX, e.clientY, camera);
    const newX = e.clientX - mouseWorld.x * newZoom;
    const newY = e.clientY - mouseWorld.y * newZoom;
    setCamera({ x: newX, y: newY, z: newZoom });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const isRightClick = e.button === 2;
    const isLeftClick = e.button === 0;
    const target = e.target as HTMLElement;
    const isCanvas = target === containerRef.current || target.tagName === 'svg';
    
    // Deselect if clicking blank canvas
    if (isCanvas && isLeftClick && !e.shiftKey) {
        onNoteSelect([]);
        onConnectionSelect(null);
    }

    // Update Logic Ref
    interactionState.current.dragStart = getClientCoords(e);
    interactionState.current.dragDistance = 0;

    if (isCanvas) {
        if (isRightClick) {
            interactionState.current.mode = 'PANNING';
            setMode('PANNING');
        } else if (isLeftClick) {
            interactionState.current.mode = 'SELECTING';
            setMode('SELECTING');
            
            if (!e.shiftKey) {
                // Already cleared above, but clear potential here
                interactionState.current.potentialSelectionIds = [];
            } else {
                interactionState.current.potentialSelectionIds = [];
            }

            const worldPos = screenToWorld(e.clientX, e.clientY, camera);
            interactionState.current.selectionStartWorld = worldPos;
            setSelectionBox({ x: worldPos.x, y: worldPos.y, w: 0, h: 0 });
        }
    }
  };

  const handleNoteMouseDown = (e: React.MouseEvent, id: string) => {
      e.stopPropagation(); 
      const isRightClick = e.button === 2;
      const isLeftClick = e.button === 0;

      interactionState.current.dragStart = getClientCoords(e);
      interactionState.current.dragDistance = 0;

      if (isRightClick) {
          interactionState.current.mode = 'CONNECTING';
          interactionState.current.connectionStartId = id;
          setMode('CONNECTING');
          
          const worldPos = screenToWorld(e.clientX, e.clientY, camera);
          setMouseWorldPos(worldPos);
          onNoteSelect([id]); // Also select source note for context

      } else if (isLeftClick) {
          interactionState.current.mode = 'DRAGGING_NOTES';
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

  const handleMouseUp = useCallback((e: MouseEvent) => {
    const state = interactionState.current;
    const p = propsRef.current;

    if (state.mode === 'CONNECTING' && state.connectionStartId) {
        if (state.currentHoveredTargetId) {
            p.onConnect(state.connectionStartId, state.currentHoveredTargetId);
        } else {
            if (state.dragDistance > 5) {
                const worldPos = screenToWorld(e.clientX, e.clientY, p.camera);
                p.onCreateAndConnect(state.connectionStartId, worldPos);
            }
        }
    }

    if (state.mode === 'SELECTING') {
        const finalIds = state.potentialSelectionIds;
        if (e.shiftKey) {
             const newSet = new Set([...p.selectedNoteIds, ...finalIds]);
             p.onNoteSelect(Array.from(newSet));
        } else {
             p.onNoteSelect(finalIds);
        }
    }

    if (state.mode === 'DRAGGING_NOTES' && state.isOverDeleteZone) {
        p.onDeleteNotes(p.selectedNoteIds);
    }

    state.mode = 'NONE';
    state.connectionStartId = null;
    state.currentHoveredTargetId = null;
    state.potentialSelectionIds = [];
    state.isOverDeleteZone = false;
    
    setMode('NONE');
    setSelectionBox(null);
    setHoveredTargetId(null);
    setIsOverDeleteZone(false);
  }, [screenToWorld]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const state = interactionState.current;
    if (state.mode === 'NONE') return;

    if (e.buttons === 0) {
        handleMouseUp(e);
        return;
    }

    const p = propsRef.current;
    const current = getClientCoords(e);
    const dist = Math.sqrt(Math.pow(current.x - state.dragStart.x, 2) + Math.pow(current.y - state.dragStart.y, 2));
    state.dragDistance = Math.max(state.dragDistance, dist);

    const worldPos = screenToWorld(e.clientX, e.clientY, p.camera);

    if (state.mode === 'PANNING') {
        const delta = { x: current.x - state.dragStart.x, y: current.y - state.dragStart.y };
        p.setCamera(prev => ({ ...prev, x: prev.x + delta.x, y: prev.y + delta.y }));
        state.dragStart = current;
    } 
    else if (state.mode === 'SELECTING') {
        const start = state.selectionStartWorld;
        const newW = worldPos.x - start.x;
        const newH = worldPos.y - start.y;
        
        setSelectionBox({ x: start.x, y: start.y, w: newW, h: newH });

        const x = newW < 0 ? start.x + newW : start.x;
        const y = newH < 0 ? start.y + newH : start.y;
        const w = Math.abs(newW);
        const h = Math.abs(newH);
        
        const hitNotes = p.notes.filter(n => 
            n.position.x < x + w &&
            n.position.x + n.size.width > x &&
            n.position.y < y + h &&
            n.position.y + n.size.height > y
        ).map(n => n.id);
        
        state.potentialSelectionIds = hitNotes;
    }
    else if (state.mode === 'DRAGGING_NOTES') {
        const delta = { 
            x: (current.x - state.dragStart.x) / p.camera.z, 
            y: (current.y - state.dragStart.y) / p.camera.z 
        };
        
        if (p.selectedNoteIds.length > 0) {
            p.onNoteMove(p.selectedNoteIds[0], delta);
        }
        state.dragStart = current;
        
        const deleteZoneSize = 200;
        const distToCorner = Math.sqrt(
            Math.pow(window.innerWidth - e.clientX, 2) + 
            Math.pow(window.innerHeight - e.clientY, 2)
        );
        const isOver = distToCorner < deleteZoneSize;
        if (isOver !== state.isOverDeleteZone) {
            state.isOverDeleteZone = isOver;
            setIsOverDeleteZone(isOver);
        }
    }
    else if (state.mode === 'CONNECTING') {
        setMouseWorldPos(worldPos);
        const buffer = 20 / p.camera.z; 
        
        const candidates = p.notes.filter(n => n.id !== state.connectionStartId).filter(n => 
            worldPos.x >= n.position.x - buffer &&
            worldPos.x <= n.position.x + n.size.width + buffer &&
            worldPos.y >= n.position.y - buffer &&
            worldPos.y <= n.position.y + n.size.height + buffer
        );

        let targetId: string | null = null;
        if (candidates.length > 0) {
            let minDist = Infinity;
            candidates.forEach(n => {
                 const centerX = n.position.x + n.size.width / 2;
                 const centerY = n.position.y + n.size.height / 2;
                 const dist = Math.sqrt(Math.pow(worldPos.x - centerX, 2) + Math.pow(worldPos.y - centerY, 2));
                 if (dist < minDist) {
                     minDist = dist;
                     targetId = n.id;
                 }
            });
        }
        
        if (targetId !== state.currentHoveredTargetId) {
            state.currentHoveredTargetId = targetId;
            setHoveredTargetId(targetId);
        }
    }
  }, [screenToWorld, handleMouseUp]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const tempConnectionStartId = interactionState.current.connectionStartId;

  const renderConnection = (id: string, startNote: NoteData, endCenter: Position, endSize?: Size) => {
    const startCenter = {
      x: startNote.position.x + startNote.size.width / 2,
      y: startNote.position.y + startNote.size.height / 2,
    };
    const startPoint = getIntersection(startCenter, startNote.size, endCenter);
    const endPoint = endSize ? getIntersection(endCenter, endSize, startCenter) : endCenter;
    const d = getPath(connectionStyle, startPoint, endPoint);
    const isSelected = selectedConnectionId === id;

    return (
      <g 
        key={id} 
        onClick={(e) => {
            e.stopPropagation();
            onConnectionSelect(id);
            onNoteSelect([]); // Deselect notes when clicking connection
        }}
        className="cursor-pointer group"
      >
        {/* Invisible thick hit area */}
        <path
            d={d}
            stroke="transparent"
            strokeWidth="20"
            fill="none"
        />
        {/* Visible Line */}
        <path
            d={d}
            stroke={isSelected ? "#6366f1" : "#334155"}
            strokeWidth={isSelected ? "4" : "3"}
            strokeLinecap="round"
            fill="none"
            markerEnd={isSelected ? "url(#arrow-selected)" : "url(#arrow)"}
            className="transition-colors duration-200 group-hover:stroke-indigo-400"
        />
      </g>
    );
  };

  const isNoteHighlighted = (id: string) => {
      return selectedNoteIds.includes(id);
  };

  return (
    <div 
      className="w-full h-full overflow-hidden relative cursor-default select-none dot-grid"
      style={{
          backgroundPosition: `${camera.x}px ${camera.y}px`,
          backgroundSize: `${24 * camera.z}px ${24 * camera.z}px`
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onDoubleClick={(e) => {
          if (e.target === containerRef.current) {
              onCanvasDoubleClick(screenToWorld(e.clientX, e.clientY, camera));
          }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div 
        ref={containerRef}
        id="canvas-content"
        className="absolute inset-0 origin-top-left"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.z})`,
        }}
      >
        <svg className="absolute top-0 left-0 w-[100000px] h-[100000px] pointer-events-none overflow-visible">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#334155" />
            </marker>
            <marker id="arrow-selected" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#6366f1" />
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

          {mode === 'CONNECTING' && tempConnectionStartId && (
              (() => {
                  const startNote = notes.find(n => n.id === tempConnectionStartId);
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
                  
                  // Render temp connection manually since it's not in state
                  const startCenter = { x: startNote.position.x + startNote.size.width/2, y: startNote.position.y + startNote.size.height/2 };
                  const startPoint = getIntersection(startCenter, startNote.size, endCenter);
                  const endPoint = endSize ? getIntersection(endCenter, endSize, startCenter) : endCenter;
                  const d = getPath(connectionStyle, startPoint, endPoint);

                  return (
                      <path
                        d={d}
                        stroke="#334155"
                        strokeWidth="3"
                        strokeDasharray="5,5"
                        fill="none"
                        markerEnd="url(#arrow)"
                        className="opacity-50"
                      />
                  );
              })()
          )}
        </svg>
        
        {/* Ghost Note Preview when dragging connection to empty space */}
        {mode === 'CONNECTING' && !hoveredTargetId && (
            <div
                className="absolute border-2 border-dashed border-slate-300 bg-white/50 rounded-sm pointer-events-none flex items-center justify-center"
                style={{
                    left: mouseWorldPos.x - 140, // Centered (default width 280 / 2)
                    top: mouseWorldPos.y - 70,   // Centered (default height 140 / 2)
                    width: 280,
                    height: 140,
                }}
            >
                <span className="text-slate-400 font-bold text-sm">Release to Create</span>
            </div>
        )}

        {/* Selection Box */}
        {mode === 'SELECTING' && selectionBox && (
            <div 
                className="absolute bg-blue-500/10 border border-blue-500/50 rounded-sm z-50 pointer-events-none"
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
            onSelect={(id) => {
                // If not already selected and shift not held, clear others. 
                // But this logic is handled in handleNoteMouseDown basically.
                // onSelect just informs parent.
                onNoteSelect([id]); 
                onConnectionSelect(null);
            }}
            onUpdate={onNoteUpdate}
            onMouseDown={handleNoteMouseDown}
          />
        ))}
      </div>

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