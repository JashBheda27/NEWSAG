import React from 'react';
import { Skeleton } from '../Skeleton';

export const CategorySkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm">
          <Skeleton variant="shimmer" className="h-40 w-full rounded-none" />
          <div className="p-5 space-y-3">
            <Skeleton variant="shimmer" className="h-5 w-full" />
            <Skeleton variant="shimmer" className="h-5 w-3/5" />
            <Skeleton variant="shimmer" className="h-4 w-[35%]" />
          </div>
        </div>
      ))}
    </div>
  );
};
