import { api, getErrorMessage } from './api';
import type { Article, SentimentData, SummaryData } from '../types';
import type { Topic } from '../types';

export const newsService = {
  // --------------------------------------------------
  // INDIA TOPIC-BASED NEWS
  // --------------------------------------------------
  getNewsByTopic: async (
    topic: Topic
  ): Promise<{ articles: Article[]; isDemo: boolean }> => {
    try {
      const response = await api.get<{
        articles: Article[];
        count: number;
        source: string;
      }>(`/api/news/topic/${topic}`);

      return {
        articles: response.data.articles,
        isDemo: response.data.source === 'cache' ? false : false,
      };
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
    description?: string
  ): Promise<SummaryData> => {
    try {
      // ✅ Send POST request with JSON payload
      const response = await api.post<SummaryData>(`/api/summary/`, {
        url: url,
        content: content,          // Full article content when available
        description: description,  // GNews description fallback for paywalls
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
