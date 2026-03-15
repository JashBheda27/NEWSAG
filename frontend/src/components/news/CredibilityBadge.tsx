import { memo, useMemo } from 'react';
import type { CredibilityData } from '../../types';

interface CredibilityBadgeProps {
  credibility?: CredibilityData;
}

// Optimized CredibilityBadge with memoization
export const CredibilityBadge = memo<CredibilityBadgeProps>(({ credibility }) => {
  if (!credibility) return null;

  const { score, label, source } = credibility;

  // Memoize computed styling
  const { bg, text, icon, displayLabel, tooltipText } = useMemo(() => {
    let bgColor: string;
    let textColor: string;
    let iconChar: string;

    if (label === 'Trusted Source' || score >= 0.75) {
      bgColor = 'bg-green-50 dark:bg-green-500/15';
      textColor = 'text-green-600 dark:text-green-300';
      iconChar = '✓';
    } else if (score >= 0.5) {
      bgColor = 'bg-blue-50 dark:bg-blue-500/15';
      textColor = 'text-blue-600 dark:text-blue-300';
      iconChar = '○';
    } else if (score >= 0.35) {
      bgColor = 'bg-yellow-50 dark:bg-yellow-500/15';
      textColor = 'text-yellow-600 dark:text-yellow-300';
      iconChar = '?';
    } else {
      bgColor = 'bg-rose-50 dark:bg-rose-500/15';
      textColor = 'text-rose-600 dark:text-rose-300';
      iconChar = '!';
    }

    // Short display label
    const shortLabel = label === 'Trusted Source' 
      ? 'Verified' 
      : label === 'Potentially Misleading'
      ? 'Caution'
      : label === 'Uncertain'
      ? 'Uncertain'
      : score >= 0.75 
      ? 'Reliable' 
      : 'Checking';

    const tooltip = source === 'heuristic' 
      ? `${label} (verified domain)` 
      : `${label} (${Math.round(score * 100)}% confidence)`;

    return {
      bg: bgColor,
      text: textColor,
      icon: iconChar,
      displayLabel: shortLabel,
      tooltipText: tooltip
    };
  }, [label, score, source]);

  return (
    <span 
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wide border border-current/20 ${bg} ${text}`}
      title={tooltipText}
    >
      <span>{icon}</span>
      {displayLabel}
    </span>
  );
});

CredibilityBadge.displayName = 'CredibilityBadge';
