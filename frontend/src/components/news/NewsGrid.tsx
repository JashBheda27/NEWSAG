import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Article } from '../../types';
import { NewsCard } from './NewsCard';
import { NewsSkeleton } from './NewsSkeleton';
import { EmptyState } from '../ui/EmptyState';

interface NewsGridProps {
  articles: Article[];
  isLoading: boolean;
  viewType?: 'grid' | 'list';
  onError: (msg: string) => void;
}

// Memoized component to prevent unnecessary re-renders
export const NewsGrid: React.FC<NewsGridProps> = React.memo(({ articles, isLoading, viewType = 'grid', onError }) => {
  // Memoize the grid className
  const gridClassName = useMemo(() => 
    viewType === 'grid' 
      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      : "space-y-4"
  , [viewType]);

  if (isLoading) {
    return (
      <motion.div 
        className={gridClassName}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
          >
            <NewsSkeleton />
          </motion.div>
        ))}
      </motion.div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="flex justify-center">
        <EmptyState
          title="No Articles Found"
          description="Explore different categories or try a new search to discover great reads."
          action={{ label: 'Browse Categories', href: '/' }}
          illustration="search"
        />
      </div>
    );
  }

  return (
    <motion.div 
      className={gridClassName}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {articles.map((article, idx) => (
        <motion.div
          key={article.id || article.url}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            delay: Math.min(idx * 0.05, 0.3),
            duration: 0.4,
            type: "spring",
            stiffness: 300,
            damping: 30
          }}
        >
          <NewsCard 
            article={article}
            viewType={viewType}
            onError={onError}
          />
        </motion.div>
      ))}
    </motion.div>
  );
});

NewsGrid.displayName = 'NewsGrid';