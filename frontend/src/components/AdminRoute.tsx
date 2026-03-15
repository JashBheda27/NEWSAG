import React, { useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { LoginRequiredModal } from './ui/LoginRequiredModal';
import { Skeleton } from './ui/Skeleton';

interface AdminRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * AdminRoute: Ensures user is signed in AND has admin access.
 * 
 * Admin access is determined by:
 * 1. Backend validation via Authorization header (require_admin dependency)
 * 2. Frontend can optionally check user metadata if Clerk metadata is configured
 * 
 * For now, we rely on backend to enforce admin check on API calls.
 * Frontend shows admin content if user is authenticated.
 */
export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { isLoaded, isSignedIn } = useUser();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

  useEffect(() => {
    if (isLoaded) {
      if (!isSignedIn) {
        setShowModal(true);
        setIsCheckingAdmin(false);
      } else {
        // In a more advanced setup, you could check user metadata here
        // For now, we rely on backend to validate admin status on each API call
        setIsCheckingAdmin(false);
      }
    }
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || isCheckingAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <Skeleton variant="shimmer" className="w-10 h-10 rounded-full" />
          <Skeleton variant="shimmer" className="h-4 w-44" />
        </div>
      </div>
    );
  }

  // Block access if not signed in
  if (!isSignedIn) {
    return (
      <LoginRequiredModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          navigate('/');
        }}
        categoryName="Admin Dashboard"
      />
    );
  }

  // User is signed in; show admin content
  // Backend will enforce actual admin role on API calls
  return <>{children}</>;
};

export default AdminRoute;
