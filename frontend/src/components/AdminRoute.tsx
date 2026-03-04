import React, { useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { LoginRequiredModal } from './ui/LoginRequiredModal';

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
        <div className="relative w-16 h-16">
          <div
            className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full animate-spin"
            style={{ maskImage: 'conic-gradient(transparent 25%, black 75%)' }}
          ></div>
          <div className="absolute inset-2 bg-white dark:bg-slate-950 rounded-full"></div>
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
