import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import type { Topic, Article } from '../types';
import { NewsGrid } from '../components/news/NewsGrid';
import { TrendingBulletin } from '../components/news/TrendingBulletin';
import { newsService } from '../services/news.service';
import { getErrorMessage } from '../services/api';
import { Button } from '../components/ui/Button';
import { LoginRequiredModal } from '../components/ui/LoginRequiredModal';

interface HomeProps {
  showNotification: (msg: string, type?: 'error' | 'success') => void;
}

const categories: { id: Topic; label: string }[] = [
  { id: 'general', label: '🇮🇳 General' },
  { id: 'nation', label: '🏛️ Nation' },
  { id: 'business', label: '💼 Business' },
  { id: 'technology', label: '🚀 Technology' },
  { id: 'sports', label: '⚽ Sports' },
  { id: 'entertainment', label: '🎬 Entertainment' },
  { id: 'health', label: '🏥 Health' },
];

export const Home: React.FC<HomeProps> = ({ showNotification }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFromUrl = (searchParams.get('category') as Topic) || 'general';
  const { isSignedIn, isLoaded } = useUser();
  
  const [category, setCategory] = useState<Topic>(categoryFromUrl);
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedCategoryName, setSelectedCategoryName] = useState('');
  
  // ✅ UI-only state: NEVER add to useEffect dependency array
  const [viewType, setViewType] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    setCategory(categoryFromUrl);
  }, [categoryFromUrl]);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn && categoryFromUrl !== 'general') {
      const selected = categories.find((cat) => cat.id === categoryFromUrl);
      setSelectedCategoryName(selected?.label?.split(' ')[1] || 'this category');
      setShowLoginModal(true);
      setSearchParams({ category: 'general' });
    }
  }, [categoryFromUrl, isLoaded, isSignedIn, setSearchParams]);

  const fetchNews = async (cat: Topic) => {
    setIsLoading(true);
    setError(null);
    try {
      const articles = await newsService.getNewsByTopic(cat);
      setArticles(articles);
      setIsFirstLoad(false);
      setRetryCount(0);
    } catch (err: any) {
      const errorMsg = getErrorMessage(err);
      // On first load, retry once after a delay instead of showing error immediately
      if (isFirstLoad && retryCount < 1) {
        setRetryCount(retryCount + 1);
        setTimeout(() => {
          fetchNews(cat);
        }, 3000);
      } else {
        setError(errorMsg);
        setIsFirstLoad(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn && category !== 'general') return;
    fetchNews(category);
  }, [category, isLoaded, isSignedIn]);

  return (
    <div className="w-full max-w-[calc(100vw-120px)] lg:max-w-[calc(100vw-140px)] px-4 md:px-8 py-12 animate-fade-in">
      {/* 🔥 Live Trending Headlines Bulletin */}
      <TrendingBulletin onError={(msg) => showNotification(msg, 'error')} />

      <header className="mb-12 mt-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-4xl font-black mb-2 flex items-center gap-3">
              {categories.find(c => c.id === category)?.label.split(' ')[1]} Feed
              <span className="inline-flex items-center justify-center px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-black">
                {articles.length}
              </span>
            </h2>
            
            
          </div>
          
          <div className="flex items-center gap-4">
            {/* ✅ Pure UI Toggle - NO API calls */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700 shadow-sm">
              <button
                onClick={() => setViewType('grid')}
                className={`px-3 py-1.5 rounded-lg transition-all font-bold text-xs flex items-center gap-1.5 ${
                  viewType === 'grid'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                }`}
                title="Grid View"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                onClick={() => setViewType('list')}
                className={`px-3 py-1.5 rounded-lg transition-all font-bold text-xs flex items-center gap-1.5 ${
                  viewType === 'list'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                }`}
                title="List View"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span className="hidden sm:inline">List</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {isFirstLoad && isLoading ? (
        <div className="max-w-xl mx-auto py-20 px-8 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-[2.5rem] shadow-2xl border border-blue-100 dark:border-indigo-800 text-center animate-slide-up">
          <div className="mb-6 flex justify-center">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-600 rounded-full animate-spin" style={{maskImage: 'conic-gradient(transparent 25%, black 75%)'}}></div>
              <div className="absolute inset-2 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-full"></div>
            </div>
          </div>
          <h3 className="text-2xl font-black mb-2 text-slate-900 dark:text-white">Warming up AI Engine</h3>
          <p className="text-slate-600 dark:text-slate-300 mb-2 text-sm">First load may take a few seconds while the model initializes...</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Thank you for your patience</p>
        </div>
      ) : error ? (
        <div className="max-w-xl mx-auto py-20 px-8 bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl border border-rose-100 dark:border-rose-900/20 text-center animate-slide-up">
          <h3 className="text-2xl font-black mb-4">Feed Unavailable</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-8">{error}</p>
          <Button size="lg" onClick={() => fetchNews(category)}>Try Again</Button>
        </div>
      ) : (
        <NewsGrid 
          articles={articles} 
          isLoading={isLoading} 
          viewType={viewType}
          onError={(msg) => showNotification(msg, 'error')} 
        />
      )}

      <LoginRequiredModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        categoryName={selectedCategoryName}
      />
    </div>
  );
};