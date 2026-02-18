import { memo, useMemo } from 'react';
import type { SentimentData } from '../../types';

interface SentimentBadgeProps {
  sentiment?: SentimentData;
}

// Optimized SentimentBadge with modern pastel design
export const SentimentBadge = memo<SentimentBadgeProps>(({ sentiment }) => {
  if (!sentiment) return null;

  // Memoize config lookup - softer pastel colors
  const { bg, text, label, confidencePercent } = useMemo(() => {
    const config: Record<'Positive' | 'Neutral' | 'Negative', { bg: string; text: string; label: string }> = {
      Positive: {
        bg: 'bg-emerald-50/90 dark:bg-emerald-500/15',
        text: 'text-emerald-600 dark:text-emerald-400',
        label: 'Positive'
      },
      Neutral: {
        bg: 'bg-slate-100/90 dark:bg-slate-500/15',
        text: 'text-slate-500 dark:text-slate-400',
        label: 'Neutral'
      },
      Negative: {
        bg: 'bg-rose-50/90 dark:bg-rose-500/15',
        text: 'text-rose-500 dark:text-rose-400',
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
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wide
        ${bg} ${text}
        backdrop-blur-sm
        transition-all duration-200
        hover:scale-105
      `}
      title={`Confidence: ${confidenceText} (${confidencePercent}%)`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${
        sentiment.label === 'Positive' ? 'bg-emerald-500' :
        sentiment.label === 'Negative' ? 'bg-rose-500' : 'bg-slate-400'
      }`} />
      <span>{label}</span>
    </span>
  );
});

SentimentBadge.displayName = 'SentimentBadge';