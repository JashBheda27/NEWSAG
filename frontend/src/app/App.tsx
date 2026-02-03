import React, { useEffect } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { AppRouter } from './router';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { Footer } from '../components/layout/Footer';
import { Toast } from '../components/ui/Toast';
import { FeedbackFAB } from '../components/ui/FeedbackFAB';
import { useTheme } from '../hooks/useTheme';
import { useNotification } from '../hooks/useNotification';
import { setAuthToken } from '../services/api';

const AppLayout: React.FC<{ showNotification: (msg: string, type?: 'error' | 'success') => void }> = ({ showNotification }) => {
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const isAuthPage = location.pathname === '/login';
  const { isLoaded, isSignedIn, getToken } = useAuth();

  useEffect(() => {
    const syncToken = async () => {
      if (!isLoaded) return;
      if (!isSignedIn) {
        setAuthToken(null);
        return;
      }

      const token = await getToken();
      setAuthToken(token || null);
    };

    syncToken();
  }, [getToken, isLoaded, isSignedIn]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <Navbar 
        onThemeToggle={toggleTheme}
        isDark={isDark}
      />

      {!isAuthPage && <Sidebar />}

      <main className={`flex-grow overflow-x-hidden ${isAuthPage ? '' : 'lg:pl-24'}`}>
        <AppRouter showNotification={showNotification} />
      </main>

      <Footer />
      
      <FeedbackFAB 
        onSuccess={(msg) => showNotification(msg, 'success')}
        onError={(msg) => showNotification(msg, 'error')}
      />
    </div>
  );
};

const AppContent: React.FC<{ showNotification: (msg: string, type?: 'error' | 'success') => void }> = ({ showNotification }) => {
  return (
    <BrowserRouter>
      <AppLayout showNotification={showNotification} />
    </BrowserRouter>
  );
};

const App: React.FC = () => {
  const { notification, showNotification, hideNotification } = useNotification();

  return (
    <>
      {/* Toast Notification */}
      {notification && (
        <Toast 
          message={notification.message}
          type={notification.type}
          onClose={hideNotification}
        />
      )}

      <AppContent showNotification={showNotification} />
    </>
  );
};


export default App;