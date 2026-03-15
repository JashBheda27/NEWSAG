import React from 'react';
import { motion } from 'framer-motion';

interface NewsSkeletonProps {
  viewType?: 'grid' | 'list';
}

export const NewsSkeleton: React.FC<NewsSkeletonProps> = ({ viewType = 'grid' }) => {
  const shimmer = {
    initial: { backgroundPosition: '-200% 0' },
    animate: { backgroundPosition: '200% 0' },
  };

  const shimmerClassName = 'bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700';

  if (viewType === 'list') {
    return (
      <motion.div
        className="bg-white dark:bg-slate-800/90 rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-700/50 shadow-sm flex flex-col sm:flex-row"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      >
        <motion.div
          className={`w-full sm:w-52 h-48 sm:h-44 ${shimmerClassName}`}
          style={{ backgroundSize: '200% 100%' }}
          {...shimmer}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
        />
        <div className="p-5 flex-1 space-y-3">
          <motion.div
            className={`h-5 w-full rounded ${shimmerClassName}`}
            style={{ backgroundSize: '200% 100%' }}
            {...shimmer}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'linear', delay: 0.08 }}
          />
          <motion.div
            className={`h-5 w-3/5 rounded ${shimmerClassName}`}
            style={{ backgroundSize: '200% 100%' }}
            {...shimmer}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'linear', delay: 0.16 }}
          />
          <motion.div
            className={`h-4 w-[35%] rounded ${shimmerClassName}`}
            style={{ backgroundSize: '200% 100%' }}
            {...shimmer}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'linear', delay: 0.24 }}
          />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div 
        className={`h-40 ${shimmerClassName}`}
        style={{ backgroundSize: '200% 100%' }}
        {...shimmer}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
      />
      <div className="p-5 space-y-3">
        <motion.div 
          className={`h-5 w-full rounded ${shimmerClassName}`}
          style={{ backgroundSize: '200% 100%' }}
          {...shimmer}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear', delay: 0.08 }}
        />
        <motion.div 
          className={`h-5 w-3/5 rounded ${shimmerClassName}`}
          style={{ backgroundSize: '200% 100%' }}
          {...shimmer}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear', delay: 0.16 }}
        />
        <motion.div 
          className={`h-4 w-[35%] rounded ${shimmerClassName}`}
          style={{ backgroundSize: '200% 100%' }}
          {...shimmer}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear', delay: 0.24 }}
        />
      </div>
    </motion.div>
  );
};