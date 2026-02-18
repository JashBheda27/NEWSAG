import React, { useMemo, useCallback } from 'react';
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

// Optimized loading skeleton
const LoadingSkeleton = React.memo<{ viewType: string }>(({ viewType }) => {
  const gridClassName = viewType === 'grid' 
    ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8"
    : "flex flex-col gap-6";
    
  return (
    <div className={`${gridClassName} animate-fade-in`}>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
          <NewsSkeleton />
        </div>
      ))}
    </div>
  );
});

LoadingSkeleton.displayName = 'LoadingSkeleton';

// Memoized component to prevent unnecessary re-renders
export const NewsGrid: React.FC<NewsGridProps> = React.memo(({ articles, isLoading, viewType = 'grid', onError }) => {
  // Memoize the grid className with improved gap spacing
  const gridClassName = useMemo(() => 
    viewType === 'grid' 
      ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8"
      : "flex flex-col gap-6"
  , [viewType]);

  // Memoize error handler to prevent re-renders
  const handleError = useCallback((msg: string) => {
    onError(msg);
  }, [onError]);

  if (isLoading) {
    return <LoadingSkeleton viewType={viewType} />;
  }

  if (articles.length === 0) {
    return (
      <div className="flex justify-center py-12">
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
    <div className={`${gridClassName} page-transition`}>
      {articles.map((article, idx) => (
        <div
          key={article.id || article.url}
          className="animate-fade-in transform-gpu"
          style={{ animationDelay: `${Math.min(idx * 40, 300)}ms` }}
        >
          <NewsCard 
            article={article}
            viewType={viewType}
            onError={handleError}
          />
        </div>
      ))}
    </div>
  );
});

NewsGrid.displayName = 'NewsGrid';