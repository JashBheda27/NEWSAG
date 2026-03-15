import React from 'react';
import { Skeleton } from '../Skeleton';

interface FeedSkeletonProps {
  showProgress?: boolean;
  progress?: number;
  activeStep?: number;
}

const FEED_STEPS = ['Model loaded', 'Sources indexed', 'Summarising', 'Ranking', 'Ready'];

export const FeedSkeleton: React.FC<FeedSkeletonProps> = ({
  showProgress = false,
  progress = 0,
  activeStep = 0,
}) => {
  return (
    <div className="space-y-5">
      {showProgress && (
        <div className="space-y-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#534AB7]/15 dark:bg-[#7E75D4]/20">
            <div
              className="h-full rounded-full bg-[#534AB7] transition-[width] duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FEED_STEPS.map((step, index) => {
              const isCompleted = index < activeStep;
              const isActive = index === activeStep;

              return (
                <span
                  key={step}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors duration-150 ${
                    isActive
                      ? 'bg-[#534AB7] text-white'
                      : isCompleted
                        ? 'bg-[#534AB7]/15 text-[#534AB7] dark:bg-[#7E75D4]/25 dark:text-[#B8B2EE]'
                        : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {step}
                </span>
              );
            })}
          </div>
        </div>
      )}

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
    </div>
  );
};
