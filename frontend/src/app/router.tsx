import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Home } from '../pages/Home';
import { Profile } from '../pages/Profile';
import { Bookmarks } from '../pages/Bookmarks';
import { ReadLater } from '../pages/ReadLater';

interface AppRouterProps {
  showNotification: (msg: string, type?: 'error' | 'success') => void;
}

export const AppRouter: React.FC<AppRouterProps> = ({ showNotification }) => {
  return (
    <Routes>
      <Route path="/" element={<Home showNotification={showNotification} />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/bookmarks" element={<Bookmarks />} />
      <Route path="/read-later" element={<ReadLater />} />
      <Route path="*" element={
        <div className="flex flex-col items-center justify-center py-20">
          <h2 className="text-4xl font-black mb-4">404</h2>
          <p className="text-slate-500">Page not found</p>
        </div>
      } />
    </Routes>
  );
};