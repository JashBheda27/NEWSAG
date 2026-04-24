import React from 'react';
import { CheckCircle2, Lock, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LoginRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryName?: string;
  message?: string;
  showFeatures?: boolean;
}

export const LoginRequiredModal: React.FC<LoginRequiredModalProps> = ({
  isOpen,
  onClose,
  categoryName = 'this content',
  message,
  showFeatures = true,
}) => {
  const navigate = useNavigate();
  const [isClosing, setIsClosing] = React.useState(false);

  const handleLoginClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsClosing(true);
    // Wait for fade-out animation, then navigate
    setTimeout(() => {
      onClose();
      navigate('/login');
    }, 200);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 dark:bg-black/60 z-40 backdrop-blur-md transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
        <div className="w-full max-w-sm bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden animate-slide-up border border-white/20 dark:border-slate-700/50">
          {/* Header with softer gradient */}
          <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 px-6 py-4 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            
            <div className="relative">
              <div className="w-14 h-14 bg-white/95 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-indigo-500/30">
                <Lock size={28} className="text-indigo-600" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-black text-white mb-0">{message ? 'Access Denied' : 'Login Required'}</h2>
              <p className="text-indigo-200/80 text-xs mt-1">{message ? 'Admin access required' : 'Unlock NewsAura features'}</p>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-3">
            {message ? (
              <p className="text-slate-700 dark:text-slate-300 text-center mb-3 text-sm leading-relaxed">
                {message}
              </p>
            ) : (
              <>
                <p className="text-slate-700 dark:text-slate-300 text-center mb-0 text-xs">
                  To access <span className="font-bold text-indigo-600 dark:text-indigo-400">{categoryName}</span>
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-center text-xs mt-1 mb-3">
                  Sign in to continue
                </p>
              </>
            )}

            {/* Features - only show if showFeatures is true and no custom message */}
            {showFeatures && !message && (
              <div className="space-y-1.5 mb-3">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50/80 dark:bg-slate-800/50">
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" aria-hidden="true" />
                <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">Access all categories</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50/80 dark:bg-slate-800/50">
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" aria-hidden="true" />
                <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">Save articles</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50/80 dark:bg-slate-800/50">
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" aria-hidden="true" />
                <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">AI recommendations</span>
              </div>
            </div>
            )}

            {/* Actions */}
            <div className="space-y-3 mt-3">
              <button
                onClick={handleLoginClick}
                className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 text-white font-bold text-sm hover:from-indigo-600 hover:via-purple-600 hover:to-indigo-700 transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/30"
              >
                Sign In / Sign Up
              </button>
              <button
                onClick={onClose}
                className="w-full px-4 py-2.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold text-sm hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition-all"
              >
                Continue with General News
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-2 bg-slate-50/80 dark:bg-slate-800/30 border-t border-slate-200/50 dark:border-slate-700/50 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
              <span className="inline-flex items-center gap-1">
                <Shield size={12} aria-hidden="true" />
                Your privacy protected
              </span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginRequiredModal;
