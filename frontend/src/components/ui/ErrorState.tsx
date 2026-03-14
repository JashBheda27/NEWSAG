import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
}) => {
  return (
    <div className="w-full max-w-xl mx-auto py-14 px-6 bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-rose-200 dark:border-rose-900/20 text-center">
      <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300 flex items-center justify-center mx-auto mb-4">
        <AlertCircle size={28} aria-hidden="true" />
      </div>

      <h3 className="text-2xl font-black mb-2 text-gray-900 dark:text-white">{title}</h3>
      <p className="text-gray-700 dark:text-slate-400 mb-6">{message}</p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-indigo-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
        >
          <RotateCcw size={16} aria-hidden="true" />
          {retryLabel}
        </button>
      )}
    </div>
  );
};
