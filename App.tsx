import React, { useState, useCallback, useEffect } from 'react';
import { Canvas } from './components/Canvas';
import { Sidebar } from './components/Sidebar';
import { NoteData, Connection, Camera, Position, ConnectionStyle } from './types';
import { Info } from 'lucide-react';

const INITIAL_NOTE: NoteData = {
  id: '1',
  content: 'Double-click anywhere to create a note.\nDrag to move.\nRight-click & drag to connect.',
  position: { x: 100, y: 100 },
  size: { width: 280, height: 160 },
  color: 'white',
  createdAt: Date.now(),
};

export default function App() {
  const [notes, setNotes] = useState<NoteData[]>([INITIAL_NOTE]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, z: 1 });
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [connectionStyle, setConnectionStyle] = useState<ConnectionStyle>('curve');
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Global Key Handler for Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNoteId) {
        // Prevent deleting if editing text
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== 'TEXTAREA' && activeTag !== 'INPUT') {
            setNotes(prev => prev.filter(n => n.id !== selectedNoteId));
            setConnections(prev => prev.filter(c => c.fromId !== selectedNoteId && c.toId !== selectedNoteId));
            setSelectedNoteId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNoteId]);

  const handleNoteUpdate = useCallback((id: string, data: Partial<NoteData>) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...data } : n));
  }, []);

  const handleNoteMove = useCallback((id: string, pos: Position) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, position: pos } : n));
  }, []);

  const handleConnect = useCallback((sourceId: string, targetId: string) => {
    setConnections(prev => {
        const exists = prev.some(c => 
            (c.fromId === sourceId && c.toId === targetId) || 
            (c.fromId === targetId && c.toId === sourceId)
        );
        if (exists) return prev;
        
        return [...prev, {
            id: Math.random().toString(36).substr(2, 9),
            fromId: sourceId,
            toId: targetId
        }];
    });
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
      handleConnect(parentId, newNote.id);
    }
    return newNote.id;
  }, [handleConnect]);

  const handleCanvasDoubleClick = (pos: Position) => {
      createNote(pos);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden text-slate-800 font-sans">
      <Sidebar connectionStyle={connectionStyle} setConnectionStyle={setConnectionStyle} />
      
      <main className="flex-1 relative bg-[#f8fafc]">
        <Canvas
          notes={notes}
          connections={connections}
          connectionStyle={connectionStyle}
          camera={camera}
          setCamera={setCamera}
          selectedNoteId={selectedNoteId}
          onNoteUpdate={handleNoteUpdate}
          onNoteMove={handleNoteMove}
          onNoteSelect={setSelectedNoteId}
          onConnect={handleConnect}
          onCanvasClick={() => {}}
          onCanvasDoubleClick={handleCanvasDoubleClick}
          onCanvasContextMenu={() => {}}
        />

        {errorMsg && (
            <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2 text-sm">
                <Info size={16} />
                <span>{errorMsg}</span>
            </div>
        )}
      </main>
    </div>
  );
}
