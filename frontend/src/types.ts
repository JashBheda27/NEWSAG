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
}


export interface SentimentData {
  label: 'Positive' | 'Neutral' | 'Negative';
  score: number;
  source?: 'cache' | 'computed';
}

export interface SummaryData {
  source: 'cache' | 'generated' | 'description' | 'placeholder';
  summary: string;
  original_url?: string;
}

export interface Comment {
  id: string;
  article_id: string;
  article_title: string;
  text: string;
  created_at: string;
}

export interface Bookmark {
  id: string;
  article_id: string;
  title: string;
  source: string;
  url: string;
  image_url?: string;
  created_at?: string;
}

export interface ReadLaterItem {
  id: string;
  article_id: string;
  title: string;
  source: string;
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
