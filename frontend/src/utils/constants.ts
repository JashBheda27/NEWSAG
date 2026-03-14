/**
 * Shared constants across the frontend application.
 */

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'hi', name: 'Hindi' },
  { code: 'zh-CN', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ko', name: 'Korean' },
  { code: 'it', name: 'Italian' },
];

export const ERROR_MESSAGES = {
  LOAD_COMMENTS: 'Failed to load comments.',
  POST_COMMENT: 'Failed to post comment.',
  GENERATE_SUMMARY: 'Failed to generate summary.',
  TRANSLATION_FAILED: 'Translation failed.',
  AUDIO_UNAVAILABLE: 'Audio is unavailable.',
  ACTION_FAILED: 'Action failed. Check your connection.',
} as const;

export const NEWS_CATEGORY_IDS: { id: string; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'nation', label: 'Nation' },
  { id: 'business', label: 'Business' },
  { id: 'technology', label: 'Technology' },
  { id: 'sports', label: 'Sports' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'health', label: 'Health' },
];
