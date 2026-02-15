export type Topic =
  | 'general'
  | 'nation'
  | 'business'
  | 'technology'
  | 'sports'
  | 'entertainment'
  | 'health';


export interface Article {
  id: string;
  title: string;
  description?: string;
  content?: string;  // ✅ Added: Full article content from GNews
  image_url?: string;
  source: string;
  url: string;
  published_at?: string;
  category?: Topic;
  sentiment?: SentimentData;
  credibility?: CredibilityData;  // ✅ Added: Fake news detection score
}


export interface SentimentData {
  label: 'Positive' | 'Neutral' | 'Negative';
  confidence: number;  // ✅ Changed: 0-1 confidence score (not percentage)
  model: string;       // ✅ Added: Model identifier (e.g., "roberta-news")
}

export interface CredibilityData {
  score: number;       // 0.0 to 1.0
  label: string;       // "Trusted Source", "Reliable", "Uncertain", "Potentially Misleading"
  source: 'heuristic' | 'ml_model' | 'fallback' | 'error';
}

export interface SummaryData {
  source: 'cache' | 'generated' | 'description' | 'placeholder';
  summary: string;
  original_url?: string;
  language?: string;
  translated?: boolean;
  audio_available?: boolean;
  tts_voice?: string;
}

export interface Comment {
  id: string;
  article_id: string;
  article_title: string;
  text: string;
  user_id: string;
  username: string;
  created_at: string;
}

export interface Bookmark {
  id: string;
  article_id: string;
  title: string;
  source: string;
  description?: string;
  category?: Topic;
  url: string;
  image_url?: string;
  created_at?: string;
}

export interface ReadLaterItem {
  id: string;
  article_id: string;
  title: string;
  source: string;
  category?: Topic;
  url: string;
  image_url?: string;
  created_at?: string;
}

export interface UserFeedback {
  message: string;
  name?: string;
  email?: string;
}

export interface PagedResponse<T> {
  count: number;
  items: T[];
}
