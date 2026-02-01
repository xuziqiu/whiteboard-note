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
  onDragEnd: () => void;
  onConnect: (sourceId: string, targetId: string) => void;
  onCreateAndConnect: (sourceId: string, position: Position) => void;
  onDeleteNotes: (ids: string[]) => void;
  onCanvasDoubleClick: (pos: Position) => void;
  onCanvasContextMenu?: (pos: { x: number, y: number }) => void;
  
  selectedNoteIds: string[];
  selectedConnectionId: string | null;
  onConnectionSelect: (id: string | null) => void;
  onConnectionUpdate: (id: string, label: string) => void;
  
  onInteractionStart: () => void;
  onDrop: (e: React.DragEvent, worldPos: Position) => void;

  camera: Camera;
  setCamera: React.Dispatch<React.SetStateAction<Camera>>;
}

function getIntersection(center: Position, size: Size, target: Position): Position {
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

function getPathData(style: ConnectionStyle, start: Position, end: Position): { d: string, mid: Position } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  let d = '';
  let mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

  switch (style) {
    case 'curve':
      if (Math.abs(dy) > Math.abs(dx)) {
         d = `M ${start.x} ${start.y} C ${start.x} ${start.y + dy/2}, ${end.x} ${end.y - dy/2}, ${end.x} ${end.y}`;
         const p0 = start, p1 = {x: start.x, y: start.y + dy/2}, p2 = {x: end.x, y: end.y - dy/2}, p3 = end;
         mid = {
             x: 0.125*p0.x + 0.375*p1.x + 0.375*p2.x + 0.125*p3.x,
             y: 0.125*p0.y + 0.375*p1.y + 0.375*p2.y + 0.125*p3.y
         };
      } else {
         d = `M ${start.x} ${start.y} C ${start.x + dx / 2} ${start.y}, ${end.x - dx / 2} ${end.y}, ${end.x} ${end.y}`;
         const p0 = start, p1 = {x: start.x + dx/2, y: start.y}, p2 = {x: end.x - dx/2, y: end.y}, p3 = end;
         mid = {
             x: 0.125*p0.x + 0.375*p1.x + 0.375*p2.x + 0.125*p3.x,
             y: 0.125*p0.y + 0.375*p1.y + 0.375*p2.y + 0.125*p3.y
         };
      }
      break;
    case 'step':
      const midX = start.x + dx / 2;
      d = `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
      mid = { x: midX, y: (start.y + end.y) / 2 };
      break;
    case 'straight':
    default:
      d = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
      mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      break;
  }
  return { d, mid };
}

type InteractionMode = 'NONE' | 'PANNING' | 'SELECTING' | 'DRAGGING_NOTES' | 'CONNECTING';

export const Canvas: React.FC<CanvasProps> = (props) => {
  const {
    notes,
    connections,
    connectionStyle,
    onNoteSelect,
    onNoteMove,
    onDragEnd,
    onConnect,
    onCreateAndConnect,
    onDeleteNotes,
    onCanvasDoubleClick,
    onCanvasContextMenu,
    selectedNoteIds,
    selectedConnectionId,
    onConnectionSelect,
    onConnectionUpdate,
    onInteractionStart,
    onDrop,
    onNoteUpdate,
    camera,
    setCamera,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  
  // Refs for Direct DOM Manipulation
  const noteRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const connectionRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const connectionLabelRefs = useRef<Map<string, SVGForeignObjectElement>>(new Map());

  // UI Render States
  const [mode, setMode] = useState<InteractionMode>('NONE');
  const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [mouseWorldPos, setMouseWorldPos] = useState<Position>({ x: 0, y: 0 });
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const [isOverDeleteZone, setIsOverDeleteZone] = useState(false);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);

  // Logic State Ref
  const interactionState = useRef({
      mode: 'NONE' as InteractionMode,
      dragStart: { x: 0, y: 0 },
      dragDistance: 0,
      connectionStartId: null as string | null,
      selectionStartWorld: { x: 0, y: 0 },
      potentialSelectionIds: [] as string[],
      currentHoveredTargetId: null as string | null,
      isOverDeleteZone: false,
      // For DOM dragging
      dragDelta: { x: 0, y: 0 },
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
    
    if (editingConnectionId) setEditingConnectionId(null);

    if (isCanvas && isLeftClick && !e.shiftKey) {
        onNoteSelect([]);
        onConnectionSelect(null);
    }

    interactionState.current.dragStart = getClientCoords(e);
    interactionState.current.dragDistance = 0;
    interactionState.current.dragDelta = { x: 0, y: 0 };

    if (isCanvas) {
        if (isRightClick) {
            interactionState.current.mode = 'PANNING';
            setMode('PANNING');
        } else if (isLeftClick) {
            interactionState.current.mode = 'SELECTING';
            setMode('SELECTING');
            if (!e.shiftKey) interactionState.current.potentialSelectionIds = [];
            
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
      interactionState.current.dragDelta = { x: 0, y: 0 };

      if (isRightClick) {
          onInteractionStart(); 
          interactionState.current.mode = 'CONNECTING';
          interactionState.current.connectionStartId = id;
          setMode('CONNECTING');
          const worldPos = screenToWorld(e.clientX, e.clientY, camera);
          setMouseWorldPos(worldPos);
          onNoteSelect([id]); 

      } else if (isLeftClick) {
          if (selectedNoteIds.includes(id) || selectedNoteIds.length === 0) {
              onInteractionStart(); 
          }

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

  const updateConnectionsDom = (delta: Position) => {
      // Re-calculate paths for all connections attached to selected notes
      const p = propsRef.current;
      const movedNoteIds = new Set(p.selectedNoteIds);
      
      p.connections.forEach(conn => {
          const startMoved = movedNoteIds.has(conn.fromId);
          const endMoved = movedNoteIds.has(conn.toId);
          
          if (!startMoved && !endMoved) return;

          const startNote = p.notes.find(n => n.id === conn.fromId);
          const endNote = p.notes.find(n => n.id === conn.toId);

          if (!startNote || !endNote) return;

          // Calculate "Virtual" positions based on the drag delta
          const startX = startNote.position.x + (startMoved ? delta.x : 0);
          const startY = startNote.position.y + (startMoved ? delta.y : 0);
          const endX = endNote.position.x + (endMoved ? delta.x : 0);
          const endY = endNote.position.y + (endMoved ? delta.y : 0);

          const startCenter = { x: startX + startNote.size.width / 2, y: startY + startNote.size.height / 2 };
          const endCenter = { x: endX + endNote.size.width / 2, y: endY + endNote.size.height / 2 };

          const startPoint = getIntersection(startCenter, startNote.size, endCenter);
          const endPoint = getIntersection(endCenter, endNote.size, startCenter);
          
          const { d, mid } = getPathData(p.connectionStyle, startPoint, endPoint);

          // Direct DOM Update for Paths
          const pathEl = connectionRefs.current.get(conn.id);
          const bgPathEl = connectionRefs.current.get(conn.id + '-bg');
          if (pathEl) pathEl.setAttribute('d', d);
          if (bgPathEl) bgPathEl.setAttribute('d', d);

          // Direct DOM Update for Labels
          const labelEl = connectionLabelRefs.current.get(conn.id);
          if (labelEl) {
              labelEl.setAttribute('x', String(mid.x - 60));
              labelEl.setAttribute('y', String(mid.y - 15));
          }
      });
  };

  const handleMouseUp = useCallback((e: MouseEvent) => {
    const state = interactionState.current;
    const p = propsRef.current;

    if (state.mode === 'PANNING') {
        if (state.dragDistance < 5) {
             p.onCanvasContextMenu?.({ x: e.clientX, y: e.clientY });
        }
    }

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

    if (state.mode === 'DRAGGING_NOTES') {
        if (state.isOverDeleteZone) {
            p.onDeleteNotes(p.selectedNoteIds);
        } else {
            // Commit the visual move to React State
            if (p.selectedNoteIds.length > 0 && (state.dragDelta.x !== 0 || state.dragDelta.y !== 0)) {
                p.onNoteMove(p.selectedNoteIds[0], state.dragDelta);
                
                // Reset Transforms immediately to let React re-render take over at the new position
                // This prevents "jumping" when the state update comes through
                p.selectedNoteIds.forEach(id => {
                    const el = noteRefs.current.get(id);
                    if (el) el.style.transform = '';
                });
            }
        }
        p.onDragEnd();
    }

    state.mode = 'NONE';
    state.connectionStartId = null;
    state.currentHoveredTargetId = null;
    state.potentialSelectionIds = [];
    state.isOverDeleteZone = false;
    state.dragDelta = { x: 0, y: 0 };
    
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
        // Calculate Delta (Raw World Units)
        const dx = (current.x - state.dragStart.x) / p.camera.z;
        const dy = (current.y - state.dragStart.y) / p.camera.z;
        state.dragDelta = { x: dx, y: dy };
        
        // --- DIRECT DOM MANIPULATION (Zero Latency) ---
        p.selectedNoteIds.forEach(id => {
            const el = noteRefs.current.get(id);
            if (el) {
                // Using translate3d for GPU acceleration
                el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
            }
        });
        
        // Update Lines Manually
        updateConnectionsDom({ x: dx, y: dy });

        // Check Delete Zone
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

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const worldPos = screenToWorld(e.clientX, e.clientY, camera);
      onDrop(e, worldPos);
  };

  const renderConnection = (conn: Connection) => {
    const startNote = notes.find(n => n.id === conn.fromId);
    const endNote = notes.find(n => n.id === conn.toId);
    if (!startNote || !endNote) return null;

    const startCenter = {
      x: startNote.position.x + startNote.size.width / 2,
      y: startNote.position.y + startNote.size.height / 2,
    };
    const endCenter = {
        x: endNote.position.x + endNote.size.width / 2,
        y: endNote.position.y + endNote.size.height / 2,
    };

    const startPoint = getIntersection(startCenter, startNote.size, endCenter);
    const endPoint = getIntersection(endCenter, endNote.size, startCenter);
    
    const { d, mid } = getPathData(connectionStyle, startPoint, endPoint);
    const isSelected = selectedConnectionId === conn.id;

    const handleLabelDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onInteractionStart();
        setEditingConnectionId(conn.id);
    };

    const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onConnectionUpdate(conn.id, e.target.value);
    };

    return (
      <React.Fragment key={conn.id}>
        <g 
            onClick={(e) => {
                e.stopPropagation();
                onConnectionSelect(conn.id);
                onNoteSelect([]);
            }}
            onDoubleClick={handleLabelDoubleClick}
            className="cursor-pointer group"
        >
            <path 
                ref={el => { if(el) connectionRefs.current.set(conn.id + '-bg', el); }}
                d={d} stroke="transparent" strokeWidth="20" fill="none" 
            />
            <path
                ref={el => { if(el) connectionRefs.current.set(conn.id, el); }}
                d={d}
                stroke={isSelected ? "#6366f1" : "#334155"}
                strokeWidth={isSelected ? "4" : "3"}
                strokeLinecap="round"
                fill="none"
                markerEnd={isSelected ? "url(#arrow-selected)" : "url(#arrow)"}
                className="transition-colors duration-200 group-hover:stroke-indigo-400"
            />
        </g>
        
        {(conn.label || isSelected || editingConnectionId === conn.id) && (
            <foreignObject 
                ref={el => { if(el) connectionLabelRefs.current.set(conn.id, el); }}
                x={mid.x - 60} 
                y={mid.y - 15} 
                width={120} 
                height={30} 
                className="overflow-visible pointer-events-none"
            >
                <div className="flex justify-center items-center w-full h-full pointer-events-auto">
                    {editingConnectionId === conn.id ? (
                        <input
                            autoFocus
                            value={conn.label || ''}
                            onChange={handleLabelChange}
                            onBlur={() => setEditingConnectionId(null)}
                            onKeyDown={(e) => e.key === 'Enter' && setEditingConnectionId(null)}
                            className="bg-white border-2 border-indigo-500 rounded px-2 py-0.5 text-xs text-center shadow-md outline-none min-w-[60px]"
                            placeholder="Label..."
                        />
                    ) : (
                        (conn.label || isSelected) && (
                            <div 
                                onDoubleClick={handleLabelDoubleClick}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onConnectionSelect(conn.id);
                                }}
                                className={`
                                    px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer select-none
                                    ${isSelected 
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' 
                                        : (conn.label ? 'bg-white border-slate-200 text-slate-500 shadow-sm hover:border-indigo-300' : 'opacity-0 group-hover:opacity-100 bg-slate-100 border-slate-200 text-slate-400')
                                    }
                                `}
                            >
                                {conn.label || '+'}
                            </div>
                        )
                    )}
                </div>
            </foreignObject>
        )}
      </React.Fragment>
    );
  };

  const tempConnectionStartId = interactionState.current.connectionStartId;

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
      onDragOver={handleDragOver}
      onDrop={handleDrop}
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

          {connections.map(renderConnection)}

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
                  
                  const startCenter = { x: startNote.position.x + startNote.size.width/2, y: startNote.position.y + startNote.size.height/2 };
                  const startPoint = getIntersection(startCenter, startNote.size, endCenter);
                  const endPoint = endSize ? getIntersection(endCenter, endSize, startCenter) : endCenter;
                  const { d } = getPathData(connectionStyle, startPoint, endPoint);

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
        
        {mode === 'CONNECTING' && !hoveredTargetId && (
            <div
                className="absolute border-2 border-dashed border-slate-300 bg-white/50 rounded-sm pointer-events-none flex items-center justify-center"
                style={{
                    left: mouseWorldPos.x - 140, 
                    top: mouseWorldPos.y - 70,   
                    width: 280,
                    height: 140,
                }}
            >
                <span className="text-slate-400 font-bold text-sm">Release to Create</span>
            </div>
        )}

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
            ref={el => { if(el) noteRefs.current.set(note.id, el); }}
            note={note}
            scale={camera.z}
            isSelected={selectedNoteIds.includes(note.id)}
            isDragging={mode === 'DRAGGING_NOTES' && selectedNoteIds.includes(note.id)}
            isTarget={hoveredTargetId === note.id}
            onSelect={(id) => {
                onNoteSelect([id]); 
                onConnectionSelect(null);
            }}
            onUpdate={onNoteUpdate}
            onMouseDown={handleNoteMouseDown}
            onInteractionStart={onInteractionStart}
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