import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Home } from '../pages/Home';
import { Login } from '../pages/Login';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AdminRoute } from '../components/AdminRoute';
import { AdminDashboard } from '../pages/AdminDashboard';

// Lazy load non-critical pages for better initial load
const Profile = lazy(() => import('../pages/Profile').then(m => ({ default: m.Profile })));
const Bookmarks = lazy(() => import('../pages/Bookmarks').then(m => ({ default: m.Bookmarks })));
const ReadLater = lazy(() => import('../pages/ReadLater').then(m => ({ default: m.ReadLater })));

// Skeleton loader for lazy-loaded pages
const PageSkeleton = () => (
  <div className="w-full max-w-[96%] mx-auto px-4 py-12 animate-pulse">
    <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-lg w-64 mb-8"></div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700">
          <div className="h-48 bg-slate-200 dark:bg-slate-700"></div>
          <div className="p-4 space-y-3">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
            <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

interface AppRouterProps {
  showNotification: (msg: string, type?: 'error' | 'success' | 'warning' | 'info') => void;
}

export const AppRouter: React.FC<AppRouterProps> = ({ showNotification }) => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Home showNotification={showNotification} />} />
      <Route path="/login" element={<Login />} />

      {/* Protected Routes - Lazy Loaded with Suspense */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute requiredCategory="Profile">
            <Suspense fallback={<PageSkeleton />}>
              <Profile />
            </Suspense>
          </ProtectedRoute>
        }
      />

      <Route
        path="/bookmarks"
        element={
          <ProtectedRoute requiredCategory="Bookmarks">
            <Suspense fallback={<PageSkeleton />}>
              <Bookmarks />
            </Suspense>
          </ProtectedRoute>
        }
      />

      <Route
        path="/read-later"
        element={
          <ProtectedRoute requiredCategory="Read Later">
            <Suspense fallback={<PageSkeleton />}>
              <ReadLater />
            </Suspense>
          </ProtectedRoute>
        }
      />

      {/* Admin Routes */}
      <Route
        path="/admin/*"
        element={
          <AdminRoute>
            <AdminDashboard showNotification={showNotification} />
          </AdminRoute>
        }
      />

      {/* 404 */}
      <Route
        path="*"
        element={
          <div className="flex flex-col items-center justify-center py-20">
            <h2 className="text-4xl font-black mb-4">404</h2>
            <p className="text-slate-500">Page not found</p>
          </div>
        }
      />
    </Routes>
  );
};

export default AppRouter;