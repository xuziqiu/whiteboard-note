import React from 'react';
import { Layout, Plus, Search, Settings, FileText, Database, Share2 } from 'lucide-react';

export const Sidebar: React.FC = () => {
  return (
    <div className="w-16 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col items-center py-4 gap-6 z-50 shadow-sm">
      <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-indigo-200 shadow-lg">
        <Layout size={20} />
      </div>

      <div className="flex flex-col gap-4 w-full items-center">
        <button className="w-10 h-10 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-colors tooltip-group relative group">
          <Plus size={20} />
          <span className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">New Board</span>
        </button>
        <button className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center relative">
          <FileText size={20} />
          <div className="absolute top-2 right-2 w-2 h-2 bg-indigo-600 rounded-full border-2 border-white"></div>
        </button>
        <button className="w-10 h-10 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-colors">
          <Search size={20} />
        </button>
        <button className="w-10 h-10 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-colors">
          <Database size={20} />
        </button>
      </div>

      <div className="mt-auto flex flex-col gap-4">
        <button className="w-10 h-10 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
            <Share2 size={20} />
        </button>
        <button className="w-10 h-10 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
            <Settings size={20} />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-400 to-indigo-500 mt-2"></div>
      </div>
    </div>
  );
};
