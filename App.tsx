import React, { useState, useCallback, useEffect } from 'react';
import { Canvas } from './components/Canvas';
import { Sidebar } from './components/Sidebar';
import { NoteData, Connection, Camera, Position, ConnectionStyle } from './types';
import { Info, X } from 'lucide-react';
// These imports are available via importmap in index.html
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const INITIAL_NOTE: NoteData = {
  id: '1',
  content: 'Double-click to create.\nRight-click drag to connect.\nLeft-click drag BG to select.',
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
  const [connectionStyle, setConnectionStyle] = useState<ConnectionStyle>('curve');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [mermaidModal, setMermaidModal] = useState<{isOpen: boolean, content: string}>({isOpen: false, content: ''});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNoteIds.length > 0) {
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== 'TEXTAREA' && activeTag !== 'INPUT') {
            handleDeleteNotes(selectedNoteIds);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNoteIds]);

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

  const handleExportMermaid = () => {
      let graph = 'graph TD\n';
      // Style class
      graph += '  classDef default fill:#fff,stroke:#333,stroke-width:2px;\n';
      
      notes.forEach(n => {
          // Sanitize content for mermaid label
          const label = n.content.replace(/["\n]/g, ' ').substring(0, 50) + (n.content.length > 50 ? '...' : '');
          graph += `  ${n.id}["${label || 'Empty Note'}"]\n`;
      });
      
      connections.forEach(c => {
          graph += `  ${c.fromId} --> ${c.toId}\n`;
      });

      setMermaidModal({ isOpen: true, content: graph });
  };

  const handleExportPDF = async () => {
    const root = document.querySelector('.dot-grid') as HTMLElement;
    if (!root) return;

    // 1. Temporarily reset transform to capture full canvas
    const originalTransform = root.style.transform;
    const originalTransition = root.style.transition;
    
    // Find bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    notes.forEach(n => {
        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x + n.size.width);
        maxY = Math.max(maxY, n.position.y + n.size.height);
    });
    
    // Add padding
    const padding = 50;
    minX -= padding; minY -= padding; maxX += padding; maxY += padding;
    const width = maxX - minX;
    const height = maxY - minY;

    // Force style for capture
    root.style.transition = 'none';
    root.style.transform = `translate(${-minX}px, ${-minY}px) scale(1)`;
    root.style.width = `${width}px`;
    root.style.height = `${height}px`;

    try {
        const canvas = await html2canvas(root, {
            backgroundColor: '#f8fafc',
            scale: 2, // Better quality
            ignoreElements: (element) => element.classList.contains('no-print'),
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: width > height ? 'l' : 'p',
            unit: 'px',
            format: [width, height] // Custom size based on content
        });

        pdf.addImage(imgData, 'PNG', 0, 0, width, height);
        pdf.save('thinkchain-export.pdf');

    } catch (e) {
        console.error("PDF Export failed", e);
        setErrorMsg("Failed to generate PDF. Please try again.");
    } finally {
        // Restore
        root.style.transform = originalTransform;
        root.style.transition = originalTransition;
        root.style.width = '';
        root.style.height = '';
    }
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
          onNoteUpdate={handleNoteUpdate}
          onNoteMove={handleNoteMove}
          onNoteSelect={setSelectedNoteIds}
          onConnect={handleConnect}
          onDeleteNotes={handleDeleteNotes}
          onCanvasDoubleClick={(pos) => createNote(pos)}
        />

        {errorMsg && (
            <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2 text-sm font-bold">
                <Info size={16} />
                <span>{errorMsg}</span>
                <button onClick={() => setErrorMsg(null)} className="ml-2 hover:bg-red-100 rounded-full p-1"><X size={12}/></button>
            </div>
        )}

        {/* Mermaid Modal */}
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
