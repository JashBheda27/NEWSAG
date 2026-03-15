import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'pulse' | 'shimmer';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = "", variant = 'pulse' }) => {
  const animationClassName = variant === 'shimmer' ? 'skeleton-shimmer' : 'animate-pulse';

  return (
    <div className={`bg-slate-200 dark:bg-slate-700 ${animationClassName} rounded ${className}`} />
  );
};
