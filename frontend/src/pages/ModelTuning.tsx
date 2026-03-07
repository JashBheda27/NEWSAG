import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/admin.service';

interface ModelTuningProps {
  showNotification: (msg: string, type?: 'error' | 'success') => void;
}

export const ModelTuning: React.FC<ModelTuningProps> = ({ showNotification }) => {
  const [_loading, setLoading] = useState(true);
  const [tuning, setTuning] = useState<'sentiment' | 'credibility' | null>(null);
  const [trainingStats, setTrainingStats] = useState<any>(null);
  const jobs: any[] = []; // Placeholder - backend endpoint not yet implemented

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const stats = await adminApi.getTrainingStats();
        setTrainingStats(stats);
        setLoading(false);
      } catch (err) {
        showNotification(`Failed to load tuning jobs: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
        setLoading(false);
      }
    };

    fetchJobs();
  }, [showNotification]);

  const handleTriggerTune = async (model: 'sentiment' | 'credibility') => {
    setTuning(model);
    try {
      if (model === 'sentiment') {
        await adminApi.fineTuneSentiment(50, 3);
      } else {
        await adminApi.finetuneCredibility(30, 3);
      }
      showNotification(`${model} model fine-tuning started`, 'success');
    } catch (err) {
      showNotification(`Failed to start fine-tuning: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setTuning(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <span className="text-amber-500 animate-spin">⏳</span>;
      case 'completed':
        return <span className="text-emerald-500">✓</span>;
      case 'failed':
        return <span className="text-rose-500">✗</span>;
      default:
        return <span className="text-slate-400">⏳</span>;
    }
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
            <span>▶</span>
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
            <span>▶</span>
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
        {_loading ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            Loading jobs...
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            No tuning jobs yet. Start by clicking a button above.
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
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
                      {job.samples_processed} samples • {new Date(job.started_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white capitalize mb-1">
                    {job.status}
                  </p>
                  {job.accuracy && (
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Accuracy: {(job.accuracy * 100).toFixed(1)}%
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
