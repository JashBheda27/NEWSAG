import React, { useEffect } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { AppRouter } from './router';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { Footer } from '../components/layout/Footer';
import { Toast } from '../components/ui/Toast';
import { ChatBot } from '../components/ui/ChatBot';
import { ScrollToTop } from '../components/ui/ScrollToTop';
import { useTheme } from '../hooks/useTheme';
import { useNotification } from '../hooks/useNotification';
import { setAuthToken, setAuthTokenProvider } from '../services/api';

const AppLayout: React.FC<{ showNotification: (msg: string, type?: 'error' | 'success') => void }> = ({ showNotification }) => {
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const isAuthPage = location.pathname === '/login';
  const isAdminPage = location.pathname.startsWith('/admin');
  const { isLoaded, isSignedIn, getToken } = useAuth();

  useEffect(() => {
    const syncToken = async () => {
      if (!isLoaded) return;
      if (!isSignedIn) {
        setAuthToken(null);
        setAuthTokenProvider(null);
        return;
      }

      setAuthTokenProvider(async () => {
        const token = await getToken();
        return token || null;
      });

      const token = await getToken();
      setAuthToken(token || null);
    };

    syncToken();
  }, [getToken, isLoaded, isSignedIn]);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors duration-200">
      {!isAdminPage && (
        <Navbar 
          onThemeToggle={toggleTheme}
          isDark={isDark}
        />
      )}

      {!isAuthPage && !isAdminPage && <Sidebar />}

      <main className={`flex-grow overflow-x-hidden ${isAuthPage || isAdminPage ? '' : 'lg:pl-28 max-sm:pb-24'}`}>
        <AppRouter showNotification={showNotification} />
      </main>

      {!isAdminPage && <Footer />}
      
      {/* Scroll to top button */}
      <ScrollToTop />
      
      {!isAdminPage && (
        <ChatBot 
          onError={(msg) => showNotification(msg, 'error')}
        />
      )}
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