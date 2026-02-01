import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Canvas } from './components/Canvas';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { NoteData, Connection, Camera, Position, ConnectionStyle, NoteColor } from './types';
import { Info, X, ZoomIn, ZoomOut, Scan } from 'lucide-react';
// These imports are available via importmap in index.html
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { brainstormRelatedIdeas } from './services/geminiService';

const INITIAL_NOTE: NoteData = {
  id: '1',
  content: 'Double-click to create.\n- Right-click drag to connect.\n- Select a card to use AI.\n- Drag connection to empty space to create new node.',
  position: { x: 100, y: 100 },
  size: { width: 280, height: 160 },
  color: 'white',
  createdAt: Date.now(),
};

export default function App() {
  const [notes, setNotes] = useState<NoteData[]>([INITIAL_NOTE]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, z: 1 });
  
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  
  const [connectionStyle, setConnectionStyle] = useState<ConnectionStyle>('curve');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBrainstorming, setIsBrainstorming] = useState(false);
  
  const [mermaidModal, setMermaidModal] = useState<{isOpen: boolean, content: string}>({isOpen: false, content: ''});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'TEXTAREA' || activeTag === 'INPUT') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
          if (selectedNoteIds.length > 0) {
              handleDeleteNotes(selectedNoteIds);
          } else if (selectedConnectionId) {
              setConnections(prev => prev.filter(c => c.id !== selectedConnectionId));
              setSelectedConnectionId(null);
          }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNoteIds, selectedConnectionId]);

  const handleNoteUpdate = useCallback((id: string, data: Partial<NoteData>) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...data } : n));
  }, []);

  const handleNoteMove = useCallback((id: string, delta: Position) => {
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

  const handleConnect = useCallback((sourceId: string, targetId: string) => {
    setConnections(prev => {
        const forward = prev.find(c => c.fromId === sourceId && c.toId === targetId);
        const reverse = prev.find(c => c.fromId === targetId && c.toId === sourceId);

        if (forward) {
            return prev.filter(c => c.id !== forward.id);
        }

        let newConnections = prev;
        if (reverse) {
            newConnections = prev.filter(c => c.id !== reverse.id);
        }

        return [...newConnections, {
            id: Math.random().toString(36).substr(2, 9),
            fromId: sourceId,
            toId: targetId
        }];
    });
  }, []);

  const handleDeleteNotes = useCallback((ids: string[]) => {
      setNotes(prev => prev.filter(n => !ids.includes(n.id)));
      setConnections(prev => prev.filter(c => !ids.includes(c.fromId) && !ids.includes(c.toId)));
      setSelectedNoteIds([]);
  }, []);

  const createNote = useCallback((pos: Position, content = '', parentId?: string) => {
    const newNote: NoteData = {
      id: Math.random().toString(36).substr(2, 9),
      content,
      position: pos,
      size: { width: 280, height: 140 },
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
      const centeredPos = {
          x: position.x - 140, // half width
          y: position.y - 70   // half height
      };
      createNote(centeredPos, '', sourceId);
  }, [createNote]);

  const handleColorChange = (color: NoteColor) => {
      setNotes(prev => prev.map(n => selectedNoteIds.includes(n.id) ? { ...n, color } : n));
  };

  const handleBrainstorm = async () => {
      if (selectedNoteIds.length !== 1) return;
      
      const sourceNote = notes.find(n => n.id === selectedNoteIds[0]);
      if (!sourceNote) return;

      setIsBrainstorming(true);
      try {
          const results = await brainstormRelatedIdeas(sourceNote.content);
          
          if (results.length > 0) {
              const startX = sourceNote.position.x + sourceNote.size.width + 100;
              const startY = sourceNote.position.y;
              const spacingY = 180;
              const totalHeight = (results.length - 1) * spacingY;
              
              results.forEach((idea, index) => {
                  const newPos = {
                      x: startX,
                      y: startY - (totalHeight / 2) + (index * spacingY)
                  };
                  createNote(newPos, idea.content, sourceNote.id);
              });
          }
      } catch (e) {
          console.error(e);
          setErrorMsg("Failed to generate ideas. Check your API Key.");
          setTimeout(() => setErrorMsg(null), 3000);
      } finally {
          setIsBrainstorming(false);
      }
  };

  // Calculate toolbar position
  const toolbarPosition = useMemo(() => {
      if (selectedNoteIds.length === 0) return null;
      
      const selectedNotes = notes.filter(n => selectedNoteIds.includes(n.id));
      if (selectedNotes.length === 0) return null;

      let minX = Infinity, minY = Infinity, maxX = -Infinity;
      selectedNotes.forEach(n => {
          minX = Math.min(minX, n.position.x);
          minY = Math.min(minY, n.position.y);
          maxX = Math.max(maxX, n.position.x + n.size.width);
      });

      const centerX = (minX + maxX) / 2;
      
      // Convert world coordinates to screen coordinates
      const screenX = centerX * camera.z + camera.x;
      const screenY = minY * camera.z + camera.y;

      return { x: screenX, y: screenY };
  }, [selectedNoteIds, notes, camera]);

  const handleExportMermaid = () => {
      let graph = 'graph TD\n';
      graph += '  classDef default fill:#fff,stroke:#333,stroke-width:2px;\n';
      
      notes.forEach(n => {
          const label = n.content.replace(/["\n]/g, ' ').substring(0, 50) + (n.content.length > 50 ? '...' : '');
          graph += `  ${n.id}["${label || 'Empty Note'}"]\n`;
      });
      
      connections.forEach(c => {
          graph += `  ${c.fromId} --> ${c.toId}\n`;
      });

      setMermaidModal({ isOpen: true, content: graph });
  };

  const handleExportPDF = async () => {
    if (notes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    notes.forEach(n => {
        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x + n.size.width);
        maxY = Math.max(maxY, n.position.y + n.size.height);
    });
    
    const padding = 50;
    if (minX === Infinity) { minX=0; minY=0; maxX=100; maxY=100; }

    const width = maxX - minX + (padding * 2);
    const height = maxY - minY + (padding * 2);

    const source = document.getElementById('canvas-content');
    if (!source) return;

    const clone = source.cloneNode(true) as HTMLElement;
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.top = '0';
    wrapper.style.left = '0'; 
    wrapper.style.width = `${width}px`;
    wrapper.style.height = `${height}px`;
    wrapper.style.zIndex = '-9999';
    wrapper.style.overflow = 'hidden';
    wrapper.style.backgroundColor = '#f8fafc'; 
    
    clone.style.transform = `translate(${-minX + padding}px, ${-minY + padding}px) scale(1)`;
    clone.style.position = 'absolute';
    clone.style.left = '0';
    clone.style.top = '0';
    clone.style.width = '100%';
    clone.style.height = '100%';
    
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    try {
        const canvas = await html2canvas(wrapper, {
            backgroundColor: '#f8fafc',
            scale: 2, 
            logging: false,
            ignoreElements: (element) => element.classList.contains('no-print'),
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: width > height ? 'l' : 'p',
            unit: 'px',
            format: [width, height]
        });

        pdf.addImage(imgData, 'PNG', 0, 0, width, height);
        pdf.save('thinkchain-export.pdf');

    } catch (e) {
        console.error("PDF Export failed", e);
        setErrorMsg("Failed to generate PDF. Please try again.");
    } finally {
        document.body.removeChild(wrapper);
    }
  };

  const handleZoom = (delta: number) => {
      setCamera(prev => ({
          ...prev,
          z: Math.min(Math.max(0.1, prev.z + delta), 5)
      }));
  };

  const handleFitView = () => {
      if (notes.length === 0) {
          setCamera({ x: 0, y: 0, z: 1 });
          return;
      }
      
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
      
      const scaleX = window.innerWidth / contentW;
      const scaleY = window.innerHeight / contentH;
      const newZoom = Math.min(Math.min(scaleX, scaleY), 1); 

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      
      const newX = window.innerWidth / 2 - centerX * newZoom;
      const newY = window.innerHeight / 2 - centerY * newZoom;

      setCamera({ x: newX, y: newY, z: newZoom });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden text-slate-800 font-sans">
      <Sidebar 
        connectionStyle={connectionStyle} 
        setConnectionStyle={setConnectionStyle} 
        onExportMermaid={handleExportMermaid}
        onExportPDF={handleExportPDF}
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
          onNoteUpdate={handleNoteUpdate}
          onNoteMove={handleNoteMove}
          onNoteSelect={setSelectedNoteIds}
          onConnect={handleConnect}
          onCreateAndConnect={handleCreateAndConnect}
          onDeleteNotes={handleDeleteNotes}
          onCanvasDoubleClick={(pos) => createNote(pos)}
        />

        {toolbarPosition && (
            <Toolbar 
                position={toolbarPosition}
                onColorChange={handleColorChange}
                onDelete={() => handleDeleteNotes(selectedNoteIds)}
                onBrainstorm={handleBrainstorm}
                isBrainstorming={isBrainstorming}
            />
        )}

        <div className="fixed bottom-6 left-6 flex gap-2 z-50 no-print">
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