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
      bgColor = 'bg-green-100 dark:bg-green-900/30';
      textColor = 'text-green-700 dark:text-green-400';
      iconChar = '✓';
    } else if (score >= 0.5) {
      bgColor = 'bg-blue-100 dark:bg-blue-900/30';
      textColor = 'text-blue-700 dark:text-blue-400';
      iconChar = '○';
    } else if (score >= 0.35) {
      bgColor = 'bg-yellow-100 dark:bg-yellow-900/30';
      textColor = 'text-yellow-700 dark:text-yellow-400';
      iconChar = '?';
    } else {
      bgColor = 'bg-red-100 dark:bg-red-900/30';
      textColor = 'text-red-700 dark:text-red-400';
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
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${bg} ${text} transform-gpu transition-transform duration-200 hover:scale-105`}
      title={tooltipText}
    >
      <span className="mr-1">{icon}</span>
      {displayLabel}
    </span>
  );
});

CredibilityBadge.displayName = 'CredibilityBadge';
