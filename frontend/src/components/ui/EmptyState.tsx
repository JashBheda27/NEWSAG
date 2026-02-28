import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  icon?: string | React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
  illustration?: 'bookmarks' | 'readlater' | 'search' | 'generic';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
  illustration = 'generic',
}) => {
  const illustrations = {
    bookmarks: '🔖',
    readlater: '📌',
    search: '🔍',
    generic: '📭',
  };

  const icon = illustrations[illustration];

  return (
    <motion.div 
      className="w-full max-w-md mx-auto text-center py-12 px-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div 
        className="text-6xl mb-4 inline-block"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        {icon}
      </motion.div>
      
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {title}
      </h2>
      
      <p className="text-gray-700 dark:text-slate-400 mb-6">
        {description}
      </p>
      
      {action && (
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Link 
            to={action.href}
            className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-indigo-600/40 transition-all"
          >
            {action.label}
            <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </motion.div>
      )}
    </motion.div>
  );
};
