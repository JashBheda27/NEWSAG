import React from 'react';
import type { Article } from '../../types';
import { NewsCard } from './NewsCard';
import { NewsSkeleton } from './NewsSkeleton';

interface NewsGridProps {
  articles: Article[];
  isLoading: boolean;
  viewType?: 'grid' | 'list';
  onError: (msg: string) => void;
}

export const NewsGrid: React.FC<NewsGridProps> = ({ articles, isLoading, viewType = 'grid', onError }) => {
  if (isLoading) {
    return (
      <div className={viewType === 'grid' 
        ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 animate-fade-in"
        : "space-y-4 animate-fade-in"
      }>
        {[...Array(8)].map((_, i) => (
          <NewsSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="text-center py-20 animate-fade-in">
        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
        </div>
        <p className="text-slate-400 text-lg font-medium">No articles found in this feed.</p>
      </div>
    );
  }

  return (
    <div className={viewType === 'grid'
      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 animate-fade-in"
      : "space-y-4 animate-fade-in"
    }>
      {articles.map((article) => (
        <NewsCard 
          key={article.id || article.url} 
          article={article}
          viewType={viewType}
          onError={onError}
        />
      ))}
    </div>
  );
};