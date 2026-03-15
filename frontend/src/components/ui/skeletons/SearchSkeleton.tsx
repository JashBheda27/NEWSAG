import React from 'react';
import { Skeleton } from '../Skeleton';

export const SearchSkeleton: React.FC = () => {
  return (
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-800/90 rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-700/50 shadow-sm flex gap-4 p-4"
        >
          <Skeleton variant="shimmer" className="w-20 h-20 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-3 pt-1">
            <Skeleton variant="shimmer" className="h-5 w-full" />
            <Skeleton variant="shimmer" className="h-5 w-3/5" />
            <Skeleton variant="shimmer" className="h-4 w-[35%]" />
          </div>
        </div>
      ))}
    </div>
  );
};
