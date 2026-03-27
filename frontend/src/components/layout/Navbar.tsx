import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import { Clock3, Search, User } from 'lucide-react';
import { SearchBar } from '../ui/SearchBar';
import { Skeleton } from '../ui/Skeleton';
import { GlassDropdown } from '../ui/GlassDropdown';

interface NavbarProps {
  onThemeToggle: () => void;
  isDark: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onThemeToggle, isDark }) => {
  const { isSignedIn, signOut } = useAuth();
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showCompactMenu, setShowCompactMenu] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const profileFirstName = user?.firstName || user?.username || 'Profile';
  const isProfilePage = location.pathname === '/profile';

  useEffect(() => {
    let ticking = false;

    const updateScrollState = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      setIsScrolled(scrollTop > 16);
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollState);
        ticking = true;
      }
    };

    updateScrollState();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 px-4 md:px-8 py-4 transition-colors duration-[80ms] ${
        isScrolled
          ? 'bg-white/78 dark:bg-slate-900/62 backdrop-blur-xl border-b border-gray-200/90 dark:border-slate-700/55 shadow-lg shadow-slate-200/40 dark:shadow-slate-950/30'
          : 'bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700/50 shadow-sm'
      }`}
    >
      <div className="w-full flex items-center justify-between gap-3 sm:gap-4">
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
          <div className="hidden sm:block flex-1 min-w-0">
            <SearchBar />
          </div>

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
                className="px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-all whitespace-nowrap inline-flex items-center gap-2"
              >
                <Clock3 size={16} aria-hidden="true" className="hidden lg:inline" />
                <span>Read Later</span>
              </Link>
            </motion.div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <motion.button
            onClick={() => setShowMobileSearch((prev) => !prev)}
            className="sm:hidden p-2.5 rounded-2xl bg-gray-100 dark:bg-slate-700/50 hover:bg-gray-200 dark:hover:bg-slate-600/50 transition-all"
            aria-label="Toggle search"
            whileTap={{ scale: 0.9 }}
          >
            <Search className="w-5 h-5 text-gray-700 dark:text-slate-200" aria-hidden="true" />
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
              >
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </motion.svg>
            ) : (
              <motion.svg 
                className="w-5 h-5 text-gray-700" 
                fill="currentColor" 
                viewBox="0 0 20 20"
              >
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </motion.svg>
            )}
          </motion.button>

          <GlassDropdown
            isOpen={showCompactMenu}
            onToggle={() => setShowCompactMenu((prev) => !prev)}
            onClose={() => setShowCompactMenu(false)}
            isSignedIn={!!isSignedIn}
            username={user?.username || 'Profile'}
            handle={user?.primaryEmailAddress?.emailAddress || `@${user?.username || 'newsaura'}`}
            onLogout={async () => {
              setShowCompactMenu(false);
              await handleLogout();
            }}
          />
          
          {!isLoaded ? (
            <div className="flex items-center gap-2 p-0.5 pr-3 rounded-full bg-slate-200/50 dark:bg-slate-700/50">
              <Skeleton variant="shimmer" className="w-8 h-8 rounded-full" />
              <Skeleton variant="shimmer" className="h-3 w-20 hidden sm:block" />
            </div>
          ) : isSignedIn ? (
            <>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link
                  to="/profile"
                  className="hidden md:inline-flex items-center gap-2 px-2.5 py-2 rounded-xl text-sm font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/35 transition-all whitespace-nowrap"
                >
                  <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 inline-flex items-center justify-center shadow-sm shadow-indigo-500/30">
                    <User size={15} className="text-white" aria-hidden="true" />
                  </span>
                  <span>{profileFirstName}</span>
                </Link>
              </motion.div>

              {!isProfilePage ? (
                <motion.button
                  onClick={handleLogout}
                  className="hidden lg:inline-flex px-3 py-2 rounded-xl text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all whitespace-nowrap"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Logout
                </motion.button>
              ) : null}
            </>
          ) : (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link to="/login" className="px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:shadow-lg hover:shadow-indigo-600/40 transition-all">
                Login
              </Link>
            </motion.div>
          )}
        </div>

      </div>

      {showMobileSearch && (
        <div className="sm:hidden mt-3">
          <SearchBar />
        </div>
      )}
    </nav>
  );
};