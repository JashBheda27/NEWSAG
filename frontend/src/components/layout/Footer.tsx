import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 py-12 px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
               <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-black">A</div>
               <span className="font-bold text-slate-400">NewsAura &copy; 2024</span>
          </div>
          <div className="flex gap-8 text-sm font-bold text-slate-400">
              <Link to="/" className="hover:text-indigo-600 transition-colors">Home</Link>
              <Link to="/bookmarks" className="hover:text-indigo-600 transition-colors">Bookmarks</Link>
              <Link to="/read-later" className="hover:text-indigo-600 transition-colors">Read Later</Link>
              <a href="#" className="hover:text-indigo-600 transition-colors">Help Center</a>
          </div>
      </div>
    </footer>
  );
};
