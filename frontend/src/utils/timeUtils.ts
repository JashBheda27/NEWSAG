/**
 * Format a date to relative time (e.g., "2 hours ago")
 */
function parseIsoDate(dateString?: string): Date | null {
  if (!dateString) return null;

  let iso = dateString;
  if (/^\d{4}-\d{2}-\d{2}T/.test(dateString) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(dateString)) {
    // Trim excessive fractional seconds to milliseconds (3 digits) for Date parsing
    iso = dateString.replace(/(\.\d{3})\d+/, "$1") + 'Z';
  }

  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatRelativeTime(dateString?: string): string {
  const date = parseIsoDate(dateString);
  if (!date) return 'Recently';

  try {
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
 * Format a date as a fixed local timestamp label (e.g., "19 Mar, 10:42 AM").
 */
export function formatAbsoluteTime(dateString?: string): string {
  const date = parseIsoDate(dateString);
  if (!date) return 'Recently';

  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();

  return date.toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
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
