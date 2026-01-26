import React, { useState, useEffect } from 'react';
import type { Topic, Article } from '../types';
import { NewsGrid } from '../components/news/NewsGrid';
import { newsService } from '../services/news.service';
import { getErrorMessage } from '../services/api';
import { Button } from '../components/ui/Button';

interface HomeProps {
  showNotification: (msg: string, type?: 'error' | 'success') => void;
}

export const Home: React.FC<HomeProps> = ({ showNotification }) => {
  const [category, setCategory] = useState<Topic>('general');
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // ✅ UI-only state: NEVER add to useEffect dependency array
  const [viewType, setViewType] = useState<'grid' | 'list'>('grid');

  const categories: { id: Topic; label: string }[] = [
    { id: 'general', label: '🇮🇳 General' },
    { id: 'nation', label: '🏛️ Nation' },
    { id: 'business', label: '💼 Business' },
    { id: 'technology', label: '🚀 Technology' },
    { id: 'sports', label: '⚽ Sports' },
    { id: 'entertainment', label: '🎬 Entertainment' },
    { id: 'health', label: '🏥 Health' },
  ];

  const fetchNews = async (cat: Topic) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await newsService.getNewsByTopic(cat);
      setArticles(result.articles);
      setIsDemoMode(result.isDemo);
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNews(category);
  }, [category]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 animate-fade-in">
      {isDemoMode && (
        <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-2xl flex items-center gap-3 text-amber-700 dark:text-amber-400 text-sm font-medium animate-slide-up">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Offline Demo: Viewing cached/mock data. Connect to <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">localhost:8000</code> for live news.</span>
        </div>
      )}

      {/* Categories Scroller */}
      <div className="flex gap-3 overflow-x-auto pb-6 no-scrollbar mb-12 animate-slide-up">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`whitespace-nowrap px-6 py-3 rounded-2xl text-sm font-black transition-all duration-300 transform active:scale-95 ${
              category === cat.id 
                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 -translate-y-1' 
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-sm'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <header className="mb-12 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-4xl font-black mb-2 flex items-center gap-3">
              {categories.find(c => c.id === category)?.label.split(' ')[1]} Feed
              <span className="inline-flex items-center justify-center px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-black">
                {articles.length}
              </span>
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Daily digest analyzed by Gemini Pro Vision.</p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* ✅ Pure UI Toggle - NO API calls */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setViewType('grid')}
                className={`px-3 py-1.5 rounded-lg transition-all font-bold text-xs ${
                  viewType === 'grid'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
                title="Grid View"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewType('list')}
                className={`px-3 py-1.5 rounded-lg transition-all font-bold text-xs ${
                  viewType === 'list'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
                title="List View"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            
            <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
               <span className={`w-2 h-2 rounded-full ${isDemoMode ? 'bg-slate-300 dark:bg-slate-700' : 'bg-emerald-500 animate-pulse'}`}></span>
               {isDemoMode ? 'Static Cache' : 'Real-time Feed'}
            </div>
          </div>
        </div>
      </header>

      {error ? (
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
      
      {!isLoading && articles.length > 0 && (
        <section className="mt-20 p-8 bg-gradient-to-br from-slate-900 to-slate-800 dark:from-indigo-950 dark:to-slate-900 rounded-[2.5rem] text-white overflow-hidden relative shadow-2xl animate-slide-up">
            <div className="relative z-10">
                <span className="inline-block px-3 py-1 bg-indigo-500/30 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">AI Trend Watch</span>
                <h3 className="text-3xl font-black mb-4 leading-tight max-w-2xl">Visual AI search queries have seen a 400% spike in the tech category this month.</h3>
                <p className="text-slate-300 mb-8 max-w-xl">Deep analysis shows users are moving away from keywords towards conversational and image-based news retrieval.</p>
                <Button variant="secondary" className="shadow-lg shadow-emerald-500/20">Read Analysis</Button>
            </div>
        </section>
      )}
    </div>
  );
};