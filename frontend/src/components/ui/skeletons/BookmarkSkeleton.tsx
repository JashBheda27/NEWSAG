import React from 'react';
import { Skeleton } from '../Skeleton';

interface BookmarkSkeletonProps {
  rows?: number;
  variant?: 'bookmarks' | 'readLater';
}

export const BookmarkSkeleton: React.FC<BookmarkSkeletonProps> = ({
  rows = 5,
  variant = 'bookmarks',
}) => {
  return (
    <div className="space-y-4">
      {[...Array(rows)].map((_, i) => {
        if (variant === 'readLater') {
          return (
            <div
              key={i}
              className="bg-white dark:bg-slate-800 p-6 rounded-3xl flex items-center justify-between gap-4 border border-slate-100 dark:border-slate-700"
            >
              <div className="flex-1 space-y-3">
                <Skeleton variant="shimmer" className="h-6 w-[78%]" />
                <Skeleton variant="shimmer" className="h-4 w-32" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Skeleton variant="shimmer" className="h-8 w-14 rounded-lg" />
                <Skeleton variant="shimmer" className="w-9 h-9 rounded-full" />
              </div>
            </div>
          );
        }

        return (
          <div
            key={i}
            className="bg-white dark:bg-slate-800 p-4 rounded-3xl flex gap-4 border border-slate-100 dark:border-slate-700"
          >
            <Skeleton variant="shimmer" className="w-24 h-24 rounded-2xl flex-shrink-0" />
            <div className="flex-1 space-y-3 pt-2">
              <Skeleton variant="shimmer" className="h-6 w-full" />
              <Skeleton variant="shimmer" className="h-4 w-2/3" />
              <div className="flex gap-2 pt-1">
                <Skeleton variant="shimmer" className="h-8 w-16 rounded-lg" />
                <Skeleton variant="shimmer" className="h-8 w-20 rounded-lg" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
