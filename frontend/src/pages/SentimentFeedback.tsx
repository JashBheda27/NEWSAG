import React, { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { adminApi, type SentimentFeedback as SentimentFeedbackType } from '../services/admin.service';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { notify } from '../lib/notify';
import { useAsyncState } from '../hooks/useAsyncState';
import { SearchSkeleton } from '../components/ui/skeletons/SearchSkeleton';

interface SentimentFeedbackProps {
  showNotification: (msg: string, type?: 'error' | 'success' | 'warning' | 'info') => void;
}

export const SentimentFeedback: React.FC<SentimentFeedbackProps> = ({ showNotification }) => {
  const {
    data: samples,
    loading,
    error: fetchError,
    executeLatest,
  } = useAsyncState<SentimentFeedbackType[]>({
    initialData: [],
    getErrorMessage: (err) => err instanceof Error ? err.message : 'Unknown error',
  });
  const [filter, setFilter] = useState<'all' | 'positive' | 'neutral' | 'negative'>('all');
  const [sentimentStats, setSentimentStats] = useState<any>(null);
  void showNotification;

  const fetchSamples = useCallback(async () => {
    try {
      await executeLatest(() => adminApi.getSentimentFeedback(100), (result) => result.feedback);

      try {
        const stats = await adminApi.getSentimentStats();
        setSentimentStats(stats);
      } catch {
        notify.warning('Unable to load sentiment distribution stats right now.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      notify.error(`Failed to load sentiment samples: ${message}`);
    }
  }, [executeLatest]);

  useEffect(() => {
    fetchSamples();
  }, [fetchSamples]);

  const getSentimentColor = (label: string) => {
    switch (label) {
      case 'positive':
        return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400';
      case 'neutral':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400';
      case 'negative':
        return 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400';
      default:
        return '';
    }
  };

  const filteredSamples =
    filter === 'all' ? samples : samples.filter((s) => s.ai_label === filter);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Sentiment Feedback Browser
          </h2>
          <div className="flex items-center gap-3">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="all">All Sentiments</option>
              <option value="positive">Positive Only</option>
              <option value="neutral">Neutral Only</option>
              <option value="negative">Negative Only</option>
            </select>
            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
              <Download size={16} aria-hidden="true" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Samples List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-4">
            <SearchSkeleton />
          </div>
        ) : fetchError ? (
          <ErrorState
            title="Unable to load sentiment feedback"
            message={fetchError}
            onRetry={fetchSamples}
          />
        ) : filteredSamples.length === 0 ? (
          <EmptyState
            title="No Sentiment Feedback"
            description="No feedback samples match your current filter yet."
            illustration="search"
          />
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredSamples.slice(0, 50).map((sample) => (
              <div key={sample.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 dark:text-white mb-1">
                      Article: {sample.article_id}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
                      {sample.text}
                    </p>
                  </div>
                  <span
                    className={`ml-3 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getSentimentColor(
                      sample.ai_label
                    )}`}
                  >
                    {sample.ai_label}
                    {' '}
                    {(sample.ai_confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {sample.source} • {new Date(sample.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Positive</p>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{sentimentStats?.percentages?.positive !== undefined ? `${sentimentStats.percentages.positive}%` : '—%'}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Neutral</p>
          <p className="text-3xl font-bold text-slate-600 dark:text-slate-400">{sentimentStats?.percentages?.neutral !== undefined ? `${sentimentStats.percentages.neutral}%` : '—%'}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Negative</p>
          <p className="text-3xl font-bold text-rose-600 dark:text-rose-400">{sentimentStats?.percentages?.negative !== undefined ? `${sentimentStats.percentages.negative}%` : '—%'}</p>
        </div>
      </div>
    </div>
  );
};

export default SentimentFeedback;
