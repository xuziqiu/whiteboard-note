export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export type NoteColor = 'white' | 'blue' | 'yellow' | 'green' | 'red' | 'purple';
export type ConnectionStyle = 'straight' | 'curve' | 'step';

export interface NoteData {
  id: string;
  content: string;
  position: Position;
  size: Size;
  color: NoteColor;
  createdAt: number;
}

export interface Connection {
  id: string;
  fromId: string;
  toId: string;
}

export interface Camera {
  x: number;
  y: number;
  z: number; // Zoom level
}

export interface AIBrainstormResult {
  content: string;
}