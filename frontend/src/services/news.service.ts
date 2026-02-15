import { api, getErrorMessage } from './api';
import type { Article, SentimentData, SummaryData } from '../types';
import type { Topic } from '../types';

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
  getNewsByTopic: async (
    topic: Topic
  ): Promise<Article[]> => {
    try {
      const response = await api.get<{
        articles: Article[];
        count: number;
        source: string;
      }>(`/api/news/topic/${topic}`);

      return response.data.articles;
    } catch (err: unknown) {
      console.error(`Failed to fetch news for topic ${topic}:`, err);
      throw new Error(getErrorMessage(err));
    }
  },

  // --------------------------------------------------
  // ARTICLE SUMMARY (with fallback strategy)
  // --------------------------------------------------
  getSummary: async (
    url: string,
    content?: string,
    description?: string,
    lang: string = 'en'
  ): Promise<SummaryData> => {
    try {
      // ✅ Send POST request with JSON payload
      const response = await api.post<SummaryData>(`/api/summary/`, {
        url: url,
        content: content,          // Full article content when available
        description: description,  // GNews description fallback for paywalls
        lang: lang,                // Target language for translation
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
};
