import React from 'react';
import { MousePointer2, Spline, Activity, Minus, FileCode, FileDown, AlignVerticalJustifyCenter, AlignHorizontalJustifyCenter, PlusCircle, AlertOctagon, HelpCircle, Triangle } from 'lucide-react';
import { ConnectionStyle, NoteType } from '../types';

interface SidebarProps {
    connectionStyle: ConnectionStyle;
    setConnectionStyle: (style: ConnectionStyle) => void;
    onExportMermaid: () => void;
    onExportPDF: () => void;
    onAutoLayout: (direction: 'horizontal' | 'vertical') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
    connectionStyle, 
    setConnectionStyle, 
    onExportMermaid, 
    onExportPDF,
    onAutoLayout
}) => {
  const styles: { id: ConnectionStyle; icon: any; label: string }[] = [
      { id: 'straight', icon: Minus, label: 'Straight' },
      { id: 'curve', icon: Spline, label: 'Curve' },
      { id: 'step', icon: Activity, label: 'Step' },
  ];

  const btnClass = "p-2 rounded border border-transparent hover:bg-slate-100 text-slate-600 transition-all flex justify-center items-center cursor-grab active:cursor-grabbing";
  const activeClass = "bg-slate-100 text-slate-900 border-slate-300 shadow-sm";
  const sectionClass = "bg-white p-2 rounded-md shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] border-2 border-slate-200 flex flex-col gap-1";
  const labelClass = "text-[10px] font-bold text-slate-400 px-1 uppercase tracking-wider mb-0.5 text-center";

  const handleDragStart = (e: React.DragEvent, type: NoteType, label: string) => {
      e.dataTransfer.setData('noteType', type);
      e.dataTransfer.setData('label', label);
      e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="fixed top-6 left-6 flex flex-col gap-4 z-50 no-print select-none w-14">
        {/* Logic Gates (Draggable) */}
        <div className={sectionClass}>
            <span className={labelClass}>Logic</span>
            <div 
                draggable 
                onDragStart={(e) => handleDragStart(e, 'logic_and', 'AND')} 
                className={btnClass} 
                title="Drag to add AND Gate"
            >
                <PlusCircle size={20} className="text-blue-500" />
            </div>
            <div 
                draggable 
                onDragStart={(e) => handleDragStart(e, 'logic_or', 'OR')} 
                className={btnClass} 
                title="Drag to add OR Gate"
            >
                <HelpCircle size={20} className="text-orange-500" />
            </div>
            <div 
                draggable 
                onDragStart={(e) => handleDragStart(e, 'logic_not', 'NOT')} 
                className={btnClass} 
                title="Drag to add NOT Gate"
            >
                <AlertOctagon size={20} className="text-red-500" />
            </div>
             <div 
                draggable 
                onDragStart={(e) => handleDragStart(e, 'logic_decision', '?')} 
                className={btnClass} 
                title="Drag to add Decision Node"
            >
                <Triangle size={20} className="text-purple-500 rotate-180" />
            </div>
        </div>

        {/* Auto Layout */}
        <div className={sectionClass}>
            <span className={labelClass}>Align</span>
            <button onClick={() => onAutoLayout('vertical')} className={btnClass} title="Vertical Tree Layout">
                <AlignVerticalJustifyCenter size={20} />
            </button>
            <button onClick={() => onAutoLayout('horizontal')} className={btnClass} title="Horizontal Flow Layout">
                <AlignHorizontalJustifyCenter size={20} />
            </button>
        </div>

        {/* Connection Styles */}
        <div className={sectionClass}>
            <span className={labelClass}>Line</span>
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
        <div className={sectionClass}>
             <span className={labelClass}>Save</span>
             <button onClick={onExportMermaid} className={btnClass} title="Export Mermaid">
                <FileCode size={20} />
             </button>
             <button onClick={onExportPDF} className={btnClass} title="Export PDF">
                <FileDown size={20} />
             </button>
        </div>
    </div>
  );
};