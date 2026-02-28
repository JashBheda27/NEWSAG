import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchBar } from '../ui/SearchBar';

interface NavbarProps {
  onThemeToggle: () => void;
  isDark: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onThemeToggle, isDark }) => {
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <nav className="sticky top-0 z-50 bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl border-b border-gray-200 dark:border-slate-700/50 px-4 md:px-8 py-4 transition-all duration-300 shadow-sm">
      <div className="w-full flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group flex-shrink-0">
          <motion.div 
            className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30 group-hover:shadow-xl group-hover:shadow-indigo-600/40"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <span className="text-white font-black text-xl">NA</span>
          </motion.div>
          <h1 className="text-xl font-bold tracking-tight hidden lg:block bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            NewsAura
          </h1>
        </Link>

        {/* Center - Search & Nav */}
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <SearchBar />

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            <motion.div whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 400 }}>
              <Link
                to="/"
                className="px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-all whitespace-nowrap"
              >
                Home
              </Link>
            </motion.div>
            <motion.div whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 400 }}>
              <Link
                to="/bookmarks"
                className="px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-all whitespace-nowrap"
              >
                Bookmarks
              </Link>
            </motion.div>
            <motion.div whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 400 }}>
              <Link
                to="/read-later"
                className="px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-all whitespace-nowrap"
              >
                Read Later
              </Link>
            </motion.div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          {/* Mobile Menu Toggle */}
          <motion.button
            onClick={() => setMobileMenuOpen(prev => !prev)}
            aria-expanded={mobileMenuOpen}
            className="md:hidden p-2.5 rounded-2xl bg-gray-100 dark:bg-slate-700/50 hover:bg-gray-200 dark:hover:bg-slate-600/50 transition-all"
            aria-label="Toggle menu"
            whileTap={{ scale: 0.9 }}
          >
            <motion.svg 
              className="w-5 h-5 text-gray-700 dark:text-slate-200" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
              animate={{ rotate: mobileMenuOpen ? 90 : 0 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </motion.svg>
          </motion.button>

          <motion.button 
            onClick={onThemeToggle}
            className="p-2.5 rounded-2xl bg-gray-100 dark:bg-slate-700/50 hover:bg-gray-200 dark:hover:bg-slate-600/50 transition-all"
            aria-label="Toggle theme"
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
          >
            {isDark ? (
              <motion.svg 
                className="w-5 h-5 text-amber-400" 
                fill="currentColor" 
                viewBox="0 0 20 20"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.6 }}
              >
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </motion.svg>
            ) : (
              <motion.svg 
                className="w-5 h-5 text-gray-700" 
                fill="currentColor" 
                viewBox="0 0 20 20"
                animate={{ rotate: -360 }}
                transition={{ duration: 0.6 }}
              >
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </motion.svg>
            )}
          </motion.button>
          
          {isSignedIn ? (
            <div className="flex items-center gap-2">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link to="/profile" className="flex items-center gap-2 group p-0.5 pr-3 rounded-full bg-slate-200/50 dark:bg-slate-700/50 hover:bg-slate-300/50 dark:hover:bg-slate-600/50 transition-all">
                  <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-indigo-600 shadow-md">
                    <img src={user?.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'user'}`} alt="User" />
                  </div>
                  <span className="text-xs font-black hidden sm:inline">{user?.username || 'Profile'}</span>
                </Link>
              </motion.div>
              <motion.button
                onClick={handleLogout}
                className="px-3 py-2 rounded-xl text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all whitespace-nowrap"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Logout
              </motion.button>
            </div>
          ) : (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link to="/login" className="px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:shadow-lg hover:shadow-indigo-600/40 transition-all">
                Login
              </Link>
            </motion.div>
          )}
        </div>

        {/* Mobile menu panel */}
        <AnimatePresence>
          {typeof window !== 'undefined' && mobileMenuOpen && (
            <MobileMenuPanel setMobileMenuOpen={setMobileMenuOpen} />
          )}
        </AnimatePresence>

      </div>
    </nav>
  );

  // Local small component to avoid cluttering main markup
  function MobileMenuPanel({ setMobileMenuOpen } : { setMobileMenuOpen: (v:boolean) => void }) {
    return (
      <motion.div 
        className="md:hidden absolute top-full right-4 mt-2 w-44 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 p-2 z-50"
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <motion.div whileHover={{ x: 4 }} transition={{ type: "spring", stiffness: 400 }}>
          <Link to="/" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Home</Link>
        </motion.div>
        <motion.div whileHover={{ x: 4 }} transition={{ type: "spring", stiffness: 400 }}>
          <Link to="/bookmarks" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Bookmarks</Link>
        </motion.div>
        <motion.div whileHover={{ x: 4 }} transition={{ type: "spring", stiffness: 400 }}>
          <Link to="/read-later" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Read Later</Link>
        </motion.div>
      </motion.div>
    );
  }
};