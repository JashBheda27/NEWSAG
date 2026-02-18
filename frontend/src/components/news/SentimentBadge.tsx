import React from 'react';
import { motion } from 'framer-motion';
import type { SentimentData } from '../../types';

interface SentimentBadgeProps {
  sentiment?: SentimentData;
}

export const SentimentBadge: React.FC<SentimentBadgeProps> = ({ sentiment }) => {
  if (!sentiment) return null;

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

  const { bg, text, icon, label } = config[sentiment.label];
  const confidenceText = sentiment.confidence.toFixed(2);
  const confidencePercent = Math.round(sentiment.confidence * 100);

  return (
    <motion.span 
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${bg} ${text}`}
      title={`Confidence: ${confidenceText} (${confidencePercent}%)`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.05 }}
    >
      <motion.span
        animate={{ rotate: [0, 5, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        {icon}
      </motion.span>
      <span>{label}</span>
      <motion.span 
        className="text-xs opacity-75"
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {confidencePercent}%
      </motion.span>
    </motion.span>
  );
};