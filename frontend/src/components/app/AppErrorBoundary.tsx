import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Component } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  public state: AppErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Unexpected application error',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application error boundary caught an exception:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50 dark:bg-slate-950">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-md">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <AlertTriangle size={24} aria-hidden="true" />
              <h1 className="text-xl font-semibold">Something went wrong</h1>
            </div>

            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              The app hit an unexpected error. Try reloading this page.
            </p>

            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 break-words">
              {this.state.errorMessage}
            </p>

            <button
              type="button"
              onClick={this.handleRetry}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-indigo-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
              aria-label="Reload application"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Reload app
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
