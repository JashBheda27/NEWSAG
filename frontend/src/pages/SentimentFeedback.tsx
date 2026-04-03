import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';
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
  type FilterValue = 'all' | 'positive' | 'neutral' | 'negative';
  type SourceFilterValue = 'all' | 'explicit' | 'implicit_bookmark' | 'implicit_read_later';

  const {
    data: samples,
    loading,
    error: fetchError,
    executeLatest,
  } = useAsyncState<SentimentFeedbackType[]>({
    initialData: [],
    getErrorMessage: (err) => err instanceof Error ? err.message : 'Unknown error',
  });
  const [filter, setFilter] = useState<FilterValue>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilterValue>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState<25 | 50 | 100>(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sentimentStats, setSentimentStats] = useState<any>(null);
  void showNotification;

  const fetchSamples = useCallback(async () => {
    try {
      await executeLatest(() => adminApi.getSentimentFeedback(300), (result) => result.feedback);

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

  const normalizeSentiment = (label?: string): Exclude<FilterValue, 'all'> => {
    const lower = String(label ?? '').trim().toLowerCase();
    if (lower.includes('pos')) return 'positive';
    if (lower.includes('neg')) return 'negative';
    return 'neutral';
  };

  const formatSentimentLabel = (label?: string) => {
    const normalized = normalizeSentiment(label);
    if (normalized === 'positive') return 'Positive';
    if (normalized === 'negative') return 'Negative';
    return 'Neutral';
  };

  const formatSourceLabel = (source?: string) => {
    if (source === 'implicit_bookmark') return 'Implicit Bookmark';
    if (source === 'implicit_read_later') return 'Implicit Read Later';
    if (source === 'explicit') return 'Explicit';
    return source ?? 'Unknown';
  };

  const getSentimentColor = (label?: string) => {
    switch (normalizeSentiment(label)) {
      case 'positive':
        return 'bg-emerald-900/65 text-emerald-200 border border-white/15';
      case 'neutral':
        return 'bg-slate-900/65 text-slate-100 border border-white/15';
      case 'negative':
        return 'bg-rose-900/65 text-rose-200 border border-white/15';
      default:
        return '';
    }
  };

  const filteredSamples = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return samples.filter((sample) => {
      if (filter !== 'all' && normalizeSentiment(sample.ai_label) !== filter) {
        return false;
      }

      if (sourceFilter !== 'all' && sample.source !== sourceFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableText = `${sample.article_id} ${sample.text} ${sample.source}`.toLowerCase();
      return searchableText.includes(query);
    });
  }, [samples, filter, sourceFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredSamples.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, sourceFilter, searchQuery, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagedSamples = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSamples.slice(start, start + pageSize);
  }, [filteredSamples, currentPage, pageSize]);

  const visibleStart = filteredSamples.length ? (currentPage - 1) * pageSize + 1 : 0;
  const visibleEnd = Math.min(currentPage * pageSize, filteredSamples.length);

  const escapeCsv = (value: unknown) =>
    `"${String(value ?? '').replace(/"/g, '""')}"`;

  const handleExport = () => {
    if (!filteredSamples.length) {
      notify.warning('No sentiment feedback to export for the selected filter.');
      return;
    }

    const headers = [
      'id',
      'article_id',
      'text',
      'ai_label',
      'ai_confidence',
      'user_label',
      'final_label',
      'source',
      'used_for_training',
      'created_at',
    ];

    const rows = filteredSamples.map((s) => [
      escapeCsv(s.id),
      escapeCsv(s.article_id),
      escapeCsv(s.text),
      escapeCsv(s.ai_label),
      escapeCsv((s.ai_confidence * 100).toFixed(2)),
      escapeCsv(s.user_label),
      escapeCsv(s.final_label),
      escapeCsv(s.source),
      escapeCsv(s.used_for_training),
      escapeCsv(s.created_at),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const anchor = document.createElement('a');
    anchor.href = url;
    const safeQuery = searchQuery.trim() ? `-q-${searchQuery.trim().slice(0, 20).replace(/\s+/g, '-')}` : '';
    anchor.download = `sentiment-feedback-${filter}-${sourceFilter}${safeQuery}-${stamp}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    notify.success(`Exported ${filteredSamples.length} feedback rows.`);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Sentiment Feedback Browser
            </h2>
            <button
              onClick={handleExport}
              disabled={!filteredSamples.length}
              className="w-full lg:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={16} aria-hidden="true" />
              Export Filtered
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterValue)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="all">All Sentiments</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>

            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as SourceFilterValue)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="all">All Sources</option>
              <option value="explicit">Explicit</option>
              <option value="implicit_bookmark">Implicit Bookmark</option>
              <option value="implicit_read_later">Implicit Read Later</option>
            </select>

            <div className="sm:col-span-2 xl:col-span-2 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search article, text, or source"
                className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-slate-600 dark:text-slate-400">
            <p>
              Showing {visibleStart}-{visibleEnd} of {filteredSamples.length} rows
            </p>
            <div className="flex items-center gap-2">
              <span>Rows/page</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value) as 25 | 50 | 100)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:outline-none"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
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
            {pagedSamples.map((sample) => (
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
                    className={`ml-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap backdrop-blur-md shadow-lg shadow-black/30 ${getSentimentColor(
                      sample.ai_label
                    )}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        normalizeSentiment(sample.ai_label) === 'positive'
                          ? 'bg-emerald-300'
                          : normalizeSentiment(sample.ai_label) === 'negative'
                            ? 'bg-rose-300'
                            : 'bg-slate-200'
                      }`}
                    />
                    <span>{formatSentimentLabel(sample.ai_label)}</span>
                    <span>{(sample.ai_confidence * 100).toFixed(0)}%</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatSourceLabel(sample.source)} • {new Date(sample.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}

        {!loading && !fetchError && filteredSamples.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={15} aria-hidden="true" />
                Prev
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>
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
