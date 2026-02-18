import React from 'react';
import { motion } from 'framer-motion';

export const NewsSkeleton: React.FC = () => {
  const shimmer = {
    initial: { backgroundPosition: '200% 0' },
    animate: { backgroundPosition: '-200% 0' },
  };

  return (
    <motion.div 
      className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div 
        className="h-56 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700"
        style={{ backgroundSize: '200% 100%' }}
        {...shimmer}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <div className="p-5 space-y-4">
        <div className="flex justify-between items-center">
          <motion.div 
            className="h-4 w-20 bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-600 rounded"
            style={{ backgroundSize: '200% 100%' }}
            {...shimmer}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.div 
            className="h-4 w-24 bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-600 rounded"
            style={{ backgroundSize: '200% 100%' }}
            {...shimmer}
            transition={{ duration: 2, repeat: Infinity, delay: 0.1 }}
          />
        </div>
        <div className="space-y-2">
          <motion.div 
            className="h-6 w-full bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-600 rounded"
            style={{ backgroundSize: '200% 100%' }}
            {...shimmer}
            transition={{ duration: 2, repeat: Infinity, delay: 0.2 }}
          />
          <motion.div 
            className="h-6 w-3/4 bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-600 rounded"
            style={{ backgroundSize: '200% 100%' }}
            {...shimmer}
            transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
          />
        </div>
        <div className="space-y-2">
          <motion.div 
            className="h-4 w-full bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-600 rounded"
            style={{ backgroundSize: '200% 100%' }}
            {...shimmer}
            transition={{ duration: 2, repeat: Infinity, delay: 0.4 }}
          />
          <motion.div 
            className="h-4 w-full bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-600 rounded"
            style={{ backgroundSize: '200% 100%' }}
            {...shimmer}
            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
          />
          <motion.div 
            className="h-4 w-2/3 bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-600 rounded"
            style={{ backgroundSize: '200% 100%' }}
            {...shimmer}
            transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
          />
        </div>
        <div className="pt-4 border-t border-slate-50 dark:border-slate-700 flex justify-between items-center">
          <div className="flex gap-2">
            <motion.div 
              className="w-8 h-8 bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-600 rounded-full"
              style={{ backgroundSize: '200% 100%' }}
              {...shimmer}
              transition={{ duration: 2, repeat: Infinity, delay: 0.7 }}
            />
            <motion.div 
              className="w-8 h-8 bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-600 rounded-full"
              style={{ backgroundSize: '200% 100%' }}
              {...shimmer}
              transition={{ duration: 2, repeat: Infinity, delay: 0.8 }}
            />
          </div>
          <motion.div 
            className="h-8 w-24 bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-600 rounded-lg"
            style={{ backgroundSize: '200% 100%' }}
            {...shimmer}
            transition={{ duration: 2, repeat: Infinity, delay: 0.9 }}
          />
        </div>
      </div>
    </motion.div>
  );
};