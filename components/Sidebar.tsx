import React from 'react';
import { MousePointer2, Spline, Activity, Minus, FileCode, FileDown } from 'lucide-react';
import { ConnectionStyle } from '../types';

interface SidebarProps {
    connectionStyle: ConnectionStyle;
    setConnectionStyle: (style: ConnectionStyle) => void;
    onExportMermaid: () => void;
    onExportPDF: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
    connectionStyle, 
    setConnectionStyle, 
    onExportMermaid, 
    onExportPDF 
}) => {
  const styles: { id: ConnectionStyle; icon: any; label: string }[] = [
      { id: 'straight', icon: Minus, label: 'Straight' },
      { id: 'curve', icon: Spline, label: 'Curve' },
      { id: 'step', icon: Activity, label: 'Step' },
  ];

  const btnClass = "p-2 rounded border border-transparent hover:bg-slate-100 text-slate-600 transition-all";
  const activeClass = "bg-slate-100 text-slate-900 border-slate-300 shadow-sm";

  return (
    <div className="fixed top-6 left-6 flex flex-col gap-4 z-50 no-print">
        {/* Connection Styles */}
        <div className="bg-white p-2 rounded-md shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] border-2 border-slate-200 flex flex-col gap-1">
            <span className="text-xs font-bold text-slate-400 px-2 uppercase tracking-wider mb-1">Line</span>
            {styles.map(s => (
                <button
                    key={s.id}
                    onClick={() => setConnectionStyle(s.id)}
                    className={`${btnClass} ${connectionStyle === s.id ? activeClass : ''}`}
                    title={s.label}
                >
                    <s.icon size={20} />
                </button>
            ))}
        </div>

        {/* Export Tools */}
        <div className="bg-white p-2 rounded-md shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] border-2 border-slate-200 flex flex-col gap-1">
             <span className="text-xs font-bold text-slate-400 px-2 uppercase tracking-wider mb-1">Export</span>
             <button onClick={onExportMermaid} className={btnClass} title="Export as Mermaid Diagram">
                <FileCode size={20} />
             </button>
             <button onClick={onExportPDF} className={btnClass} title="Export as PDF">
                <FileDown size={20} />
             </button>
        </div>
    </div>
  );
};
