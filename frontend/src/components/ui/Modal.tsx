import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  accent?: 'default' | 'comments';
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, accent = 'default', children }) => {
  const isCommentsAccent = accent === 'comments';

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEsc);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  return ReactDOM.createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-lg"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div 
            className="relative bg-gradient-to-br from-white to-indigo-50/30 dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900/50 text-slate-900 dark:text-slate-100 rounded-3xl shadow-2xl shadow-indigo-500/10 dark:shadow-indigo-900/20 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-indigo-200/50 dark:border-indigo-500/20"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {title && (
              <div className={`px-6 py-4 border-b flex justify-between items-center ${isCommentsAccent ? 'border-indigo-200/60 dark:border-indigo-500/30 bg-gradient-to-r from-white via-indigo-50/60 to-violet-50/50 dark:from-slate-800 dark:via-indigo-900/20 dark:to-slate-800/90' : 'border-indigo-200/50 dark:border-indigo-500/20 bg-gradient-to-r from-white to-indigo-50/50 dark:from-slate-800 dark:to-slate-800/80'}`}>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h3>
                <motion.button 
                  onClick={onClose}
                  className="p-2 text-slate-700 dark:text-slate-200 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/30 hover:ring-2 hover:ring-indigo-400/50 dark:hover:ring-indigo-500/50 rounded-lg transition-all"
                  aria-label="Close modal"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X size={24} aria-hidden="true" />
                </motion.button>
              </div>
            )}
            {title && isCommentsAccent && (
              <motion.div
                className="h-1 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500"
                initial={{ opacity: 0.5, scaleX: 0.96 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              />
            )}
            <motion.div 
                className="p-6 overflow-y-auto text-slate-600 dark:text-slate-200"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
            >
              {children}
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};