import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface NavbarProps {
  onThemeToggle: () => void;
  isDark: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onThemeToggle, isDark }) => {
  const location = useLocation();
  
  const navLinks = [
    { path: '/', label: 'Feed' },
    { path: '/bookmarks', label: 'Saved' },
    { path: '/read-later', label: 'Queue' },
  ];

  return (
    <nav className="sticky top-0 z-50 glass border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 py-4 transition-all duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30 group-hover:scale-110 transition-transform duration-300">
            <span className="text-white font-black text-xl">A</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight hidden sm:block bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-emerald-500">
            NewsAura
          </h1>
        </Link>

        {/* Links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(link => (
            <Link 
              key={link.path}
              to={link.path}
              className={`text-sm font-black transition-colors ${location.pathname === link.path ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button 
            onClick={onThemeToggle}
            className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-90"
            aria-label="Toggle theme"
          >
            {isDark ? (
              <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>
          
          <Link to="/profile" className="flex items-center gap-2 group p-0.5 pr-3 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
            <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-indigo-600">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alex" alt="User" />
            </div>
            <span className="text-xs font-black hidden sm:inline">Profile</span>
          </Link>
        </div>
      </div>
    </nav>
  );
};