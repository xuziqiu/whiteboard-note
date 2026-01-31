import React from 'react';
import { MousePointer2, Spline, Activity, Minus } from 'lucide-react';
import { ConnectionStyle } from '../types';

interface SidebarProps {
    connectionStyle: ConnectionStyle;
    setConnectionStyle: (style: ConnectionStyle) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ connectionStyle, setConnectionStyle }) => {
  const styles: { id: ConnectionStyle; icon: any; label: string }[] = [
      { id: 'straight', icon: Minus, label: 'Straight' },
      { id: 'curve', icon: Spline, label: 'Curve' },
      { id: 'step', icon: Activity, label: 'Step' },
  ];

  return (
    <div className="fixed top-6 left-6 flex flex-col gap-2 z-50">
        <div className="bg-white p-1 rounded-lg shadow-md border border-slate-200 flex flex-col gap-1">
            {styles.map(s => (
                <button
                    key={s.id}
                    onClick={() => setConnectionStyle(s.id)}
                    className={`p-2 rounded transition-colors ${connectionStyle === s.id ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                    title={s.label}
                >
                    <s.icon size={20} />
                </button>
            ))}
        </div>
    </div>
  );
};
