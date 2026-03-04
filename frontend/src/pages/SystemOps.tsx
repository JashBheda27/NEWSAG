import React, { useState } from 'react';
import { adminApi } from '../services/admin.service';

interface SystemOpsProps {
  showNotification: (msg: string, type?: 'error' | 'success') => void;
}

export const SystemOps: React.FC<SystemOpsProps> = ({ showNotification }) => {
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const handleRefreshCache = async (category?: string) => {
    setRefreshing(category || 'all');
    try {
      if (category) {
        await adminApi.refreshCategoryCache(category);
      } else {
        await adminApi.refreshAllCache();
      }
      showNotification(`Cache ${category ? 'for ' + category : 'refresh'} triggered`, 'success');
    } catch (err) {
      showNotification(`Failed to refresh cache: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setRefreshing(null);
    }
  };

  const handleResetQuota = async () => {
    setResetting(true);
    try {
      await adminApi.resetHitCounter();
      showNotification('GNews quota reset', 'success');
    } catch (err) {
      showNotification(`Failed to reset quota: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cache Management */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <span>🔄</span>
          Cache Management
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Manually refresh news caches for specific categories or all at once.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => handleRefreshCache()}
            disabled={refreshing === 'all'}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <span className={refreshing === 'all' ? 'animate-spin' : ''}>↻</span>
            {refreshing === 'all' ? 'Refreshing...' : 'Refresh All Categories'}
          </button>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {[
              'general',
              'nation',
              'business',
              'technology',
              'sports',
              'entertainment',
              'health',
            ].map((category) => (
              <button
                key={category}
                onClick={() => handleRefreshCache(category)}
                disabled={refreshing === category}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors capitalize"
              >
                {refreshing === category ? (
                  <>
                    <span className="inline animate-spin mr-1">↻</span>
                    ...
                  </>
                ) : (
                  category
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* GNews API Management */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <span>🔄</span>
          GNews API Quota Reset
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Reset the daily hit counter (100 requests per day, UTC). Useful for testing or quota troubleshooting.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Current Status</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Today's Hits</span>
                <span className="font-semibold text-slate-900 dark:text-white">—</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Remaining</span>
                <span className="font-semibold text-slate-900 dark:text-white">—</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Reset Time (UTC)</span>
                <span className="font-semibold text-slate-900 dark:text-white">—</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200 flex items-center gap-2 mb-2">
              <span>⚠️</span>
              Warning
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Resetting quota will clear today's hit counter. Use only for testing or when instructed by support.
            </p>
          </div>
        </div>

        <button
          onClick={handleResetQuota}
          disabled={resetting}
          className="px-6 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {resetting ? 'Resetting...' : 'Reset Quota'}
        </button>
      </div>

      {/* Monitoring & Logs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <span>👁️</span>
          Monitoring
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          View system health, logs, and performance metrics.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <p className="text-sm font-medium text-slate-900 dark:text-white mb-3">
              Database Status
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Connection</span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  <span className="text-slate-900 dark:text-white">Connected</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Latency</span>
                <span className="text-slate-900 dark:text-white">—</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Collections</span>
                <span className="text-slate-900 dark:text-white">—</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <p className="text-sm font-medium text-slate-900 dark:text-white mb-3">
              Service Status
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">ML Models</span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  <span className="text-slate-900 dark:text-white">Ready</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Cache (Redis)</span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  <span className="text-slate-900 dark:text-white">Connected</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">API (GNews)</span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                  <span className="text-slate-900 dark:text-white">Initializing</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemOps;
