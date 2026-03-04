import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/admin.service';

interface CredibilityQueueProps {
  showNotification: (msg: string, type?: 'error' | 'success') => void;
}

interface CredibilityReport {
  id: string;
  article_url: string;
  source_domain: string;
  title: string;
  ai_label: string;
  ai_score: number;
  user_reason?: string;
  report_count: number;
  created_at: string;
}

export const CredibilityQueue: React.FC<CredibilityQueueProps> = ({ showNotification }) => {
  const [reports, setReports] = useState<CredibilityReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const data = await adminApi.getPendingReports(50);
        setReports(data.reports);
        setLoading(false);
      } catch (err) {
        showNotification(`Failed to load credibility reports: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
        setLoading(false);
      }
    };

    fetchReports();
  }, [showNotification]);

  const handleVerify = async (reportId: string) => {
    setVerifying(reportId);
    try {
      await adminApi.verifyReport(reportId, true);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      showNotification('Report verified', 'success');
    } catch (err) {
      showNotification(`Failed to verify report: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setVerifying(null);
    }
  };

  const handleReject = async (reportId: string) => {
    setVerifying(reportId);
    try {
      await adminApi.verifyReport(reportId, false);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      showNotification('Report rejected', 'success');
    } catch (err) {
      showNotification(`Failed to reject report: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setVerifying(null);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading credibility reports...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Credibility Queue
          </h2>
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            {reports.length} pending
          </span>
        </div>

        {reports.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-5xl mx-auto mb-3 block opacity-50">✅</span>
            <p className="text-slate-500 dark:text-slate-400">No pending credibility reports</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                onClick={() => setSelectedReport(selectedReport === report.id ? null : report.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white mb-1">
                      {report.title.substring(0, 80)}...
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Source: {report.source_domain || 'Unknown'}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
                    <span className="inline mr-1">⏱️</span>
                    {report.report_count} reports
                  </span>
                </div>

                {selectedReport === report.id && (
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      <strong>AI Label:</strong> {report.ai_label} ({(report.ai_score * 100).toFixed(0)}%)
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      <strong>Article URL:</strong> <a href={report.article_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">{report.article_url}</a>
                    </p>
                    {report.user_reason && (
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        <strong>User Reason:</strong> {report.user_reason}
                      </p>
                    )}
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVerify(report.id);
                        }}
                        disabled={verifying === report.id}
                        className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center justify-center gap-2"
                      >
                        <span>✓</span>
                        {verifying === report.id ? 'Processing...' : 'Verify'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReject(report.id);
                        }}
                        disabled={verifying === report.id}
                        className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center justify-center gap-2"
                      >
                        <span>✗</span>
                        {verifying === report.id ? 'Processing...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CredibilityQueue;
