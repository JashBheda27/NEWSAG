import React, { useState, useEffect } from 'react';
import { AlertTriangle, Database, Eye, RefreshCcw, RotateCw, Server, Settings2 } from 'lucide-react';
import { adminApi } from '../services/admin.service';
import { notify } from '../lib/notify';

interface SystemOpsProps {
  showNotification: (msg: string, type?: 'error' | 'success' | 'warning' | 'info') => void;
}

export const SystemOps: React.FC<SystemOpsProps> = ({ showNotification }) => {
  void showNotification;
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const [systemStatus, setSystemStatus] = useState<any>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const sys = await adminApi.getSystemStatus();
        setSystemStatus(sys);
      } catch {
        notify.warning('System status is temporarily unavailable.');
      }
    };

    fetchStatus();
  }, []);

  const handleRefreshCache = async (category?: string) => {
    setRefreshing(category || 'all');
    try {
      const op = category ? adminApi.refreshCategoryCache(category) : adminApi.refreshAllCache();
      await notify.promise(op, {
        loading: `Refreshing ${category ? category : 'all'} cache...`,
        success: `Cache ${category ? `for ${category}` : 'refresh'} triggered`,
        error: 'Failed to refresh cache',
      });
    } catch {
      // Toast is already handled by notify.promise.
    } finally {
      setRefreshing(null);
    }
  };

  const handleResetQuota = async () => {
    setResetting(true);
    try {
      await notify.promise(adminApi.resetHitCounter(), {
        loading: 'Resetting GNews quota...',
        success: 'GNews quota reset',
        error: 'Failed to reset quota',
      });
    } catch {
      // Toast is already handled by notify.promise.
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cache Management */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <RefreshCcw size={18} aria-hidden="true" />
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
            <RotateCw size={16} className={refreshing === 'all' ? 'animate-spin' : ''} aria-hidden="true" />
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
                    <RotateCw size={14} className="inline animate-spin mr-1" aria-hidden="true" />
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
          <Settings2 size={18} aria-hidden="true" />
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
                <span className="font-semibold text-slate-900 dark:text-white">{systemStatus?.gnews?.today_hits ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Remaining</span>
                <span className="font-semibold text-slate-900 dark:text-white">{systemStatus?.gnews?.remaining ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Reset Time (UTC)</span>
                <span className="font-semibold text-slate-900 dark:text-white">{systemStatus?.gnews?.reset_time ?? '—'}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200 flex items-center gap-2 mb-2">
              <AlertTriangle size={16} aria-hidden="true" />
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
          <Eye size={18} aria-hidden="true" />
          Monitoring
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          View system health, logs, and performance metrics.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <p className="text-sm font-medium text-slate-900 dark:text-white mb-3">
              <Database size={14} className="inline mr-2" aria-hidden="true" />
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
                <span className="text-slate-900 dark:text-white">{systemStatus?.database?.latency_ms ? `${systemStatus.database.latency_ms.toFixed(1)} ms` : '—'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Collections</span>
                <span className="text-slate-900 dark:text-white">{systemStatus?.database?.collections ?? '—'}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <p className="text-sm font-medium text-slate-900 dark:text-white mb-3">
              <Server size={14} className="inline mr-2" aria-hidden="true" />
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
