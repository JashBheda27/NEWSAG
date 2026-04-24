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
  article_url?: string;
  text: string;
  ai_label: 'positive' | 'neutral' | 'negative' | 'Positive' | 'Neutral' | 'Negative';
  ai_confidence: number;
  user_label?: 'positive' | 'neutral' | 'negative' | 'Positive' | 'Neutral' | 'Negative';
  final_label?: 'positive' | 'neutral' | 'negative' | 'Positive' | 'Neutral' | 'Negative';
  source: string;
  review_flag?: boolean;
  review_reason?: string;
  sentiment_history?: Array<{
    type?: string;
    old_label?: string;
    new_label?: string;
    reason?: string;
    changed_by?: string;
    changed_at?: string;
  }>;
  used_for_training: boolean;
  created_at: string;
  updated_at?: string;
}

export interface SentimentTrendPoint {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
  total: number;
  positive_ratio: number;
  neutral_ratio: number;
  negative_ratio: number;
}

export interface SentimentHeatmapCell {
  source: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  value: number;
  intensity: number;
}

export interface SentimentAnomalyConfig {
  window_hours: number;
  negative_threshold: number;
  minimum_samples: number;
}

export interface SentimentAnomalyReport {
  window_hours: number;
  minimum_samples: number;
  negative_threshold: number;
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  negative_ratio: number;
  alert: boolean;
  message: string;
  samples: Array<{
    id: string;
    article_id?: string;
    label?: string;
    source?: string;
    created_at?: string;
  }>;
}

export interface AuditLog {
  id: string;
  admin_user_id: string;
  admin_username?: string;
  admin_name?: string;
  admin_display?: string;
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

export interface PaginatedTuningJobsResponse {
  jobs: Array<any>;
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface NewsStatus {
  today_hits: number;
  remaining_hits: number;
  max_hits: number;
  warning: boolean;
  reset_time_utc: string;
}

export interface AdminMetrics {
  total_users: number;
  active_this_week: number;
  articles_indexed: number;
  avg_sentiment: number | null; // either 0-1 fraction or 0-100 percent depending on backend
}

export interface ChatbotTokenUsage {
  requests: number;
  success: number;
  failure: number;
  prompt: number;
  completion: number;
  total: number;
  estimated_requests: number;
}

export const CHATBOT_DEPLOYMENT_MODES = ['local', 'cloud', 'unknown'] as const;
export type ChatbotDeploymentMode = (typeof CHATBOT_DEPLOYMENT_MODES)[number];

export interface ChatbotSystemStatus {
  connected: boolean;
  provider: string;
  llm_name: string;
  model_name: string;
  base_url: string;
  deployment_mode: ChatbotDeploymentMode;
  tokens_today: ChatbotTokenUsage;
  avg_latency_ms: number | null;
  last_request_at: string | null;
  last_error: string | null;
}

export interface SystemStatus {
  database?: {
    connected?: boolean;
    latency_ms?: number | null;
    collections?: number | null;
  };
  redis?: {
    connected?: boolean;
    hit_rate?: number | null;
    memory_usage?: string | null;
  };
  gnews?: {
    today_hits?: number | null;
    remaining?: number | null;
    limit?: number | null;
    reset_time?: string | null;
  };
  chatbot?: ChatbotSystemStatus;
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
   * Enhanced Fine-Tuning API (v2) with Hyperparameters
   */
  async startFineTuningWithHyperparameters(
    modelType: 'sentiment' | 'credibility',
    minSamples?: number,
    dataSource: 'internal' | 'external' | 'combined' = 'internal',
    hyperparameters?: {
      learning_rate?: number;
      epochs?: number;
      batch_size?: number;
      optimizer?: string;
      warmup_steps?: number;
      dropout?: number;
    }
  ) {
    try {
      const response = await api.post('/api/admin/tuning/start', {
        model_type: modelType,
        min_samples: minSamples,
        data_source: dataSource,
        hyperparameters,
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to start fine-tuning: ${getErrorMessage(error)}`);
    }
  },

  async getModelMetrics(modelType: 'sentiment' | 'credibility') {
    try {
      const response = await api.get(`/api/admin/tuning/metrics/${modelType}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch model metrics: ${getErrorMessage(error)}`);
    }
  },

  async cancelFineTuning(jobId: string) {
    try {
      const response = await api.post(`/api/admin/tuning/cancel/${jobId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to cancel fine-tuning: ${getErrorMessage(error)}`);
    }
  },

  async deleteTuningJob(jobId: string) {
    try {
      const response = await api.delete(`/api/admin/tuning/jobs/${jobId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to delete tuning job: ${getErrorMessage(error)}`);
    }
  },

  async getDataQualityStats(modelType: 'sentiment' | 'credibility') {
    try {
      const response = await api.get(`/api/admin/tuning/data-quality/${modelType}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch data quality stats: ${getErrorMessage(error)}`);
    }
  },

  async importTrainingCsv(modelType: 'sentiment' | 'credibility', file: File) {
    return this.importTrainingCsvWithMapping(modelType, file);
  },

  async validateTrainingCsv(
    modelType: 'sentiment' | 'credibility',
    file: File,
    mapping?: Record<string, string>
  ) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (mapping && Object.keys(mapping).length > 0) {
        formData.append('mapping_json', JSON.stringify(mapping));
      }
      const response = await api.post(`/api/admin/tuning/import/validate/${modelType}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to validate training CSV: ${getErrorMessage(error)}`);
    }
  },

  async importTrainingCsvWithMapping(
    modelType: 'sentiment' | 'credibility',
    file: File,
    mapping?: Record<string, string>
  ) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (mapping && Object.keys(mapping).length > 0) {
        formData.append('mapping_json', JSON.stringify(mapping));
      }
      const response = await api.post(`/api/admin/tuning/import/${modelType}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to import training CSV: ${getErrorMessage(error)}`);
    }
  },

  async getModelVersions(modelType: 'sentiment' | 'credibility') {
    try {
      const response = await api.get(`/api/admin/tuning/versions/${modelType}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch model versions: ${getErrorMessage(error)}`);
    }
  },

  async rollbackModel(modelType: 'sentiment' | 'credibility', version: number) {
    try {
      const response = await api.post(`/api/admin/tuning/rollback/${modelType}`, {
        version,
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to rollback model: ${getErrorMessage(error)}`);
    }
  },

  async getTrainingLogs(jobId: string) {
    try {
      const response = await api.get(`/api/admin/tuning/logs/${jobId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch training logs: ${getErrorMessage(error)}`);
    }
  },

  async getTuningJobsHistory(
    page: number = 1,
    pageSize: number = 20,
    status?: 'all' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled',
    modelType?: 'sentiment' | 'credibility'
  ): Promise<PaginatedTuningJobsResponse> {
    try {
      const params: Record<string, any> = {
        page,
        page_size: pageSize,
      };

      if (status && status !== 'all') params.status = status;
      if (modelType) params.model_type = modelType;

      const response = await api.get('/api/admin/tuning/jobs', { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch tuning jobs history: ${getErrorMessage(error)}`);
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
    source?: string,
    offset?: number
  ): Promise<{ count: number; feedback: SentimentFeedback[] }> {
    try {
      const params: any = { limit };
      if (source) params.source = source;
      if (typeof offset === 'number') params.offset = offset;

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

  /**
   * Admin dashboard metrics: total users, active this week,
   * articles indexed, and average sentiment.
   */
  async getAdminMetrics(): Promise<AdminMetrics> {
    try {
      const response = await api.get('/api/admin/metrics');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch admin metrics: ${getErrorMessage(error)}`);
    }
  },
  async getClerkUserCount(): Promise<{ total_users: number | null; source?: string }> {
    try {
      const response = await api.get('/api/admin/clerk-user-count');
      return response.data;
    } catch (error) {
      // Return a neutral shape so callers can fallback
      return { total_users: null, source: 'error' };
    }
  },
  async getHitHistory(days: number = 7): Promise<{ days: number; history: Array<{ date: string; count: number; hours?: Record<string, number> }> }> {
    try {
      const response = await api.get('/api/admin/metrics/hits', { params: { days } });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch hit history: ${getErrorMessage(error)}`);
    }
  },
  async getSystemStatus(): Promise<SystemStatus> {
    try {
      const response = await api.get('/api/admin/system/status');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch system status: ${getErrorMessage(error)}`);
    }
  },

  async getSentimentStats(): Promise<{ counts: Record<string, number>; total: number; percentages: Record<string, number> }> {
    try {
      const response = await api.get('/api/admin/sentiment/stats');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch sentiment stats: ${getErrorMessage(error)}`);
    }
  },

  async getSentimentTrends(days: number = 30): Promise<{ days: number; points: SentimentTrendPoint[] }> {
    try {
      const response = await api.get('/api/admin/sentiment/trends', { params: { days } });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch sentiment trends: ${getErrorMessage(error)}`);
    }
  },

  async getSentimentHeatmap(days: number = 30): Promise<{ days: number; sources: string[]; sentiments: string[]; max: number; cells: SentimentHeatmapCell[] }> {
    try {
      const response = await api.get('/api/admin/sentiment/heatmap', { params: { days } });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch sentiment heatmap: ${getErrorMessage(error)}`);
    }
  },

  async overrideSentimentLabel(feedbackId: string, newLabel: 'positive' | 'neutral' | 'negative', reason?: string): Promise<{ message: string; id: string; old_label: string; new_label: string }> {
    try {
      const response = await api.patch(`/api/admin/feedback/sentiment/${feedbackId}/override-label`, {
        new_label: newLabel,
        reason,
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to override sentiment label: ${getErrorMessage(error)}`);
    }
  },

  async flagSentimentFeedback(feedbackId: string, flagged: boolean, reason?: string): Promise<{ message: string; id: string; flagged: boolean; reason?: string }> {
    try {
      const response = await api.patch(`/api/admin/feedback/sentiment/${feedbackId}/flag`, {
        flagged,
        reason,
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update review flag: ${getErrorMessage(error)}`);
    }
  },

  async reanalyzeSentimentFeedback(feedbackId: string): Promise<{
    message: string;
    id: string;
    previous_ai_label?: string;
    new_ai_label: string;
    previous_ai_confidence?: number;
    new_ai_confidence: number;
    new_final_label?: string;
    sentiment_history: Record<string, any>;
  }> {
    try {
      const response = await api.post(`/api/admin/feedback/sentiment/${feedbackId}/reanalyze`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to re-analyze sentiment feedback: ${getErrorMessage(error)}`);
    }
  },

  async getSentimentAnomalyConfig(): Promise<SentimentAnomalyConfig> {
    try {
      const response = await api.get('/api/admin/sentiment/anomaly-config');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch sentiment anomaly config: ${getErrorMessage(error)}`);
    }
  },

  async saveSentimentAnomalyConfig(config: SentimentAnomalyConfig): Promise<SentimentAnomalyConfig> {
    try {
      const response = await api.put('/api/admin/sentiment/anomaly-config', config);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to save sentiment anomaly config: ${getErrorMessage(error)}`);
    }
  },

  async getSentimentAnomalies(): Promise<SentimentAnomalyReport> {
    try {
      const response = await api.get('/api/admin/sentiment/anomalies');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch sentiment anomalies: ${getErrorMessage(error)}`);
    }
  },
};

export default adminApi;
