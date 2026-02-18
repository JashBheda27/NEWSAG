import React from 'react';
import { useNavigate } from 'react-router-dom';

interface LoginRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryName?: string;
}

export const LoginRequiredModal: React.FC<LoginRequiredModalProps> = ({
  isOpen,
  onClose,
  categoryName = 'this content',
}) => {
  const navigate = useNavigate();

  const handleLoginClick = () => {
    navigate('/login');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden animate-slide-up border border-white/20 dark:border-slate-700/50">
          {/* Header with softer gradient */}
          <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 px-8 py-10 text-center relative overflow-hidden">
            {/* Subtle pattern overlay */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            
            <div className="relative">
              <div className="w-18 h-18 bg-white/95 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl shadow-indigo-500/30">
                <svg className="w-9 h-9 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-black text-white mb-1">Login Required</h2>
              <p className="text-indigo-200/80 text-sm">Unlock the full NewsAura experience</p>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-8">
            <p className="text-slate-700 dark:text-slate-300 text-center mb-1 text-base">
              To access <span className="font-bold text-indigo-600 dark:text-indigo-400">{categoryName}</span>
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-center text-sm mb-8">
              Sign in or create an account to continue
            </p>

            {/* Features */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">Access all news categories</span>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">Save articles & bookmarks</span>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">Personalized AI recommendations</span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handleLoginClick}
                className="w-full px-6 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 text-white font-bold text-base hover:from-indigo-600 hover:via-purple-600 hover:to-indigo-700 transition-all active:scale-[0.98] shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/40"
              >
                Sign In / Sign Up
              </button>
              <button
                onClick={onClose}
                className="w-full px-6 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
              >
                Continue with General News
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-slate-50/80 dark:bg-slate-800/30 border-t border-slate-200/50 dark:border-slate-700/50 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              🔒 Your privacy is important. We never spam or sell your data.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginRequiredModal;
