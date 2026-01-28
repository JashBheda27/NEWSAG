import React, { useState } from 'react';
import type { Article } from '../../types';
import { SentimentBadge } from './SentimentBadge';
import { Button } from '../ui/Button';
import { newsService } from '../../services/news.service';
import { userService } from '../../services/user.service';
import { Modal } from '../ui/Modal';
import { CommentSection } from './commentSection';
import { formatRelativeTime, getReadTimeText } from '../../utils/timeUtils';

interface NewsCardProps {
  article: Article;
  viewType?: 'grid' | 'list';
  isBookmarked?: boolean;
  isInReadLater?: boolean;
  onError?: (message: string) => void;
}

export const NewsCard: React.FC<NewsCardProps> = ({ 
  article, 
  viewType = 'grid',
  isBookmarked: initialIsBookmarked, 
  isInReadLater: initialIsInReadLater, 
  onError 
}) => {
  const [isBookmarked, setIsBookmarked] = useState(initialIsBookmarked);
  const [isInReadLater, setIsInReadLater] = useState(initialIsInReadLater);
  const [summary, setSummary] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  const handleSummary = async () => {
    setIsModalOpen(true);
    if (!summary) {
      setIsLoadingSummary(true);
      setSummaryError(null);
      try {
        // ✅ Send both content and description so backend can choose best fallback
        const res = await newsService.getSummary(
          article.url,
          article.content,
          article.description
        );
        setSummary(res.summary);
      } catch (err: any) {
        console.error("Summary failed", err);
        setSummaryError(err.message || "Failed to generate summary.");
      } finally {
        setIsLoadingSummary(false);
      }
    }
  };

  const toggleBookmark = async () => {
    try {
      if (isBookmarked) {
        // Assume id is article_url for this example
        await userService.removeBookmark(article.url);
      } else {
        await userService.addBookmark({ article_id: article.id, title: article.title, source: article.source, url: article.url, image_url: article.image_url });
      }
      setIsBookmarked(!isBookmarked);
    } catch (err: any) {
      onError?.(err.message || "Action failed. Check your connection.");
    }
  };

  const toggleReadLater = async () => {
    try {
      if (isInReadLater) {
        await userService.removeFromReadLater(article.url);
      } else {
        await userService.addToReadLater({ article_id: article.id, title: article.title, source: article.source, url: article.url });
      }
      setIsInReadLater(!isInReadLater);
    } catch (err: any) {
      onError?.(err.message || "Action failed. Check your connection.");
    }
  };

  // ✅ List View Layout (Horizontal)
  if (viewType === 'list') {
    return (
      <div className="group relative bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-row">
        {/* Image Section - Smaller for list */}
        <div className="relative w-48 h-40 overflow-hidden flex-shrink-0">
          <img 
            src={article.image_url || `https://picsum.photos/seed/${article.title.length}/600/400`} 
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute top-2 left-2">
            <SentimentBadge sentiment={article.sentiment} />
          </div>
        </div>

        {/* Content Section */}
        <div className="p-5 flex-grow flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              {article.source}
            </span>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>{formatRelativeTime(article.published_at)}</span>
              {(article.description || article.content) && (
                <span className="text-slate-500">• {getReadTimeText(article.description || article.content)}</span>
              )}
            </div>
          </div>
          
          <h3 className="text-lg font-bold leading-tight mb-2 line-clamp-2 hover:text-indigo-600 transition-colors">
            <a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a>
          </h3>
          
          <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-2 mb-3">
            {article.description}
          </p>

          <div className="mt-auto flex items-center justify-between">
            <div className="flex gap-1">
              <button 
                onClick={toggleBookmark}
                className={`p-2 rounded-full transition-colors ${isBookmarked ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                title="Bookmark"
              >
                <svg className="w-4 h-4" fill={isBookmarked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>
              <button 
                onClick={toggleReadLater}
                className={`p-2 rounded-full transition-colors ${isInReadLater ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                title="Read Later"
              >
                <svg className="w-4 h-4" fill={isInReadLater ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button 
                onClick={() => setIsCommentsOpen(true)}
                className="p-2 rounded-full transition-colors text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                title="Comments"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </button>
            </div>
            
            <Button variant="ghost" size="sm" onClick={handleSummary} className="text-indigo-600 font-bold dark:text-indigo-400 text-xs">
              ✨ AI Summary
            </Button>
          </div>
        </div>

        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="✨ Article AI Summary">
          {isLoadingSummary ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-slate-500 animate-pulse font-medium">Reading between the lines...</p>
            </div>
          ) : summaryError ? (
            <div className="py-8 text-center">
               <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
               </div>
               <h4 className="font-bold text-lg mb-2">Summarization Failed</h4>
               <p className="text-slate-500 dark:text-slate-400 mb-6 px-4">{summaryError}</p>
               <div className="flex justify-center gap-3">
                  <Button variant="outline" onClick={() => setIsModalOpen(false)}>Close</Button>
                  <Button onClick={handleSummary}>Retry Summary</Button>
               </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                 <p className="text-slate-700 dark:text-slate-300 leading-relaxed italic">
                   "{summary}"
                 </p>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>Close</Button>
                <Button onClick={() => window.open(article.url, '_blank')}>Read Full Article</Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  // ✅ Grid View Layout (Vertical - Default)
  return (
    <div className="group relative bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col">
      {/* Image Section */}
      <div className="relative h-40 overflow-hidden">
        <img 
          src={article.image_url || `https://picsum.photos/seed/${article.title.length}/600/400`} 
          alt={article.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-2 left-2 flex gap-2">
          <SentimentBadge sentiment={article.sentiment} />
        </div>
      </div>

      {/* Content Section */}
      <div className="p-4 flex-grow flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            {article.source}
          </span>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{formatRelativeTime(article.published_at)}</span>
            {(article.description || article.content) && (
              <>
                <span>•</span>
                <span>{getReadTimeText(article.description || article.content)}</span>
              </>
            )}
          </div>
        </div>
        
        <h3 className="text-base font-bold leading-tight mb-2 line-clamp-2 hover:text-indigo-600 transition-colors">
          <a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a>
        </h3>
        
        <p className="text-slate-600 dark:text-slate-400 text-xs line-clamp-2 mb-3">
          {article.description}
        </p>

        <div className="mt-auto pt-3 flex items-center justify-between border-t border-slate-50 dark:border-slate-700">
          <div className="flex gap-1">
            <button 
              onClick={toggleBookmark}
              className={`p-2 rounded-full transition-colors ${isBookmarked ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
              title="Bookmark"
            >
              <svg className="w-4 h-4" fill={isBookmarked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
            <button 
              onClick={toggleReadLater}
              className={`p-2 rounded-full transition-colors ${isInReadLater ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
              title="Read Later"
            >
              <svg className="w-4 h-4" fill={isInReadLater ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button 
              onClick={() => setIsCommentsOpen(true)}
              className="p-2 rounded-full transition-colors text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              title="Comments"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
          </div>
          
          <Button variant="ghost" size="sm" onClick={handleSummary} className="text-indigo-600 font-bold dark:text-indigo-400 text-xs">
            ✨ AI Summary
          </Button>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        {isLoadingSummary ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-serif italic animate-pulse">Consulting the archives...</p>
          </div>
        ) : summaryError ? (
          <div className="py-8 text-center font-serif">
             <h4 className="font-serif text-2xl mb-4">DISPATCH ERROR</h4>
             <p className="text-slate-600 mb-6">{summaryError}</p>
             <Button onClick={() => setIsModalOpen(false)}>Close Bulletin</Button>
          </div>
        ) : (
          <div className="newspaper-paper p-1 border-2 border-black max-h-[80vh] overflow-y-auto">
            <div className="border border-black p-4 sm:p-6">
               {/* Masthead */}
               <div className="text-center mb-6 pb-3 border-b-4 border-black border-double">
                  <div className="mb-1">
                    <span className="text-[8px] font-bold uppercase tracking-widest italic">Special AI Edition</span>
                  </div>
                  <h4 className="font-serif text-xl sm:text-2xl font-bold tracking-tight uppercase mb-1">
                    {typeof article.source === 'string' ? article.source : article.source?.name || 'The Artificial Dispatch'}
                  </h4>
               </div>

               {/* Headline */}
               <h2 className="font-serif text-lg sm:text-xl font-semibold mb-4 leading-tight text-center italic">
                 "{article.title}"
               </h2>

               {/* 2-Column Text Body */}
               <div className="font-serif text-sm font-normal leading-relaxed text-justify md:columns-2 gap-6 dropped-cap whitespace-pre-wrap">
                 {summary}
               </div>

               {/* Traditional Rule Line & Actions */}
               <div className="mt-8 pt-4 border-t border-black flex flex-col sm:flex-row justify-between items-center gap-3">
                  <div className="text-[8px] font-bold uppercase tracking-widest italic opacity-60">
                    — End of Briefing —
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setIsModalOpen(false)}
                      className="text-xs font-bold uppercase tracking-widest border-b-2 border-black hover:opacity-60 transition-opacity"
                    >
                      Close
                    </button>
                    <button 
                      onClick={() => window.open(article.url, '_blank')}
                      className="text-xs font-bold uppercase tracking-widest border-2 border-black px-3 py-1.5 hover:bg-black hover:text-white transition-all"
                    >
                      Read Full Article
                    </button>
                  </div>
               </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isCommentsOpen} onClose={() => setIsCommentsOpen(false)} title="💬 Comments">
        <CommentSection articleId={article.id} articleTitle={article.title} />
      </Modal>
    </div>
  );
};