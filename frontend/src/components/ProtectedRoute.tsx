import React, { useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { LoginRequiredModal } from './ui/LoginRequiredModal';

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
