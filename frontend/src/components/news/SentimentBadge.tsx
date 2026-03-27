import { memo, useMemo } from 'react';
import type { SentimentData } from '../../types';

interface SentimentBadgeProps {
  sentiment?: SentimentData;
}

// Optimized SentimentBadge with contrast-safe overlay styling
export const SentimentBadge = memo<SentimentBadgeProps>(({ sentiment }) => {
  if (!sentiment) return null;

  // Memoize config lookup with readable accent colors on top of images
  const { bg, text, label, confidencePercent } = useMemo(() => {
    const config: Record<'Positive' | 'Neutral' | 'Negative', { bg: string; text: string; label: string }> = {
      Positive: {
        bg: 'bg-emerald-900/65',
        text: 'text-emerald-200',
        label: 'Positive'
      },
      Neutral: {
        bg: 'bg-slate-900/65',
        text: 'text-slate-100',
        label: 'Neutral'
      },
      Negative: {
        bg: 'bg-rose-900/65',
        text: 'text-rose-200',
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
        backdrop-blur-md border border-white/15 shadow-lg shadow-black/45
        transition-all duration-200
        hover:scale-105
      `}
      title={`Confidence: ${confidenceText} (${confidencePercent}%)`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${
        sentiment.label === 'Positive' ? 'bg-emerald-300' :
        sentiment.label === 'Negative' ? 'bg-rose-300' : 'bg-slate-200'
      }`} />
      <span>{label}</span>
    </span>
  );
});

SentimentBadge.displayName = 'SentimentBadge';