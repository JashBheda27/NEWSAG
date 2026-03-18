import React, { useMemo, useCallback, useEffect, useState } from 'react';
import type { Article } from '../../types';
import { NewsCard } from './NewsCard';
import { EmptyState } from '../ui/EmptyState';
import { FeedSkeleton } from '../ui/skeletons/FeedSkeleton';
import { CategorySkeleton } from '../ui/skeletons/CategorySkeleton';
import { SearchSkeleton } from '../ui/skeletons/SearchSkeleton';

interface NewsGridProps {
  articles: Article[];
  isLoading: boolean;
  viewType?: 'grid' | 'list';
  loadingVariant?: 'feed' | 'category' | 'search';
  showColdStartProgress?: boolean;
  coldStartProgress?: number;
  coldStartStep?: number;
  onError: (msg: string) => void;
}

// Optimized loading skeleton
const LoadingSkeleton = React.memo<{
  variant: 'feed' | 'category' | 'search';
  showColdStartProgress: boolean;
  coldStartProgress: number;
  coldStartStep: number;
}>(({ variant, showColdStartProgress, coldStartProgress, coldStartStep }) => {
  if (variant === 'search') {
    return <SearchSkeleton />;
  }

  if (variant === 'category') {
    return <CategorySkeleton />;
  }

  return (
    <FeedSkeleton
      showProgress={showColdStartProgress}
      progress={coldStartProgress}
      activeStep={coldStartStep}
    />
  );
});

LoadingSkeleton.displayName = 'LoadingSkeleton';

const ContentState = React.memo<{
  articles: Article[];
  viewType: 'grid' | 'list';
  gridClassName: string;
  timeTick: number;
  onError: (msg: string) => void;
}>(({ articles, viewType, gridClassName, timeTick, onError }) => {
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
            timeTick={timeTick}
            onError={onError}
          />
        </div>
      ))}
    </div>
  );
});

// Memoized component to prevent unnecessary re-renders
export const NewsGrid: React.FC<NewsGridProps> = React.memo(({
  articles,
  isLoading,
  viewType = 'grid',
  loadingVariant = 'feed',
  showColdStartProgress = false,
  coldStartProgress = 0,
  coldStartStep = 0,
  onError
}) => {
  const [showLoadingLayer, setShowLoadingLayer] = useState(isLoading);
  const [relativeTimeTick, setRelativeTimeTick] = useState(() => Date.now());

  // Memoize the grid className with improved gap spacing
  const gridClassName = useMemo(() => 
    viewType === 'grid' 
      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
      : "flex flex-col gap-6"
  , [viewType]);

  useEffect(() => {
    if (isLoading) {
      setShowLoadingLayer(true);
      return;
    }

    const fadeTimer = setTimeout(() => {
      setShowLoadingLayer(false);
    }, 280);

    return () => clearTimeout(fadeTimer);
  }, [isLoading]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRelativeTimeTick(Date.now());
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, []);

  // Memoize error handler to prevent re-renders
  const handleError = useCallback((msg: string) => {
    onError(msg);
  }, [onError]);

  if (isLoading || showLoadingLayer) {
    return (
      <div className="relative min-h-[240px]">
        <div
          className={`transition-opacity duration-300 ease-out ${isLoading ? 'opacity-100' : 'opacity-0'}`}
        >
          <LoadingSkeleton
            variant={loadingVariant}
            showColdStartProgress={showColdStartProgress}
            coldStartProgress={coldStartProgress}
            coldStartStep={coldStartStep}
          />
        </div>
        <div
          className={`absolute inset-0 transition-opacity duration-300 ease-out ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        >
          <ContentState
            articles={articles}
            viewType={viewType}
            gridClassName={gridClassName}
            timeTick={relativeTimeTick}
            onError={handleError}
          />
        </div>
      </div>
    );
  }

  return (
    <ContentState
      articles={articles}
      viewType={viewType}
      gridClassName={gridClassName}
      timeTick={relativeTimeTick}
      onError={handleError}
    />
  );
});

NewsGrid.displayName = 'NewsGrid';