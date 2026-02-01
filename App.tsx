import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Canvas } from './components/Canvas';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { ContextMenu } from './components/ContextMenu';
import { NoteData, Connection, Camera, Position, ConnectionStyle, NoteColor, NoteType } from './types';
import { Info, X, ZoomIn, ZoomOut, Scan, Undo2, Redo2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { brainstormRelatedIdeas, summarizeNote } from './services/geminiService';

const INITIAL_NOTE: NoteData = {
  id: '1',
  type: 'text',
  content: 'Double-click to create.\n- Drag Logic Gates from sidebar.\n- Connect nodes to build flow.\n- Click "Align" to organize.',
  position: { x: 100, y: 100 },
  size: { width: 280, height: 160 },
  color: 'white',
  createdAt: Date.now(),
};

interface HistoryState {
    notes: NoteData[];
    connections: Connection[];
}

export default function App() {
  const [notes, setNotes] = useState<NoteData[]>([INITIAL_NOTE]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, z: 1 });
  
  // Undo/Redo Stacks
  const [past, setPast] = useState<HistoryState[]>([]);
  const [future, setFuture] = useState<HistoryState[]>([]);
  
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [connectionStyle, setConnectionStyle] = useState<ConnectionStyle>('curve');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [mermaidModal, setMermaidModal] = useState<{isOpen: boolean, content: string}>({isOpen: false, content: ''});
  
  // Track if we are currently dragging nodes to hide UI elements for performance
  const [isDraggingNodes, setIsDraggingNodes] = useState(false);

  // --- History Management ---
  const saveHistory = useCallback(() => {
      setPast(prev => [...prev, { notes, connections }]);
      setFuture([]); // Clear future on new action
  }, [notes, connections]);

  const undo = useCallback(() => {
      if (past.length === 0) return;
      
      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);
      
      setFuture(prev => [{ notes, connections }, ...prev]);
      setNotes(previous.notes);
      setConnections(previous.connections);
      setPast(newPast);
      setSelectedNoteIds([]); // Clear selection to avoid ghost UI
  }, [past, notes, connections]);

  const redo = useCallback(() => {
      if (future.length === 0) return;

      const next = future[0];
      const newFuture = future.slice(1);

      setPast(prev => [...prev, { notes, connections }]);
      setNotes(next.notes);
      setConnections(next.connections);
      setFuture(newFuture);
      setSelectedNoteIds([]);
  }, [future, notes, connections]);

  // Handle Global Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
          return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
          e.preventDefault();
          redo();
          return;
      }

      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'TEXTAREA' || activeTag === 'INPUT') return;

      if (e.key === 'Escape') {
          setSelectedNoteIds([]);
          setSelectedConnectionId(null);
          setContextMenu(null);
          return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
          if (selectedNoteIds.length > 0) {
              handleDeleteNotes(selectedNoteIds);
          } else if (selectedConnectionId) {
              saveHistory();
              setConnections(prev => prev.filter(c => c.id !== selectedConnectionId));
              setSelectedConnectionId(null);
          }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNoteIds, selectedConnectionId, undo, redo, saveHistory]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
        if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
        if ((e.target as HTMLElement).tagName === 'INPUT') return;

        const text = e.clipboardData?.getData('text');
        if (text) {
             saveHistory();
             const centerX = -camera.x / camera.z + (window.innerWidth / 2 / camera.z);
             const centerY = -camera.y / camera.z + (window.innerHeight / 2 / camera.z);
             createNote({ x: centerX, y: centerY }, text);
        }
  }, [camera, saveHistory]);

  useEffect(() => {
      window.addEventListener('paste', handlePaste);
      return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const handleNoteUpdate = useCallback((id: string, data: Partial<NoteData>) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...data } : n));
  }, []);

  const handleNoteMove = useCallback((id: string, delta: Position) => {
    setIsDraggingNodes(true);
    setNotes(prev => {
        if (selectedNoteIds.includes(id)) {
            return prev.map(n => 
                selectedNoteIds.includes(n.id) 
                ? { ...n, position: { x: n.position.x + delta.x, y: n.position.y + delta.y } } 
                : n
            );
        }
        return prev.map(n => n.id === id ? { ...n, position: { x: n.position.x + delta.x, y: n.position.y + delta.y } } : n);
    });
  }, [selectedNoteIds]);

  const handleDragEnd = useCallback(() => {
      setIsDraggingNodes(false);
  }, []);

  const handleConnect = useCallback((sourceId: string, targetId: string) => {
    saveHistory();
    setConnections(prev => {
        const forward = prev.find(c => c.fromId === sourceId && c.toId === targetId);
        const reverse = prev.find(c => c.fromId === targetId && c.toId === sourceId);
        if (forward) return prev.filter(c => c.id !== forward.id); // Toggle off

        let newConnections = prev;
        if (reverse) newConnections = prev.filter(c => c.id !== reverse.id); // Replace reverse

        return [...newConnections, {
            id: Math.random().toString(36).substr(2, 9),
            fromId: sourceId,
            toId: targetId
        }];
    });
  }, [saveHistory]);

  const handleConnectionUpdate = useCallback((id: string, label: string) => {
      setConnections(prev => prev.map(c => c.id === id ? { ...c, label } : c));
  }, []);

  const handleDeleteNotes = useCallback((ids: string[]) => {
      saveHistory();
      setNotes(prev => prev.filter(n => !ids.includes(n.id)));
      setConnections(prev => prev.filter(c => !ids.includes(c.fromId) && !ids.includes(c.toId)));
      setSelectedNoteIds([]);
  }, [saveHistory]);

  const createNote = useCallback((pos: Position, content = '', parentId?: string, type: NoteType = 'text') => {
    // Logic nodes have fixed sizes (handled in CSS mostly, but logic here for initial placement)
    const isLogic = type !== 'text';
    const size = isLogic ? { width: 80, height: 80 } : { width: 280, height: 140 };

    const newNote: NoteData = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content,
      position: pos,
      size,
      color: 'white',
      createdAt: Date.now(),
    };
    
    setNotes(prev => [...prev, newNote]);
    if (parentId) {
        setConnections(prev => [...prev, {
            id: Math.random().toString(36).substr(2, 9),
            fromId: parentId,
            toId: newNote.id
        }]);
    }
    return newNote.id;
  }, []);

  const handleCreateAndConnect = useCallback((sourceId: string, position: Position) => {
      saveHistory();
      const centeredPos = { x: position.x - 140, y: position.y - 70 };
      createNote(centeredPos, '', sourceId);
  }, [createNote, saveHistory]);

  const handleColorChange = (color: NoteColor) => {
      saveHistory();
      setNotes(prev => prev.map(n => selectedNoteIds.includes(n.id) ? { ...n, color } : n));
  };

  const handleDrop = useCallback((e: React.DragEvent, worldPos: Position) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('noteType') as NoteType;
      const label = e.dataTransfer.getData('label');
      
      if (type) {
          saveHistory();
          // Adjust for center of the node roughly
          const finalPos = { x: worldPos.x - 40, y: worldPos.y - 40 };
          createNote(finalPos, label, undefined, type);
      }
  }, [createNote, saveHistory]);

  // --- Auto Layout Algorithm (Longest Path Layering) ---
  const handleAutoLayout = (direction: 'horizontal' | 'vertical') => {
      if (notes.length === 0) return;
      saveHistory();

      // 1. Build Graph
      const children: Record<string, string[]> = {};
      const parents: Record<string, string[]> = {};
      notes.forEach(n => { children[n.id] = []; parents[n.id] = []; });
      connections.forEach(c => {
          if (children[c.fromId] && children[c.toId]) {
              children[c.fromId].push(c.toId);
              parents[c.toId].push(c.fromId);
          }
      });

      // 2. Assign Ranks (Longest Path)
      // We use a memoized recursive DFS to find the "depth" of each node
      const ranks: Record<string, number> = {};
      const getRank = (nodeId: string, visited: Set<string>): number => {
          if (ranks[nodeId] !== undefined) return ranks[nodeId];
          if (visited.has(nodeId)) return 0; // Cycle detected, treat as rank 0 relative to cycle start

          visited.add(nodeId);
          let maxParentRank = -1;
          
          parents[nodeId].forEach(pid => {
              const r = getRank(pid, new Set(visited));
              if (r > maxParentRank) maxParentRank = r;
          });

          ranks[nodeId] = maxParentRank + 1;
          return ranks[nodeId];
      };

      notes.forEach(n => getRank(n.id, new Set()));

      // 3. Group by Rank
      const layers: Record<number, string[]> = {};
      let maxRank = 0;
      Object.entries(ranks).forEach(([id, rank]) => {
          if (!layers[rank]) layers[rank] = [];
          layers[rank].push(id);
          maxRank = Math.max(maxRank, rank);
      });

      // 4. Assign Coordinates
      const newPositions: Record<string, Position> = {};
      
      const VERTICAL_LAYER_SPACING = 250;
      const HORIZONTAL_LAYER_SPACING = 400;
      const NODE_GAP = 320; 

      // Center the graph
      const currentCenterX = notes.reduce((sum, n) => sum + n.position.x, 0) / notes.length;
      const currentCenterY = notes.reduce((sum, n) => sum + n.position.y, 0) / notes.length;
      
      let layoutMinX = Infinity, layoutMaxX = -Infinity;
      let layoutMinY = Infinity, layoutMaxY = -Infinity;

      for (let r = 0; r <= maxRank; r++) {
          const nodesInLayer = layers[r] || [];
          // Sort nodes in layer to minimize crossings (simple heuristic: average parent pos)
          nodesInLayer.sort((a, b) => {
              const avgPosA = parents[a].length > 0 
                  ? parents[a].reduce((sum, pid) => sum + (newPositions[pid]?.x || 0), 0) / parents[a].length 
                  : 0;
              const avgPosB = parents[b].length > 0 
                  ? parents[b].reduce((sum, pid) => sum + (newPositions[pid]?.x || 0), 0) / parents[b].length 
                  : 0;
               // Also use existing X as secondary sort to preserve some user intent
               const currentA = notes.find(n => n.id === a)?.position.x || 0;
               const currentB = notes.find(n => n.id === b)?.position.x || 0;
               
               if (parents[a].length === 0 && parents[b].length === 0) return currentA - currentB;
               return avgPosA - avgPosB;
          });

          const layerWidth = nodesInLayer.length * NODE_GAP;
          
          nodesInLayer.forEach((nodeId, idx) => {
              const node = notes.find(n => n.id === nodeId)!;
              
              if (direction === 'horizontal') {
                  // Rank -> X, Index -> Y
                  const x = r * HORIZONTAL_LAYER_SPACING;
                  const y = (idx * NODE_GAP) - (layerWidth / 2);
                  newPositions[nodeId] = { x, y };
              } else {
                   // Rank -> Y, Index -> X
                  const x = (idx * NODE_GAP) - (layerWidth / 2);
                  const y = r * VERTICAL_LAYER_SPACING;
                  newPositions[nodeId] = { x, y };
              }
          });
      }

      // 5. Apply positions
      // Find bounds of new layout
      const movedIds = Object.keys(newPositions);
      if (movedIds.length > 0) {
          movedIds.forEach(id => {
              const p = newPositions[id];
              layoutMinX = Math.min(layoutMinX, p.x);
              layoutMaxX = Math.max(layoutMaxX, p.x);
              layoutMinY = Math.min(layoutMinY, p.y);
              layoutMaxY = Math.max(layoutMaxY, p.y);
          });
          
          const layoutCenterX = (layoutMinX + layoutMaxX) / 2;
          const layoutCenterY = (layoutMinY + layoutMaxY) / 2;

          // Shift to match original visual center
          const offsetX = currentCenterX - layoutCenterX;
          const offsetY = currentCenterY - layoutCenterY;

          setNotes(prev => prev.map(n => {
              if (newPositions[n.id]) {
                  return { 
                      ...n, 
                      position: {
                          x: newPositions[n.id].x + offsetX,
                          y: newPositions[n.id].y + offsetY
                      }
                  };
              }
              return n;
          }));
      }

      setConnectionStyle(direction === 'horizontal' ? 'curve' : 'step');
  };

  const handleBrainstorm = async () => {
      if (selectedNoteIds.length !== 1) return;
      saveHistory();
      const sourceNote = notes.find(n => n.id === selectedNoteIds[0]);
      if (!sourceNote) return;

      setIsBrainstorming(true);
      try {
          const results = await brainstormRelatedIdeas(sourceNote.content);
          if (results.length > 0) {
              const startX = sourceNote.position.x + sourceNote.size.width + 100;
              const startY = sourceNote.position.y;
              const spacingY = 180;
              results.forEach((idea, index) => {
                  const newPos = {
                      x: startX,
                      y: startY - ((results.length - 1) * spacingY / 2) + (index * spacingY)
                  };
                  createNote(newPos, idea.content, sourceNote.id);
              });
          }
      } catch (e) {
          setErrorMsg("Failed to generate ideas.");
          setTimeout(() => setErrorMsg(null), 3000);
      } finally {
          setIsBrainstorming(false);
      }
  };

  const handleSummarize = async () => {
      if (selectedNoteIds.length !== 1) return;
      saveHistory();
      const sourceNote = notes.find(n => n.id === selectedNoteIds[0]);
      if (!sourceNote) return;

      setIsBrainstorming(true);
      try {
          const summary = await summarizeNote(sourceNote.content);
          if (summary) {
              handleNoteUpdate(sourceNote.id, { content: sourceNote.content + '\n\n**Summary:**\n' + summary });
          }
      } catch (e) {
          setErrorMsg("Failed to summarize.");
          setTimeout(() => setErrorMsg(null), 3000);
      } finally {
          setIsBrainstorming(false);
      }
  };

  const handleContextMenuAction = (action: string) => {
      if (!contextMenu) return;
      
      const worldPos = {
          x: (contextMenu.x - camera.x) / camera.z,
          y: (contextMenu.y - camera.y) / camera.z
      };

      if (action === 'CREATE_NOTE') {
          saveHistory();
          createNote(worldPos);
      } else if (action === 'RESET_VIEW') {
          setCamera({ x: 0, y: 0, z: 1 });
      }
      setContextMenu(null);
  };

  const toolbarPosition = useMemo(() => {
      if (isDraggingNodes) return null; // Hide toolbar when dragging
      if (selectedNoteIds.length === 0) return null;
      const selectedNotes = notes.filter(n => selectedNoteIds.includes(n.id));
      if (selectedNotes.length === 0) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity;
      selectedNotes.forEach(n => {
          minX = Math.min(minX, n.position.x);
          minY = Math.min(minY, n.position.y);
          maxX = Math.max(maxX, n.position.x + (n.size.width || 0));
      });
      const centerX = (minX + maxX) / 2;
      return { x: centerX * camera.z + camera.x, y: minY * camera.z + camera.y };
  }, [selectedNoteIds, notes, camera, isDraggingNodes]);

  const handleExportMermaid = () => {
      let graph = 'graph TD\n';
      graph += '  classDef default fill:#fff,stroke:#333,stroke-width:2px;\n';
      notes.forEach(n => {
          let label = n.content.replace(/["\n]/g, ' ').substring(0, 50);
          if (n.type && n.type !== 'text') label = `[${n.content}]`; 
          
          let shapeStart = '[';
          let shapeEnd = ']';
          if (n.type === 'logic_and') { shapeStart = '(('; shapeEnd = '))'; }
          if (n.type === 'logic_or') { shapeStart = '{'; shapeEnd = '}'; }
          if (n.type === 'logic_decision') { shapeStart = '{'; shapeEnd = '}'; }
          
          graph += `  ${n.id}${shapeStart}"${label || 'Empty'}"${shapeEnd}\n`;
      });
      connections.forEach(c => {
          const label = c.label ? `|${c.label}|` : '';
          graph += `  ${c.fromId} --${label}--> ${c.toId}\n`;
      });
      setMermaidModal({ isOpen: true, content: graph });
  };

  const handleExportPDF = async () => {
    if (notes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    notes.forEach(n => {
        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x + (n.size.width || 100));
        maxY = Math.max(maxY, n.position.y + (n.size.height || 100));
    });
    const padding = 50;
    if (minX === Infinity) { minX=0; minY=0; maxX=100; maxY=100; }
    const width = maxX - minX + (padding * 2);
    const height = maxY - minY + (padding * 2);
    const source = document.getElementById('canvas-content');
    if (!source) return;
    const clone = source.cloneNode(true) as HTMLElement;
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, { position: 'fixed', top: '0', left: '0', width: `${width}px`, height: `${height}px`, zIndex: '-9999', overflow: 'hidden', backgroundColor: '#f8fafc' });
    clone.style.transform = `translate(${-minX + padding}px, ${-minY + padding}px) scale(1)`;
    clone.style.position = 'absolute'; clone.style.left = '0'; clone.style.top = '0';
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);
    try {
        const canvas = await html2canvas(wrapper, { backgroundColor: '#f8fafc', scale: 2, logging: false, ignoreElements: (el) => el.classList.contains('no-print') });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: width > height ? 'l' : 'p', unit: 'px', format: [width, height] });
        pdf.addImage(imgData, 'PNG', 0, 0, width, height);
        pdf.save('thinkchain-export.pdf');
    } catch (e) { console.error(e); } finally { document.body.removeChild(wrapper); }
  };

  const handleZoom = (delta: number) => {
      setCamera(prev => ({ ...prev, z: Math.min(Math.max(0.1, prev.z + delta), 5) }));
  };

  const handleFitView = () => {
      if (notes.length === 0) { setCamera({ x: 0, y: 0, z: 1 }); return; }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      notes.forEach(n => {
          minX = Math.min(minX, n.position.x);
          minY = Math.min(minY, n.position.y);
          maxX = Math.max(maxX, n.position.x + n.size.width);
          maxY = Math.max(maxY, n.position.y + n.size.height);
      });
      const padding = 100;
      const contentW = maxX - minX + padding * 2;
      const contentH = maxY - minY + padding * 2;
      const newZoom = Math.min(Math.min(window.innerWidth / contentW, window.innerHeight / contentH), 1); 
      setCamera({ x: window.innerWidth / 2 - ((minX + maxX) / 2) * newZoom, y: window.innerHeight / 2 - ((minY + maxY) / 2) * newZoom, z: newZoom });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden text-slate-800 font-sans">
      <Sidebar 
        connectionStyle={connectionStyle} 
        setConnectionStyle={setConnectionStyle} 
        onExportMermaid={handleExportMermaid}
        onExportPDF={handleExportPDF}
        onAutoLayout={handleAutoLayout}
      />
      
      <main className="flex-1 relative bg-[#f8fafc]">
        <Canvas
          notes={notes}
          connections={connections}
          connectionStyle={connectionStyle}
          camera={camera}
          setCamera={setCamera}
          selectedNoteIds={selectedNoteIds}
          selectedConnectionId={selectedConnectionId}
          onConnectionSelect={setSelectedConnectionId}
          onConnectionUpdate={handleConnectionUpdate}
          onNoteUpdate={handleNoteUpdate}
          onNoteMove={handleNoteMove}
          onDragEnd={handleDragEnd}
          onNoteSelect={setSelectedNoteIds}
          onConnect={handleConnect}
          onCreateAndConnect={handleCreateAndConnect}
          onDeleteNotes={handleDeleteNotes}
          onCanvasDoubleClick={(pos) => { saveHistory(); createNote(pos); }}
          onCanvasContextMenu={(pos) => setContextMenu(pos)}
          onInteractionStart={saveHistory}
          onDrop={handleDrop}
        />

        {toolbarPosition && (
            <Toolbar 
                position={toolbarPosition}
                onColorChange={handleColorChange}
                onDelete={() => handleDeleteNotes(selectedNoteIds)}
                onBrainstorm={handleBrainstorm}
                onSummarize={handleSummarize}
                isBrainstorming={isBrainstorming}
            />
        )}
        
        {contextMenu && (
            <ContextMenu 
                x={contextMenu.x}
                y={contextMenu.y}
                type="CANVAS"
                onClose={() => setContextMenu(null)}
                onAction={handleContextMenuAction}
            />
        )}

        <div className="fixed bottom-6 left-6 flex gap-2 z-50 no-print">
             {/* Undo/Redo Group */}
            <div className="bg-white p-1 rounded-md shadow-md border-2 border-slate-200 flex items-center gap-1 mr-2">
                <button onClick={undo} disabled={past.length === 0} className="p-2 hover:bg-slate-100 rounded text-slate-600 disabled:opacity-30" title="Undo (Ctrl+Z)"><Undo2 size={20}/></button>
                <button onClick={redo} disabled={future.length === 0} className="p-2 hover:bg-slate-100 rounded text-slate-600 disabled:opacity-30" title="Redo (Ctrl+Y)"><Redo2 size={20}/></button>
            </div>

            {/* Zoom Group */}
            <div className="bg-white p-1 rounded-md shadow-md border-2 border-slate-200 flex items-center gap-1">
                <button onClick={() => handleZoom(-0.1)} className="p-2 hover:bg-slate-100 rounded text-slate-600" title="Zoom Out"><ZoomOut size={20}/></button>
                <span className="text-xs font-mono w-12 text-center">{(camera.z * 100).toFixed(0)}%</span>
                <button onClick={() => handleZoom(0.1)} className="p-2 hover:bg-slate-100 rounded text-slate-600" title="Zoom In"><ZoomIn size={20}/></button>
            </div>
            <button onClick={handleFitView} className="bg-white p-3 rounded-md shadow-md border-2 border-slate-200 text-slate-600 hover:bg-slate-100" title="Fit to Screen">
                <Scan size={20}/>
            </button>
        </div>

        {errorMsg && (
            <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2 text-sm font-bold animate-in fade-in slide-in-from-bottom-5">
                <Info size={16} />
                <span>{errorMsg}</span>
                <button onClick={() => setErrorMsg(null)} className="ml-2 hover:bg-red-100 rounded-full p-1"><X size={12}/></button>
            </div>
        )}

        {mermaidModal.isOpen && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl border-2 border-slate-800 flex flex-col max-h-[80vh]">
                    <div className="flex justify-between items-center p-4 border-b-2 border-slate-100">
                        <h3 className="font-bold text-lg">Mermaid Export</h3>
                        <button onClick={() => setMermaidModal({isOpen: false, content: ''})} className="hover:bg-slate-100 p-2 rounded-full">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-4 flex-1 overflow-hidden flex flex-col">
                        <p className="text-sm text-slate-500 mb-2">Copy this into a Mermaid viewer or editor.</p>
                        <textarea 
                            readOnly 
                            value={mermaidModal.content} 
                            className="w-full h-64 p-3 bg-slate-50 rounded border-2 border-slate-200 font-mono text-sm resize-none focus:outline-none focus:border-indigo-500"
                            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                        />
                    </div>
                    <div className="p-4 border-t-2 border-slate-100 flex justify-end">
                        <button 
                            onClick={() => {
                                navigator.clipboard.writeText(mermaidModal.content);
                                setMermaidModal(prev => ({...prev, isOpen: false}));
                                setErrorMsg("Copied to clipboard!"); 
                                setTimeout(() => setErrorMsg(null), 2000);
                            }}
                            className="bg-slate-800 text-white px-4 py-2 rounded font-bold hover:bg-slate-700 transition-colors"
                        >
                            Copy & Close
                        </button>
                    </div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}