import { AlertCircle } from 'lucide-react';

interface FormErrorMessageProps {
  message: string;
  compact?: boolean;
  className?: string;
}

export const FormErrorMessage: React.FC<FormErrorMessageProps> = ({
  message,
  compact = false,
  className = '',
}) => {
  if (!message) return null;

  if (compact) {
    return (
      <p
        role="alert"
        className={`inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 ${className}`.trim()}
      >
        <AlertCircle size={14} aria-hidden="true" />
        <span>{message}</span>
      </p>
    );
  }

  return (
    <div
      role="alert"
      className={`rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-4 py-3 ${className}`.trim()}
    >
      <p className="inline-flex items-start gap-2 text-sm font-medium text-rose-700 dark:text-rose-300">
        <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>{message}</span>
      </p>
    </div>
  );
};
