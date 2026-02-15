import React from 'react';
import type { CredibilityData } from '../../types';

interface CredibilityBadgeProps {
  credibility?: CredibilityData;
}

export const CredibilityBadge: React.FC<CredibilityBadgeProps> = ({ credibility }) => {
  if (!credibility) return null;

  const { score, label, source } = credibility;

  // Determine badge styling based on score
  let bg: string;
  let text: string;
  let icon: string;

  if (label === 'Trusted Source' || score >= 0.75) {
    bg = 'bg-green-100 dark:bg-green-900/30';
    text = 'text-green-700 dark:text-green-400';
    icon = '✓';
  } else if (score >= 0.5) {
    bg = 'bg-blue-100 dark:bg-blue-900/30';
    text = 'text-blue-700 dark:text-blue-400';
    icon = '○';
  } else if (score >= 0.35) {
    bg = 'bg-yellow-100 dark:bg-yellow-900/30';
    text = 'text-yellow-700 dark:text-yellow-400';
    icon = '?';
  } else {
    bg = 'bg-red-100 dark:bg-red-900/30';
    text = 'text-red-700 dark:text-red-400';
    icon = '!';
  }

  // Short display label
  const displayLabel = label === 'Trusted Source' 
    ? 'Verified' 
    : label === 'Potentially Misleading'
    ? 'Caution'
    : label === 'Uncertain'
    ? 'Uncertain'
    : score >= 0.75 
    ? 'Reliable' 
    : 'Checking';

  const tooltipText = source === 'heuristic' 
    ? `${label} (verified domain)` 
    : `${label} (${Math.round(score * 100)}% confidence)`;

  return (
    <span 
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${bg} ${text}`}
      title={tooltipText}
    >
      <span className="mr-1">{icon}</span>
      {displayLabel}
    </span>
  );
};
