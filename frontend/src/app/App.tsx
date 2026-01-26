import React, { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './router';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { newsService } from '../services/news.service';

const App: React.FC = () => {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('newsaura-theme');
      if (savedTheme) return savedTheme === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const [notification, setNotification] = useState<{message: string, type: 'error' | 'success'} | null>(null);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('newsaura-theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('newsaura-theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message: string, type: 'error' | 'success' = 'error') => {
    setNotification({ message, type });
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">
        {/* Toast Notification */}
        {notification && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in border ${
            notification.type === 'error' 
              ? 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/40 dark:text-rose-400 dark:border-rose-800' 
              : 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800'
          }`}>
            <div className={`w-2 h-2 rounded-full ${notification.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
            <p className="font-bold text-sm">{notification.message}</p>
            <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-70">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <Navbar 
          onThemeToggle={() => setIsDark(!isDark)}
          isDark={isDark}
        />

        <main className="flex-grow">
          <AppRouter showNotification={showNotification} />
        </main>

        <Footer />
        
        {/* Feedback FAB */}
        <button 
          aria-label="Give feedback"
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 group"
          onClick={() => {
              const feedback = prompt("How can we improve NewsAura?");
              if (feedback) {
                newsService.submitFeedback(feedback)
                  .then(() => showNotification("Thanks for your feedback!", "success"))
                  .catch((err) => showNotification(err.message, "error"));
              }
          }}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
        </button>
      </div>
    </BrowserRouter>
  );
};

export default App;