import React from 'react';

export const NewsSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 animate-pulse">
      <div className="h-48 bg-slate-200 dark:bg-slate-700"></div>
      <div className="p-5 space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
        <div className="space-y-2">
          <div className="h-6 w-full bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
        <div className="pt-4 border-t border-slate-50 dark:border-slate-700 flex justify-between items-center">
          <div className="flex gap-2">
            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
          </div>
          <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
        </div>
      </div>
    </div>
  );
};