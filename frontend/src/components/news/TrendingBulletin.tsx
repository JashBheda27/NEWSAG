import React, { useState, useEffect, useRef } from 'react';
import type { TrendingHeadline } from '../../services/news.service';
import { newsService } from '../../services/news.service';

interface TrendingBulletinProps {
  onError?: (msg: string) => void;
}

export const TrendingBulletin: React.FC<TrendingBulletinProps> = ({ onError }) => {
  const [headlines, setHeadlines] = useState<TrendingHeadline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const tickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const headlines = await newsService.getTrendingHeadlines(10);
        setHeadlines(headlines);
      } catch (err: any) {
        console.error('Trending headlines error:', err);
        onError?.('Failed to load trending headlines');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrending();
  }, []);

  // Auto-scroll through headlines
  useEffect(() => {
    if (headlines.length === 0 || isPaused) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % headlines.length);
    }, 4000); // Change headline every 4 seconds

    return () => clearInterval(interval);
  }, [headlines.length, isPaused]);

  const handleHeadlineClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  if (isLoading) {
    return (
      <div className="mb-8 animate-pulse">
        <div className="bg-gradient-to-r from-indigo-600/10 to-purple-600/10 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-2xl p-4 border border-indigo-200/50 dark:border-indigo-800/50">
          <div className="flex items-center gap-3">
            <div className="w-20 h-6 bg-indigo-200 dark:bg-indigo-800 rounded-full"></div>
            <div className="flex-1 h-5 bg-slate-200 dark:bg-slate-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (headlines.length === 0) {
    return null;
  }

  return (
    <div 
      className="mb-8 animate-slide-up"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-700 dark:via-indigo-700 dark:to-purple-700 rounded-2xl overflow-hidden border border-indigo-400/30 dark:border-indigo-500/30 shadow-lg shadow-indigo-500/20">
        {/* Top bar with label and navigation */}
        <div className="flex items-center justify-between px-4 py-2 bg-white/10 backdrop-blur-sm border-b border-white/20">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 px-3 py-1 bg-white text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">
              <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse"></span>
              LIVE TRENDS
            </span>
            <span className="text-white/90 text-xs font-medium hidden sm:block">
              Top stories from India
            </span>
          </div>
          
          {/* Progress indicators */}
          <div className="flex items-center gap-1.5">
            {headlines.slice(0, 8).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === activeIndex 
                    ? 'bg-white w-6' 
                    : 'bg-white/40 hover:bg-white/60 w-1.5'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Main ticker content */}
        <div 
          ref={tickerRef}
          className="relative h-16 overflow-hidden"
        >
          {headlines.map((headline, idx) => (
            <div
              key={headline.id}
              onClick={() => handleHeadlineClick(headline.url)}
              className={`absolute inset-0 flex items-center px-4 cursor-pointer transition-all duration-500 ease-out ${
                idx === activeIndex 
                  ? 'opacity-100 translate-y-0' 
                  : idx < activeIndex 
                    ? 'opacity-0 -translate-y-full'
                    : 'opacity-0 translate-y-full'
              }`}
            >
              <div className="flex items-center gap-4 w-full group">
                {/* Index number */}
                <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white/20 backdrop-blur-sm text-white rounded-lg text-sm font-black">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                
                {/* Headline text */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-semibold text-sm sm:text-base truncate group-hover:text-white/90 transition-colors">
                    {headline.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-white/80 text-xs font-semibold">
                      {headline.source}
                    </span>
                    <span className="text-white/50 text-xs">•</span>
                    <span className="text-white/70 text-xs">
                      {formatTimeAgo(headline.published_at)}
                    </span>
                  </div>
                </div>

                {/* Arrow indicator */}
                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom scrolling ticker (continuous) */}
        <div className="border-t border-white/20 bg-white/5 backdrop-blur-sm overflow-hidden">
          <div className="flex animate-scroll-x whitespace-nowrap py-2">
            {[...headlines, ...headlines].map((headline, idx) => (
              <a
                key={`ticker-${idx}`}
                href={headline.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 text-xs text-white/80 hover:text-white transition-colors"
              >
                <span className="text-white/60">●</span>
                <span className="truncate max-w-[300px]">{headline.title}</span>
                <span className="text-white/40">|</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
