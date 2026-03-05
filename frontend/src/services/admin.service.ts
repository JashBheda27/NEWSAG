import { api, getErrorMessage } from './api';

/**
 * Admin API Service - All admin dashboard API calls
 * Communicates with /api/admin endpoints on the backend
 */

// Types
export interface TrainingStats {
  training_data: {
    sentiment_total: number;
    sentiment_with_feedback: number;
    credibility_total: number;
    credibility_verified: number;
    credibility_pending: number;
  };
  models: {
    sentiment: { name: string; status: string };
    credibility: { name: string; status: string };
  };
}

export interface PendingReport {
  id: string;
  article_id: string;
  title: string;
  article_url: string;
  source_domain: string;
  ai_label: string;
  ai_score: number;
  user_reason?: string;
  report_count: number;
  created_at: string;
}

export interface SentimentFeedback {
  id: string;
  article_id: string;
  text: string;
  ai_label: 'positive' | 'neutral' | 'negative';
  ai_confidence: number;
  user_label?: 'positive' | 'neutral' | 'negative';
  final_label?: 'positive' | 'neutral' | 'negative';
  source: string;
  used_for_training: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  admin_user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  success: boolean;
  error_message?: string;
  created_at: string;
  details: Record<string, any>;
}

export interface TuningJob {
  id: string;
  model: 'sentiment' | 'credibility';
  status: 'queued' | 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  samples_processed: number;
  accuracy?: number;
}

export interface NewsStatus {
  today_hits: number;
  remaining_hits: number;
  max_hits: number;
  warning: boolean;
  reset_time_utc: string;
}

export const adminApi = {
  /**
   * Training & Fine-Tuning
   */
  async getTrainingStats(): Promise<TrainingStats> {
    try {
      const response = await api.get('/api/admin/training/stats');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch training stats: ${getErrorMessage(error)}`);
    }
  },

  async fineTuneSentiment(minSamples: number = 50, epochs: number = 3) {
    try {
      const response = await api.post('/api/admin/fine-tune/sentiment', null, {
        params: { min_samples: minSamples, epochs },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to start sentiment fine-tuning: ${getErrorMessage(error)}`);
    }
  },

  async finetuneCredibility(minSamples: number = 30, epochs: number = 3) {
    try {
      const response = await api.post('/api/admin/fine-tune/credibility', null, {
        params: { min_samples: minSamples, epochs },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to start credibility fine-tuning: ${getErrorMessage(error)}`);
    }
  },

  async finetTuneAll() {
    try {
      const response = await api.post('/api/admin/fine-tune/all');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to start fine-tuning all models: ${getErrorMessage(error)}`);
    }
  },

  /**
   * Credibility Reports
   */
  async getPendingReports(limit: number = 50): Promise<{ count: number; reports: PendingReport[] }> {
    try {
      const response = await api.get('/api/admin/reports/pending', {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch pending reports: ${getErrorMessage(error)}`);
    }
  },

  async verifyReport(reportId: string, verified: boolean = true) {
    try {
      const response = await api.post(`/api/admin/reports/${reportId}/verify`, null, {
        params: { verified },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to verify report: ${getErrorMessage(error)}`);
    }
  },

  /**
   * Sentiment Feedback
   */
  async getSentimentFeedback(
    limit: number = 100,
    source?: string
  ): Promise<{ count: number; feedback: SentimentFeedback[] }> {
    try {
      const params: any = { limit };
      if (source) params.source = source;

      const response = await api.get('/api/admin/feedback/sentiment', { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch sentiment feedback: ${getErrorMessage(error)}`);
    }
  },

  /**
   * Cache Management (from news router)
   */
  async refreshAllCache() {
    try {
      const response = await api.post('/api/news/refresh-all');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to refresh cache: ${getErrorMessage(error)}`);
    }
  },

  async refreshCategoryCache(category: string) {
    try {
      const response = await api.post(`/api/news/refresh/${category}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to refresh ${category} cache: ${getErrorMessage(error)}`);
    }
  },

  /**
   * GNews Quota Management (from news router)
   */
  async getHitCounterStatus(): Promise<NewsStatus> {
    try {
      const response = await api.get('/api/news/status/hits');
      // Backend may return a wrapper { status, hits, message }
      // unwrap `hits` if present, otherwise return the response body directly.
      if (response?.data?.hits) return response.data.hits;
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch quota status: ${getErrorMessage(error)}`);
    }
  },

  async resetHitCounter() {
    try {
      const response = await api.post('/api/news/admin/reset-hits');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to reset hit counter: ${getErrorMessage(error)}`);
    }
  },

  /**
   * Audit Log (compliance and troubleshooting)
   */
  async getAuditLog(
    limit: number = 100,
    adminUserId?: string,
    action?: string,
    resourceType?: string
  ): Promise<{ count: number; logs: AuditLog[] }> {
    try {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      if (adminUserId) params.append('admin_user_id', adminUserId);
      if (action) params.append('action', action);
      if (resourceType) params.append('resource_type', resourceType);

      const response = await api.get(`/api/admin/audit/logs?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch audit logs: ${getErrorMessage(error)}`);
    }
  },

  async getAdminActivitySummary(
    adminUserId?: string,
    days: number = 7
  ): Promise<{
    admin_user_id: string;
    total_actions: number;
    successful_actions: number;
    failed_actions: number;
    actions_by_type: Record<string, number>;
    period_days: number;
  }> {
    try {
      const params = new URLSearchParams();
      params.append('days', days.toString());
      if (adminUserId) params.append('admin_user_id', adminUserId);

      const response = await api.get(`/api/admin/audit/activity-summary?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch activity summary: ${getErrorMessage(error)}`);
    }
  },

  /**
   * Profile Analytics (for dashboard overview)
   */
  async getProfileStats() {
    try {
      const response = await api.get('/api/profile/stats');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch profile stats: ${getErrorMessage(error)}`);
    }
  },
};

export default adminApi;
