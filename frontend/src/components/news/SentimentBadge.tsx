import React from 'react';
import type { SentimentData } from '../../types';

interface SentimentBadgeProps {
  sentiment?: SentimentData;
}

export const SentimentBadge: React.FC<SentimentBadgeProps> = ({ sentiment }) => {
  if (!sentiment) return null;

  const config: Record<'Positive' | 'Neutral' | 'Negative', { bg: string; text: string; label: string }> = {
    Positive: {
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      text: 'text-emerald-700 dark:text-emerald-400',
      label: 'Positive'
    },
    Neutral: {
      bg: 'bg-slate-100 dark:bg-slate-800',
      text: 'text-slate-700 dark:text-slate-400',
      label: 'Neutral'
    },
    Negative: {
      bg: 'bg-rose-100 dark:bg-rose-900/30',
      text: 'text-rose-700 dark:text-rose-400',
      label: 'Negative'
    }
  };

  const { bg, text, label } = config[sentiment.label];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${bg} ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${text.replace('text', 'bg')}`}></span>
      {label} {(sentiment.score * 100).toFixed(0)}%
    </span>
  );
};