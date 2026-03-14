import React, { useState, useEffect } from 'react';
import { Ban, CheckCircle2, Clock3, Loader2, Play, XCircle } from 'lucide-react';
import { adminApi } from '../services/admin.service';
import { EmptyState } from '../components/ui/EmptyState';
import { notify } from '../lib/notify';

interface ModelTuningProps {
  showNotification: (msg: string, type?: 'error' | 'success' | 'warning' | 'info') => void;
}

export const ModelTuning: React.FC<ModelTuningProps> = ({ showNotification }) => {
  const [loading, setLoading] = useState(true);
  const [tuning, setTuning] = useState<'sentiment' | 'credibility' | null>(null);
  const [trainingStats, setTrainingStats] = useState<any>(null);
  void showNotification;
  const jobs = (trainingStats?.recent_jobs || []).map((job: any, idx: number) => ({
    ...job,
    id: idx,
  }));

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const stats = await adminApi.getTrainingStats();
        setTrainingStats(stats);
        setLoading(false);
      } catch (err) {
        notify.error(`Failed to load tuning jobs: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setLoading(false);
      }
    };

    fetchJobs();
  }, [showNotification]);

  const handleTriggerTune = async (model: 'sentiment' | 'credibility') => {
    setTuning(model);
    try {
      const operation = model === 'sentiment'
        ? adminApi.fineTuneSentiment(50, 3)
        : adminApi.finetuneCredibility(30, 3);

      await notify.promise(operation, {
        loading: `Starting ${model} fine-tuning...`,
        success: `${model} model fine-tuning started`,
        error: 'Failed to start fine-tuning',
      });
    } catch {
      // Toast is already handled by notify.promise.
    } finally {
      setTuning(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 size={16} className="text-amber-500 animate-spin" aria-hidden="true" />;
      case 'completed':
      case 'success':
        return <CheckCircle2 size={16} className="text-emerald-500" aria-hidden="true" />;
      case 'failed':
      case 'error':
        return <XCircle size={16} className="text-rose-500" aria-hidden="true" />;
      case 'skipped':
        return <Ban size={16} className="text-slate-500" aria-hidden="true" />;
      default:
        return <Clock3 size={16} className="text-slate-400" aria-hidden="true" />;
    }
  };

  const getSamplesText = (job: any) => {
    if (job.status === 'skipped' && job.samples_available != null && job.min_required != null) {
      return `${job.samples_available}/${job.min_required} samples`;
    }
    return `${job.samples ?? '—'} samples`;
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Sentiment Model
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Fine-tune sentiment analysis model based on collected feedback.
          </p>
          <button
            onClick={() => handleTriggerTune('sentiment')}
            disabled={tuning === 'sentiment'}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <Play size={16} aria-hidden="true" />
            {tuning === 'sentiment' ? 'Starting...' : 'Start Fine-Tuning'}
          </button>
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Last trained</span>
              <span className="font-medium text-slate-900 dark:text-white">{trainingStats?.sentiment_model?.last_trained ? new Date(trainingStats.sentiment_model.last_trained).toLocaleString() : '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Training samples</span>
              <span className="font-medium text-slate-900 dark:text-white">{trainingStats?.sentiment_model?.training_samples ?? '—'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Credibility Model
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Fine-tune credibility detection model based on verified reports.
          </p>
          <button
            onClick={() => handleTriggerTune('credibility')}
            disabled={tuning === 'credibility'}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <Play size={16} aria-hidden="true" />
            {tuning === 'credibility' ? 'Starting...' : 'Start Fine-Tuning'}
          </button>
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Last trained</span>
                <span className="font-medium text-slate-900 dark:text-white">{trainingStats?.credibility_model?.last_trained ? new Date(trainingStats.credibility_model.last_trained).toLocaleString() : '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Training samples</span>
                <span className="font-medium text-slate-900 dark:text-white">{trainingStats?.credibility_model?.training_samples ?? '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Jobs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Recent Fine-Tuning Jobs
        </h3>
        {loading ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Loading jobs...
            </span>
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            title="No Tuning Jobs Yet"
            description="Start a sentiment or credibility fine-tuning run to see job history here."
            illustration="generic"
          />
        ) : (
          <div className="space-y-3">
            {jobs.map((job: any) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(job.status)}
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {job.model} model
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {getSamplesText(job)} • {new Date(job.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white capitalize mb-1">
                    {job.status}
                  </p>
                  {job.training_loss && (
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Loss: {job.training_loss.toFixed(4)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelTuning;
