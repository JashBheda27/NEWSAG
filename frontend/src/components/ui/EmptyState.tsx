import React from 'react';
import { BookmarkX, ChevronRight, Inbox, SearchX } from 'lucide-react';
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
  const illustrations: Record<NonNullable<EmptyStateProps['illustration']>, React.ReactNode> = {
    bookmarks: <BookmarkX size={56} aria-hidden="true" />,
    readlater: <Inbox size={56} aria-hidden="true" />,
    search: <SearchX size={56} aria-hidden="true" />,
    generic: <Inbox size={56} aria-hidden="true" />,
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
        className="mb-4 inline-flex text-slate-400 dark:text-slate-500"
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
            <ChevronRight size={16} className="ml-2" aria-hidden="true" />
          </Link>
        </motion.div>
      )}
    </motion.div>
  );
};
