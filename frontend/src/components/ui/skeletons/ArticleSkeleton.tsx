import React from 'react';
import { Skeleton } from '../Skeleton';

export const ArticleSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-4">
        <Skeleton variant="shimmer" className="h-[280px] w-full rounded-2xl" />
        <div className="space-y-2">
          <Skeleton variant="shimmer" className="h-8 w-full" />
          <Skeleton variant="shimmer" className="h-8 w-[72%]" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton variant="shimmer" className="h-7 w-24 rounded-full" />
          <Skeleton variant="shimmer" className="h-7 w-28 rounded-full" />
          <Skeleton variant="shimmer" className="h-7 w-20 rounded-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-3">
          <Skeleton variant="shimmer" className="h-4 w-full" />
          <Skeleton variant="shimmer" className="h-4 w-[85%]" />
          <Skeleton variant="shimmer" className="h-4 w-[90%]" />
          <Skeleton variant="shimmer" className="h-4 w-full" />
          <Skeleton variant="shimmer" className="h-4 w-[85%]" />
          <Skeleton variant="shimmer" className="h-4 w-[90%]" />
          <Skeleton variant="shimmer" className="h-4 w-full" />
          <Skeleton variant="shimmer" className="h-4 w-[85%]" />
        </div>
        <div className="lg:col-span-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border border-slate-100 dark:border-slate-700 rounded-xl p-3 space-y-2">
              <Skeleton variant="shimmer" className="h-4 w-full" />
              <Skeleton variant="shimmer" className="h-4 w-[70%]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
