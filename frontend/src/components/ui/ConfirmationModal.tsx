import React from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onCancel();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEsc);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onCancel]);

  return ReactDOM.createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onCancel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div 
            className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200/50 dark:border-slate-700/50"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className={`px-6 py-4 ${isDanger ? 'bg-rose-50 dark:bg-rose-900/10 border-b border-rose-200 dark:border-rose-800' : 'bg-blue-50 dark:bg-blue-900/10 border-b border-blue-200 dark:border-blue-800'}`}>
              <h3 className={`text-lg font-bold ${isDanger ? 'text-rose-900 dark:text-rose-400' : 'text-blue-900 dark:text-blue-400'}`}>
                {title}
              </h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-slate-700 dark:text-slate-300">{message}</p>
            </div>
            <div className="px-6 py-4 flex gap-3 justify-end border-t border-slate-200 dark:border-slate-700">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onCancel}
                disabled={isLoading}
              >
                {cancelText}
              </Button>
              <Button 
                variant={isDanger ? 'danger' : 'primary'} 
                size="sm" 
                onClick={onConfirm}
                isLoading={isLoading}
                disabled={isLoading}
              >
                {confirmText}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
