import React, { useState, useCallback, useEffect } from 'react';
import { Canvas } from './components/Canvas';
import { Sidebar } from './components/Sidebar';
import { NoteData, Connection, Camera, Position } from './types';
import { brainstormRelatedIdeas } from './services/geminiService';
import { Plus, Info } from 'lucide-react';

const INITIAL_NOTE: NoteData = {
  id: '1',
  title: 'Project Kickoff',
  content: 'Objectives:\n- Define core MVP\n- Set up infrastructure\n- Design system basics',
  position: { x: 100, y: 100 },
  size: { width: 300, height: 200 },
  color: 'white',
  createdAt: Date.now(),
};

export default function App() {
  const [notes, setNotes] = useState<NoteData[]>([INITIAL_NOTE]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, z: 1 });
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Handlers
  const handleNoteUpdate = useCallback((id: string, data: Partial<NoteData>) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...data } : n));
  }, []);

  const handleNoteMove = useCallback((id: string, pos: Position) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, position: pos } : n));
  }, []);

  const handleNoteDelete = useCallback((id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    setConnections(prev => prev.filter(c => c.fromId !== id && c.toId !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);
  }, [selectedNoteId]);

  const handleCanvasClick = useCallback((pos: Position) => {
    // If double click logic was needed, we'd do it here.
    // For now, single click on empty space deselects, handled in Canvas.
    setSelectedNoteId(null);
  }, []);

  const createNote = useCallback((pos: Position, title = '', content = '', parentId?: string) => {
    const newNote: NoteData = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      content,
      position: pos,
      size: { width: 280, height: 160 },
      color: 'white',
      createdAt: Date.now(),
    };
    
    setNotes(prev => [...prev, newNote]);
    
    if (parentId) {
      const newConn: Connection = {
        id: Math.random().toString(36).substr(2, 9),
        fromId: parentId,
        toId: newNote.id,
      };
      setConnections(prev => [...prev, newConn]);
    }
    return newNote.id;
  }, []);

  const handleCreateNoteAtCenter = () => {
    // Create at center of current view
    const centerX = -camera.x / camera.z + (window.innerWidth / 2) / camera.z;
    const centerY = -camera.y / camera.z + (window.innerHeight / 2) / camera.z;
    createNote({ x: centerX - 140, y: centerY - 80 });
  };

  const handleBrainstorm = async (id: string) => {
    const sourceNote = notes.find(n => n.id === id);
    if (!sourceNote || isProcessingAI) return;

    if (!process.env.API_KEY) {
        setErrorMsg("Please provide an API Key in the code configuration to use AI features.");
        setTimeout(() => setErrorMsg(null), 5000);
        return;
    }

    setIsProcessingAI(true);
    // Visual feedback
    const tempId = 'ai-pending-' + id;
    
    try {
      const ideas = await brainstormRelatedIdeas(sourceNote.title, sourceNote.content);
      
      // Calculate positions for new notes around the source note
      // Simple radial layout
      const radius = 350;
      const startAngle = 0;
      
      ideas.forEach((idea, index) => {
        const angle = startAngle + (index * (Math.PI / 2)); // Spread them out
        const offsetX = Math.cos(angle) * radius;
        const offsetY = Math.sin(angle) * radius; // Place below/around

        // Adjust position slightly random to avoid perfect stacking if angle repeats
        const newPos = {
          x: sourceNote.position.x + offsetX + (Math.random() * 50),
          y: sourceNote.position.y + offsetY + (Math.random() * 50) + 200, // Bias downwards
        };

        createNote(newPos, idea.title, idea.content, id);
      });

    } catch (e) {
      console.error(e);
      setErrorMsg("Failed to generate ideas. Check console.");
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setIsProcessingAI(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden text-slate-800">
      <Sidebar />
      
      <main className="flex-1 relative">
        <Canvas
          notes={notes}
          connections={connections}
          camera={camera}
          setCamera={setCamera}
          selectedNoteId={selectedNoteId}
          onNoteUpdate={handleNoteUpdate}
          onNoteMove={handleNoteMove}
          onNoteSelect={setSelectedNoteId}
          onNoteDelete={handleNoteDelete}
          onBrainstorm={handleBrainstorm}
          onCanvasClick={handleCanvasClick}
        />

        {/* Floating Toolbar (Top Center) */}
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur shadow-lg border border-slate-200 rounded-full px-6 py-2 flex items-center gap-4 z-40">
           <span className="font-semibold text-slate-700 tracking-tight">MindMap AI</span>
           <div className="h-4 w-px bg-slate-200"></div>
           <button 
             onClick={handleCreateNoteAtCenter}
             className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
           >
             <Plus size={16} />
             Add Note
           </button>
           <div className="h-4 w-px bg-slate-200"></div>
           <span className="text-xs text-slate-400">
             {notes.length} notes &bull; {Math.round(camera.z * 100)}% zoom
           </span>
        </div>

        {/* AI Processing Overlay */}
        {isProcessingAI && (
          <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 bg-indigo-600 text-white px-6 py-3 rounded-full shadow-xl z-50 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
             <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
             <span className="font-medium">AI is brainstorming ideas...</span>
          </div>
        )}

        {/* Error Toast */}
        {errorMsg && (
            <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-full shadow-xl z-50 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4">
                <Info size={18} />
                <span>{errorMsg}</span>
            </div>
        )}
      </main>
    </div>
  );
}
