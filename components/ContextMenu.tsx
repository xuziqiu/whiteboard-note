import React, { useEffect, useRef } from 'react';
import { FileText, Grid, Trash2 } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  type: 'CANVAS';
  onClose: () => void;
  onAction: (action: string, payload?: any) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, type, onClose, onAction }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const style = {
    top: Math.min(y, window.innerHeight - 150),
    left: Math.min(x, window.innerWidth - 200),
  };

  const MenuItem = ({ icon: Icon, label, shortcut, onClick, danger }: any) => (
    <div
      className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 transition-colors
      ${danger ? 'text-red-500 hover:bg-red-50' : 'text-slate-700'}
      `}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} />}
        <span>{label}</span>
      </div>
      {shortcut && <span className="text-xs text-slate-400">{shortcut}</span>}
    </div>
  );

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] w-48 bg-white rounded-lg shadow-xl border border-slate-100 py-1.5 flex flex-col animate-in fade-in zoom-in-95 duration-100"
      style={style}
      onContextMenu={(e) => e.preventDefault()}
    >
      <MenuItem 
        icon={FileText} 
        label="New Note" 
        shortcut="Double Click"
        onClick={() => { onAction('CREATE_NOTE'); onClose(); }}
      />
      <MenuItem 
        icon={Grid} 
        label="Reset View" 
        onClick={() => { onAction('RESET_VIEW'); onClose(); }}
      />
    </div>
  );
};
