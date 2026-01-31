export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface NoteData {
  id: string;
  title: string;
  content: string;
  position: Position;
  size: Size;
  color: 'white' | 'blue' | 'yellow' | 'green' | 'red' | 'purple';
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

export enum ToolType {
  SELECT = 'SELECT',
  HAND = 'HAND',
  CREATE = 'CREATE',
}

// AI Related Types
export interface AIBrainstormResult {
  title: string;
  content: string;
}
