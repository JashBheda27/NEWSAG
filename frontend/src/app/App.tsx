import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './router';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { Footer } from '../components/layout/Footer';
import { Toast } from '../components/ui/Toast';
import { FeedbackFAB } from '../components/ui/FeedbackFAB';
import { useTheme } from '../hooks/useTheme';
import { useNotification } from '../hooks/useNotification';

const App: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  const { notification, showNotification, hideNotification } = useNotification();

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">
        {/* Toast Notification */}
        {notification && (
          <Toast 
            message={notification.message}
            type={notification.type}
            onClose={hideNotification}
          />
        )}

        <Navbar 
          onThemeToggle={toggleTheme}
          isDark={isDark}
        />

        <Sidebar />

        <main className="flex-grow">
          <AppRouter showNotification={showNotification} />
        </main>

        <Footer />
        
        {/* Feedback FAB */}
        <FeedbackFAB 
          onSuccess={(msg) => showNotification(msg, 'success')}
          onError={(msg) => showNotification(msg, 'error')}
        />
      </div>
    </BrowserRouter>
  );
};

export default App;