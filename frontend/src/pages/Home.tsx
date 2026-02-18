import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
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
  const queryFromUrl = (searchParams.get('q') || '').trim();
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

  const fetchSuggestions = async (query: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await newsService.getSuggestions(query);
      setArticles(response.articles || []);
      setIsFirstLoad(false);
      setRetryCount(0);
    } catch {
      setArticles([]);
      setIsFirstLoad(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoaded) return;
    if (queryFromUrl.length >= 2) {
      fetchSuggestions(queryFromUrl);
      return;
    }
    if (!isSignedIn && category !== 'general') return;
    fetchNews(category);
  }, [category, isLoaded, isSignedIn, queryFromUrl]);

  return (
    <motion.div 
      className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* 🔥 Live Trending Headlines Bulletin */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <TrendingBulletin onError={(msg) => showNotification(msg, 'error')} />
      </motion.div>

      <motion.header 
        className="mb-8 mt-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.2 }}
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          {/* Section Header with accent bar */}
          <div className="relative pl-4 border-l-4 border-gradient-to-b from-indigo-500 to-purple-600" style={{ borderImage: 'linear-gradient(180deg, #6366f1 0%, #8b5cf6 100%) 1' }}>
            <h2 className="text-3xl sm:text-4xl font-black mb-1 flex items-center gap-4 text-slate-900 dark:text-white">
              {queryFromUrl.length >= 2 ? 'Search Results' : `${categories.find(c => c.id === category)?.label.split(' ')[1]} Feed`}
              <motion.span 
                className="inline-flex items-center justify-center px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-sm font-bold"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, delay: 0.3 }}
              >
                {articles.length} articles
              </motion.span>
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              {queryFromUrl.length >= 2 ? `Results for "${queryFromUrl}"` : 'Latest AI-powered news coverage'}
            </p>
          </div>
          
          <motion.div 
            className="flex items-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {/* ✅ Pill Style Segmented Control - NO API calls */}
            <div className="flex items-center bg-slate-100/80 dark:bg-slate-800/80 rounded-full p-1 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-inner">
              <motion.button
                onClick={() => setViewType('grid')}
                className={`relative px-4 py-2 rounded-full transition-all duration-300 font-semibold text-sm flex items-center gap-2 ${
                  viewType === 'grid'
                    ? 'text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                }`}
                title="Grid View"
                whileTap={{ scale: 0.95 }}
              >
                {viewType === 'grid' && (
                  <motion.div
                    layoutId="viewToggle"
                    className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full shadow-lg shadow-indigo-500/30"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <svg className="w-4 h-4 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span className="hidden sm:inline relative z-10">Grid</span>
              </motion.button>
              <motion.button
                onClick={() => setViewType('list')}
                className={`relative px-4 py-2 rounded-full transition-all duration-300 font-semibold text-sm flex items-center gap-2 ${
                  viewType === 'list'
                    ? 'text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                }`}
                title="List View"
                whileTap={{ scale: 0.95 }}
              >
                {viewType === 'list' && (
                  <motion.div
                    layoutId="viewToggle"
                    className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full shadow-lg shadow-indigo-500/30"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <svg className="w-4 h-4 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span className="hidden sm:inline relative z-10">List</span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      </motion.header>

      {isFirstLoad && isLoading ? (
        <motion.div 
          className="max-w-xl mx-auto py-20 px-8 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-[2.5rem] shadow-2xl border border-blue-100 dark:border-indigo-800 text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-6 flex justify-center">
            <motion.div 
              className="relative w-16 h-16"
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-600 rounded-full" style={{maskImage: 'conic-gradient(transparent 25%, black 75%)'}}></div>
              <div className="absolute inset-2 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-full"></div>
            </motion.div>
          </div>
          <h3 className="text-2xl font-black mb-2 text-slate-900 dark:text-white">Warming up AI Engine</h3>
          <p className="text-slate-600 dark:text-slate-300 mb-2 text-sm">First load may take a few seconds while the model initializes...</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Thank you for your patience</p>
        </motion.div>
      ) : error ? (
        <motion.div 
          className="max-w-xl mx-auto py-20 px-8 bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl border border-rose-100 dark:border-rose-900/20 text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <h3 className="text-2xl font-black mb-4">Feed Unavailable</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-8">{error}</p>
          <Button size="lg" onClick={() => fetchNews(category)}>Try Again</Button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <NewsGrid 
            articles={articles} 
            isLoading={isLoading} 
            viewType={viewType}
            onError={(msg) => showNotification(msg, 'error')} 
          />
        </motion.div>
      )}

      <LoginRequiredModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        categoryName={selectedCategoryName}
      />
    </motion.div>
  );
};