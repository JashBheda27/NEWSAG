import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { Grid3X3, Rows3 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Topic, Article } from '../types';
import { NewsGrid } from '../components/news/NewsGrid';
import { TrendingBulletin } from '../components/news/TrendingBulletin';
import { newsService } from '../services/news.service';
import { getErrorMessage } from '../services/api';
import { ErrorState } from '../components/ui/ErrorState';
import { LoginRequiredModal } from '../components/ui/LoginRequiredModal';
import { NEWS_CATEGORY_IDS } from '../utils/constants';

interface HomeProps {
  showNotification: (msg: string, type?: 'error' | 'success' | 'warning' | 'info') => void;
}

const categories = NEWS_CATEGORY_IDS as { id: Topic; label: string }[];

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
      setSelectedCategoryName(selected?.label || 'this category');
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
      className="w-full max-w-[1520px] mx-auto px-3 sm:px-4 lg:px-5 py-8 sm:py-12"
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
            <h2 className="text-3xl sm:text-4xl font-black mb-1 flex items-center gap-4 text-gray-900 dark:text-white">
              {queryFromUrl.length >= 2 ? 'Search Results' : `${categories.find(c => c.id === category)?.label} Feed`}
              <motion.span 
                className="inline-flex items-center justify-center px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-sm font-bold"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, delay: 0.3 }}
              >
                {articles.length} articles
              </motion.span>
            </h2>
            <p className="text-gray-700 dark:text-slate-400 text-sm">
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
            <div className="flex items-center bg-gray-100 dark:bg-slate-800/80 dark:backdrop-blur-sm rounded-full p-1 border border-gray-200 dark:border-slate-700/50 shadow-sm">
              <motion.button
                onClick={() => setViewType('grid')}
                className={`relative px-4 py-2 rounded-full transition-all duration-200 font-semibold text-sm flex items-center gap-2 ${
                  viewType === 'grid'
                    ? 'text-white'
                    : 'text-gray-600 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-300'
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
                <Grid3X3 size={16} className="relative z-10" aria-hidden="true" />
                <span className="hidden sm:inline relative z-10">Grid</span>
              </motion.button>
              <motion.button
                onClick={() => setViewType('list')}
                className={`relative px-4 py-2 rounded-full transition-all duration-200 font-semibold text-sm flex items-center gap-2 ${
                  viewType === 'list'
                    ? 'text-white'
                    : 'text-gray-600 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-300'
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
                <Rows3 size={16} className="relative z-10" aria-hidden="true" />
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
          <h3 className="text-2xl font-black mb-2 text-gray-900 dark:text-white">Warming up AI Engine</h3>
          <p className="text-gray-700 dark:text-slate-300 mb-2 text-sm">First load may take a few seconds while the model initializes...</p>
          <p className="text-xs text-gray-600 dark:text-slate-400">Thank you for your patience</p>
        </motion.div>
      ) : error ? (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
          <ErrorState
            title="Feed Unavailable"
            message={error}
            onRetry={() => fetchNews(category)}
          />
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