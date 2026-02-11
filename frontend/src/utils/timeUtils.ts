/**
 * Format a date to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Recently';

  try {
    // Some backend datetimes are ISO strings without timezone (naive UTC),
    // e.g. "2026-02-11T07:16:52.928000". JavaScript may interpret those
    // as local time which causes incorrect offsets (shows 5h ago in IST).
    // If the string has no timezone indicator, treat it as UTC by appending 'Z'.
    let iso = dateString;
    if (/^\d{4}-\d{2}-\d{2}T/.test(dateString) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(dateString)) {
      // Trim excessive fractional seconds to milliseconds (3 digits) for Date parsing
      iso = dateString.replace(/(\.\d{3})\d+/, "$1") + 'Z';
    }

    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    
    // For dates older than a month, show the actual date
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  } catch {
    return 'Recently';
  }
}

/**
 * Calculate estimated reading time in minutes based on word count
 * Average reading speed: 200 words per minute
 */
export function calculateReadTime(text?: string): number {
  if (!text) return 1;
  const wordCount = text.trim().split(/\s+/).length;
  const readTimeMinutes = Math.ceil(wordCount / 200);
  return Math.max(1, readTimeMinutes);
}

/**
 * Get reading time display text
 */
export function getReadTimeText(text?: string): string {
  const minutes = calculateReadTime(text);
  return `${minutes} min read`;
}
