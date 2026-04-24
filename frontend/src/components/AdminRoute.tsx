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
 * Admin access is determined by checking Clerk user metadata for admin flag:
 * - Primary: Check metadata.admin (configured via CLERK_ADMIN_METADATA_KEY in backend)
 * - If not admin, block access and show permission denied modal
 * - Backend enforces final security check via require_admin on API calls
 * 
 * Frontend check is UX guard to prevent broken admin pages for non-admin users.
 * Backend remains the source of truth for admin authorization.
 */
export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { isLoaded, isSignedIn, user } = useUser();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [modalMessage, setModalMessage] = useState('');
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      if (!isSignedIn) {
        // Not logged in - show login modal
        setModalMessage('You must be signed in to access the admin dashboard.');
        setShowModal(true);
        setIsPermissionDenied(false);
        setIsCheckingAdmin(false);
      } else if (user) {
        // Check admin metadata in Clerk user object
        // Supports both boolean flags (admin=true) and string roles (role="admin")
        const metadata = user.publicMetadata as Record<string, unknown> | undefined;
        
        // Check both "admin" and "role" keys for flexibility
        const adminValue = metadata?.['admin'] || metadata?.['role'];
        
        // Debug log (can be removed after testing)
        console.log('[AdminRoute] User metadata:', { metadata, adminValue, userEmail: user.primaryEmailAddress?.emailAddress });
        
        // Check if metadata indicates admin (boolean true OR string "admin"/"owner")
        const isAdmin = adminValue === true || adminValue === 'admin' || adminValue === 'owner';
        console.log('[AdminRoute] Is admin?', isAdmin);
        
        if (!isAdmin) {
          // Signed in but not admin - show permission denied modal
          setModalMessage('You do not have admin permissions. Please contact an administrator for access.');
          setShowModal(true);
          setIsPermissionDenied(true);
        }
        setIsCheckingAdmin(false);
      } else {
        setIsCheckingAdmin(false);
      }
    }
  }, [isLoaded, isSignedIn, user]);

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

  // Block access if not signed in or not admin
  if (!isSignedIn || isPermissionDenied) {
    return (
      <LoginRequiredModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          navigate('/');
        }}
        categoryName="Admin Dashboard"
        message={isPermissionDenied ? modalMessage : undefined}
        showFeatures={!isPermissionDenied}
      />
    );
  }

  // User is signed in and has admin metadata - show admin content
  // Backend will enforce final security check via require_admin on API calls
  return <>{children}</>;
};

export default AdminRoute;
