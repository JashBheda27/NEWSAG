import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../services/admin.service';

interface AdminOverviewProps {
  showNotification: (msg: string, type?: 'error' | 'success') => void;
}

interface KPICard {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color: 'indigo' | 'emerald' | 'amber' | 'rose';
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({ showNotification }) => {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<KPICard[]>([
    {
      label: 'Total Users',
      value: '—',
      icon: <span className="text-2xl">👥</span>,
      color: 'indigo',
    },
    {
      label: 'Active This Week',
      value: '—',
      icon: <span className="text-2xl">📈</span>,
      color: 'emerald',
    },
    {
      label: 'Articles Indexed',
      value: '—',
      icon: <span className="text-2xl">📚</span>,
      color: 'amber',
    },
    {
      label: 'Avg Sentiment (Pos)',
      value: '—',
      icon: <span className="text-2xl">📊</span>,
      color: 'rose',
    },
  ]);

  const [_loading, setLoading] = useState(true);
  const [_trainingStats, setTrainingStats] = useState<any>(null);
  const [hitStatus, setHitStatus] = useState<any>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        // Fetch training stats
        const stats = await adminApi.getTrainingStats();
        setTrainingStats(stats);

        // Fetch GNews hit status
        const hits = await adminApi.getHitCounterStatus();
        setHitStatus(hits);

        // Update KPIs
        setKpis((prev) =>
          prev.map((kpi) => {
            switch (kpi.label) {
              case 'Total Users':
                return { ...kpi, value: '—' }; // Would need user count endpoint
              case 'Active This Week':
                return { ...kpi, value: '—' }; // Would need session tracking
              case 'Articles Indexed':
                return { ...kpi, value: '—' }; // Would need article count endpoint
              case 'Avg Sentiment (Pos)':
                return { ...kpi, value: '—' }; // Would need sentiment aggregate
              default:
                return kpi;
            }
          })
        );

        setLoading(false);
      } catch (err) {
        showNotification(`Error loading metrics: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [showNotification]);

  const colorClasses = {
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    rose: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
  };

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl ${colorClasses[kpi.color]}`}>
                {kpi.icon}
              </div>
              {kpi.trend && (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">
                  {kpi.trend}
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              {kpi.label}
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button 
            onClick={async () => {
              try {
                await adminApi.refreshAllCache();
                showNotification('Cache refresh started', 'success');
              } catch (err) {
                showNotification(`Error: ${err instanceof Error ? err.message : 'Failed to refresh cache'}`, 'error');
              }
            }}
            className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
          >
            <p className="font-medium text-slate-900 dark:text-white mb-1">Refresh News Cache</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Clear and reload all categories</p>
          </button>
          <button 
            onClick={async () => {
              try {
                await adminApi.resetHitCounter();
                showNotification('Hit counter reset', 'success');
              } catch (err) {
                showNotification(`Error: ${err instanceof Error ? err.message : 'Failed to reset quota'}`, 'error');
              }
            }}
            className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
          >
            <p className="font-medium text-slate-900 dark:text-white mb-1">Reset GNews Quota</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Reset daily hit counter</p>
          </button>
          <button 
            onClick={() => navigate('/admin/audit')}
            className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
          >
            <p className="font-medium text-slate-900 dark:text-white mb-1">View Audit Log</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">See recent admin actions</p>
          </button>
        </div>
      </div>

      {/* System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Redis Cache Status
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">Connection</span>
              <span className="inline-flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full"></span>
                <span className="text-sm font-medium text-slate-900 dark:text-white">Connected</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">Hit Rate</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white">—</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">Memory Usage</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white">—</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            GNews API Status
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">Today's Hits</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white">
                {hitStatus?.today_hits ?? '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">Remaining Quota</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white">
                {hitStatus?.remaining_hits}/{hitStatus?.max_hits ?? '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">Status</span>
              <span className="inline-flex items-center gap-2">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    hitStatus?.warning ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                ></span>
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {hitStatus?.warning ? 'Warning' : 'OK'}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
