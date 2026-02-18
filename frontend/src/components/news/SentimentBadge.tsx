import { memo, useMemo } from 'react';
import type { SentimentData } from '../../types';

interface SentimentBadgeProps {
  sentiment?: SentimentData;
}

// Optimized SentimentBadge with memoization and reduced animations
export const SentimentBadge = memo<SentimentBadgeProps>(({ sentiment }) => {
  if (!sentiment) return null;

  // Memoize config lookup
  const { bg, text, icon, label, confidencePercent } = useMemo(() => {
    const config: Record<'Positive' | 'Neutral' | 'Negative', { bg: string; text: string; icon: string; label: string }> = {
      Positive: {
        bg: 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800',
        text: 'text-emerald-700 dark:text-emerald-400',
        icon: '😊',
        label: 'Positive'
      },
      Neutral: {
        bg: 'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700',
        text: 'text-slate-700 dark:text-slate-400',
        icon: '😐',
        label: 'Neutral'
      },
      Negative: {
        bg: 'bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800',
        text: 'text-rose-700 dark:text-rose-400',
        icon: '😔',
        label: 'Negative'
      }
    };

    const baseConfig = config[sentiment.label];
    return {
      ...baseConfig,
      confidencePercent: Math.round(sentiment.confidence * 100)
    };
  }, [sentiment.label, sentiment.confidence]);

  const confidenceText = sentiment.confidence.toFixed(2);

  return (
    <span 
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${bg} ${text} transform-gpu transition-transform duration-200 hover:scale-105`}
      title={`Confidence: ${confidenceText} (${confidencePercent}%)`}
    >
      <span>{icon}</span>
      <span>{label}</span>
      <span className="text-xs opacity-75">{confidencePercent}%</span>
    </span>
  );
});

SentimentBadge.displayName = 'SentimentBadge';