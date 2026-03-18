import { api, getErrorMessage } from './api';
import type { Article, SentimentData, SummaryData } from '../types';
import type { Topic } from '../types';

export interface TopicNewsResponse {
  articles: Article[];
  count: number;
  source: string;
}

interface TopicFetchOptions {
  refresh?: boolean;
}

const getArticleIdentity = (article: Article): string => {
  return article.id || article.url;
};

const toTimestamp = (value?: string): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export const mergeArticlesByNewest = (current: Article[], fresh: Article[]): Article[] => {
  const ordered: Article[] = [];
  const seen = new Set<string>();

  // Fresh items are considered first so ties prefer latest payload.
  for (const article of fresh) {
    const key = getArticleIdentity(article);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    ordered.push(article);
  }

  for (const article of current) {
    const key = getArticleIdentity(article);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    ordered.push(article);
  }

  return ordered
    .map((article, index) => ({ article, index, timestamp: toTimestamp(article.published_at) }))
    .sort((a, b) => {
      if (a.timestamp === null && b.timestamp === null) return a.index - b.index;
      if (a.timestamp === null) return 1;
      if (b.timestamp === null) return -1;
      if (a.timestamp === b.timestamp) return a.index - b.index;
      return b.timestamp - a.timestamp;
    })
    .map((entry) => entry.article);
};

// Trending headline type (lightweight for ticker)
export interface TrendingHeadline {
  id: string;
  title: string;
  source: string;
  url: string;
  published_at?: string;
  category?: string;
}

export interface SuggestionResponse {
  query: string;
  count: number;
  articles: Article[];
}

export const newsService = {
  // --------------------------------------------------
  // TRENDING HEADLINES (BULLETIN TICKER)
  // --------------------------------------------------
  getTrendingHeadlines: async (
    maxItems: number = 8
  ): Promise<TrendingHeadline[]> => {
    try {
      const response = await api.get<{
        headlines: TrendingHeadline[];
        count: number;
        source: string;
      }>(`/api/news/trending/headlines`, {
        params: { max_items: maxItems }
      });

      return response.data.headlines;
    } catch (err: unknown) {
      console.error('Failed to fetch trending headlines:', err);
      throw new Error(getErrorMessage(err));
    }
  },

  // --------------------------------------------------
  // INDIA TOPIC-BASED NEWS
  // --------------------------------------------------
  getNewsByTopicResponse: async (
    topic: Topic,
    options?: TopicFetchOptions
  ): Promise<TopicNewsResponse> => {
    try {
      const response = await api.get<TopicNewsResponse>(`/api/news/topic/${topic}`, {
        params: options?.refresh ? { refresh: true } : undefined,
      });

      return response.data;
    } catch (err: unknown) {
      console.error(`Failed to fetch news for topic ${topic}:`, err);
      throw new Error(getErrorMessage(err));
    }
  },

  getNewsByTopic: async (
    topic: Topic,
    options?: TopicFetchOptions
  ): Promise<Article[]> => {
    const response = await newsService.getNewsByTopicResponse(topic, options);
    return response.articles;
  },

  // --------------------------------------------------
  // ARTICLE SUMMARY (with fallback strategy)
  // --------------------------------------------------
  getSummary: async (
    url: string,
    content?: string,
    description?: string,
    lang: string = 'en',
    title?: string,
    articleSource?: string,
    articleId?: string
  ): Promise<SummaryData> => {
    try {
      // ✅ Send POST request with JSON payload
      const response = await api.post<SummaryData>(`/api/summary/`, {
        url: url,
        content: content,          // Full article content when available
        description: description,  // GNews description fallback for paywalls
        lang: lang,                // Target language for translation
        title: title,              // Article title for description validation
        article_source: articleSource,  // Source name for quality tracking
        article_id: articleId,     // Article ID for category lookup
      });
      return response.data;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  },

  // --------------------------------------------------
  // SEARCH SUGGESTIONS (CACHE ONLY)
  // --------------------------------------------------
  getSuggestions: async (query: string): Promise<SuggestionResponse> => {
    try {
      const response = await api.get<SuggestionResponse>(`/api/news/suggestions`, {
        params: { q: query }
      });
      return response.data;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  },

  // --------------------------------------------------
  // SENTIMENT ANALYSIS
  // --------------------------------------------------
  getSentiment: async (text: string): Promise<SentimentData> => {
    try {
      const response = await api.post<{
        result: SentimentData;
        source: string;
      }>(`/api/sentiment/`, { text });

      return response.data.result;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  },

  // --------------------------------------------------
  // USER FEEDBACK
  // --------------------------------------------------
  submitFeedback: async (
    feedback: string
  ): Promise<{ status: string }> => {
    try {
      const response = await api.post<{ message: string }>(
        `/api/feedback/`,
        { message: feedback }
      );
      return { status: response.data.message };
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  },

  // --------------------------------------------------
  // SENTIMENT RATING (ML Fine-tuning Feedback)
  // --------------------------------------------------
  rateSentiment: async (data: {
    article_id: string;
    article_url?: string;
    title: string;
    description?: string;
    ai_label: string;
    ai_confidence: number;
    user_label: string;
  }): Promise<{ message: string; feedback_id: string }> => {
    try {
      const response = await api.post<{
        message: string;
        feedback_id: string;
        ai_label: string;
        user_label: string;
      }>(`/api/news/rate`, data);
      return response.data;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  },

  // --------------------------------------------------
  // REPORT MISLEADING CONTENT (Fake News Feedback)
  // --------------------------------------------------
  reportMisleading: async (data: {
    article_id: string;
    article_url: string;
    title: string;
    description?: string;
    content?: string;
    source_domain?: string;
    ai_label: string;
    ai_score: number;
    ai_source: string;
    reason?: string;
  }): Promise<{ message: string; report_id: string; report_count: number }> => {
    try {
      const response = await api.post<{
        message: string;
        report_id: string;
        report_count: number;
        status: string;
      }>(`/api/news/report`, data);
      return response.data;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  },
};
