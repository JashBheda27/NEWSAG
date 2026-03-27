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
      bgColor = 'bg-green-900/65';
      textColor = 'text-green-200';
      iconChar = '✓';
    } else if (score >= 0.5) {
      bgColor = 'bg-blue-900/65';
      textColor = 'text-blue-200';
      iconChar = '○';
    } else if (score >= 0.35) {
      bgColor = 'bg-amber-900/65';
      textColor = 'text-amber-200';
      iconChar = '?';
    } else {
      bgColor = 'bg-rose-900/65';
      textColor = 'text-rose-200';
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
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wide border border-white/15 shadow-lg shadow-black/45 backdrop-blur-md ${bg} ${text}`}
      title={tooltipText}
    >
      <span>{icon}</span>
      {displayLabel}
    </span>
  );
});

CredibilityBadge.displayName = 'CredibilityBadge';
