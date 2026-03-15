import React, { useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { LoginRequiredModal } from './ui/LoginRequiredModal';
import { Skeleton } from './ui/Skeleton';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredCategory?: string;
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredCategory,
  
}) => {
  const { isLoaded, isSignedIn } = useUser();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setShowModal(true);
    }
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <Skeleton variant="shimmer" className="w-10 h-10 rounded-full" />
          <Skeleton variant="shimmer" className="h-4 w-40" />
        </div>
      </div>
    );
  }

  // Block access and show modal
  if (!isSignedIn) {
    return (
      <LoginRequiredModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          navigate('/');
        }}
        categoryName={requiredCategory}
      />
    );
  }

  // User is signed in, show protected content
  return <>{children}</>;
};

export default ProtectedRoute;
