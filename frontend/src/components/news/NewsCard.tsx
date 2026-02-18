import React, { useState, useCallback, useMemo, memo, lazy, Suspense } from 'react';
import type { Article } from '../../types';
import { SentimentBadge } from './SentimentBadge';
import { CredibilityBadge } from './CredibilityBadge';
import { Button } from '../ui/Button';
import { newsService } from '../../services/news.service';
import { userService } from '../../services/user.service';
import { Modal } from '../ui/Modal';
import { formatRelativeTime, getReadTimeText } from '../../utils/timeUtils';
import { openChatWithArticle } from '../../utils/chatEvents';
import { SUPPORTED_LANGUAGES } from '../../utils/constants';

// Lazy load heavy components
const CommentSection = lazy(() => import('./commentSection').then(m => ({ default: m.CommentSection })));
const AudioPlayer = lazy(() => import('./AudioPlayer').then(m => ({ default: m.AudioPlayer })));

const SENTIMENT_OPTIONS = ['Positive', 'Neutral', 'Negative'] as const;

// Alias for backward compatibility
const LANGUAGES = SUPPORTED_LANGUAGES;

interface NewsCardProps {
  article: Article;
  viewType?: 'grid' | 'list';
  isBookmarked?: boolean;
  isInReadLater?: boolean;
  onError?: (message: string) => void;
}

// Memoized NewsCard to prevent unnecessary re-renders
export const NewsCard: React.FC<NewsCardProps> = memo(({ 
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
  const [isTranslating, setIsTranslating] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [selectedLang, setSelectedLang] = useState('en');
  const [summaryData, setSummaryData] = useState<any>(null);
  
  // ✅ ML Feedback State
  const [showFeedbackMenu, setShowFeedbackMenu] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<string | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  // Memoize computed values
  const articleId = useMemo(() => article.id || article.url, [article.id, article.url]);
  const sourceValue = useMemo(() => {
    return typeof article.source === 'string'
      ? article.source
      : (article.source as { name?: string })?.name || '';
  }, [article.source]);
  
  const imageUrl = useMemo(() => {
    return article.image_url || `https://picsum.photos/seed/${article.title.length}/600/400`;
  }, [article.image_url, article.title.length]);

  const handleSentimentFeedback = useCallback(async (userLabel: string) => {
    setIsSubmittingFeedback(true);
    try {
      await newsService.rateSentiment({
        article_id: articleId,
        article_url: article.url,
        title: article.title,
        description: article.description,
        ai_label: article.sentiment?.label || 'Neutral',
        ai_confidence: article.sentiment?.confidence || 0.5,
        user_label: userLabel,
      });
      setFeedbackSubmitted(userLabel);
      setShowFeedbackMenu(false);
    } catch (err: any) {
      onError?.(err.message || 'Failed to submit feedback');
    } finally {
      setIsSubmittingFeedback(false);
    }
  }, [articleId, article.url, article.title, article.description, article.sentiment, onError]);

  // ✅ Handle Report Misleading
  const handleReportMisleading = useCallback(async () => {
    setIsSubmittingFeedback(true);
    try {
      await newsService.reportMisleading({
        article_id: articleId,
        article_url: article.url,
        title: article.title,
        description: article.description,
        content: article.content,
        source_domain: sourceValue,
        ai_label: article.credibility?.label || 'Unknown',
        ai_score: article.credibility?.score || 0.5,
        ai_source: article.credibility?.source || 'unknown',
        reason: reportReason,
      });
      setReportSubmitted(true);
      setShowReportModal(false);
      setReportReason('');
    } catch (err: any) {
      onError?.(err.message || 'Failed to submit report');
    } finally {
      setIsSubmittingFeedback(false);
    }
  }, [articleId, article.url, article.title, article.description, article.content, sourceValue, article.credibility, reportReason, onError]);

  const handleSummary = useCallback(async () => {
    setIsModalOpen(true);
    setSelectedLang('en');
    if (!summary) {
      setIsLoadingSummary(true);
      setSummaryError(null);
      try {
        // ✅ Send both content and description so backend can choose best fallback
        const res = await newsService.getSummary(
          article.url,
          article.content,
          article.description,
          'en'
        );
        setSummary(res.summary);
        setSummaryData(res);
      } catch (err: any) {
        console.error("Summary failed", err);
        setSummaryError(err.message || "Failed to generate summary.");
      } finally {
        setIsLoadingSummary(false);
      }
    }
  }, [article.url, article.content, article.description, summary]);

  const handleLanguageChange = useCallback(async (lang: string) => {
    if (lang === selectedLang) return;
    setSelectedLang(lang);
    setIsTranslating(true);
    setSummaryError(null);
    try {
      const res = await newsService.getSummary(
        article.url,
        article.content,
        article.description,
        lang
      );
      setSummary(res.summary);
      setSummaryData(res);
    } catch (err: any) {
      setSummaryError(err.message || 'Translation failed.');
    } finally {
      setIsTranslating(false);
    }
  }, [article.url, article.content, article.description, selectedLang]);

  const toggleBookmark = useCallback(async () => {
    try {
      const articleIdValue = article.url || article.id;

      if (isBookmarked) {
        await userService.removeBookmarkByArticleId(articleIdValue);
      } else {
        await userService.addBookmark({
          article_id: articleIdValue,
          title: article.title,
          source: sourceValue,
          description: article.description,
          url: article.url,
          image_url: article.image_url,
          category: article.category,
        });
      }
      setIsBookmarked(!isBookmarked);
    } catch (err: any) {
      onError?.(err.message || "Action failed. Check your connection.");
    }
  }, [article.url, article.id, article.title, article.description, article.image_url, article.category, sourceValue, isBookmarked, onError]);

  const toggleReadLater = useCallback(async () => {
    try {
      if (isInReadLater) {
        await userService.removeFromReadLater(article.url);
      } else {
        await userService.addToReadLater({
          article_id: article.id,
          title: article.title,
          source: sourceValue,
          url: article.url,
          category: article.category,
        });
      }
      setIsInReadLater(!isInReadLater);
    } catch (err: any) {
      onError?.(err.message || "Action failed. Check your connection.");
    }
  }, [article.url, article.id, article.title, article.category, sourceValue, isInReadLater, onError]);

  // ✅ List View Layout (Horizontal)
  if (viewType === 'list') {
    return (
      <div className="group relative bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col sm:flex-row">
        {/* Image Section - Adaptive for small screens */}
        <div className="relative w-full sm:w-48 h-48 sm:h-40 overflow-hidden flex-shrink-0">
          <img 
            src={imageUrl} 
            alt={article.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 will-change-transform"
          />
          <div className="absolute top-2 left-2">
            <SentimentBadge sentiment={article.sentiment} />
          </div>
          <div className="absolute bottom-2 right-2">
            <CredibilityBadge credibility={article.credibility} />
          </div>
        </div>

        {/* Content Section */}
        <div className="p-4 sm:p-5 flex-grow flex flex-col">
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
            <div className="flex gap-1 group/action relative">
              <button 
                onClick={toggleBookmark}
                className={`p-2 rounded-full transition-all ${isBookmarked ? 'text-white bg-indigo-600 hover:bg-indigo-700' : 'text-slate-700 bg-white hover:bg-indigo-600 hover:text-white border border-slate-200 dark:border-slate-600'}`}
                title="Bookmark"
              >
                <svg className="w-4 h-4" fill={isBookmarked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>
              <button 
                onClick={toggleReadLater}
                className={`p-2 rounded-full transition-all ${isInReadLater ? 'text-white bg-indigo-600 hover:bg-indigo-700' : 'text-slate-700 bg-white hover:bg-indigo-600 hover:text-white border border-slate-200 dark:border-slate-600'}`}
                title="Read Later"
              >
                <svg className="w-4 h-4" fill={isInReadLater ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button 
                onClick={() => setIsCommentsOpen(true)}
                className="p-2 rounded-full transition-all text-slate-700 bg-white hover:bg-indigo-600 hover:text-white border border-slate-200 dark:border-slate-600"
                title="Comments"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </button>
              
              {/* ✅ ML Feedback Button (List View) */}
              <div className="relative">
                <button 
                  onClick={() => setShowFeedbackMenu(!showFeedbackMenu)}
                  className={`p-2 rounded-full transition-all ${
                    feedbackSubmitted 
                      ? 'text-white bg-green-600' 
                      : 'text-slate-700 bg-white hover:bg-indigo-600 hover:text-white border border-slate-200 dark:border-slate-600'
                  }`}
                  title={feedbackSubmitted ? `Rated: ${feedbackSubmitted}` : "Rate Sentiment"}
                >
                  {feedbackSubmitted ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                  )}
                </button>
                
                {showFeedbackMenu && !feedbackSubmitted && (
                  <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-600 py-1 z-50 min-w-[120px]">
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                      Rate Sentiment
                    </div>
                    {SENTIMENT_OPTIONS.map((option) => (
                      <button
                        key={option}
                        onClick={() => handleSentimentFeedback(option)}
                        disabled={isSubmittingFeedback}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 ${
                          article.sentiment?.label === option ? 'text-indigo-600 font-semibold' : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${
                          option === 'Positive' ? 'bg-green-500' : 
                          option === 'Negative' ? 'bg-red-500' : 'bg-slate-400'
                        }`}></span>
                        {option}
                        {article.sentiment?.label === option && <span className="text-[9px] opacity-60">(AI)</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* ✅ Report Button (List View) */}
              <button 
                onClick={() => setShowReportModal(true)}
                className={`p-2 rounded-full transition-all ${
                  reportSubmitted 
                    ? 'text-white bg-orange-600' 
                    : 'text-slate-700 bg-white hover:bg-red-600 hover:text-white border border-slate-200 dark:border-slate-600'
                }`}
                title={reportSubmitted ? "Report Submitted" : "Report Misleading"}
                disabled={reportSubmitted}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </button>
            </div>
            
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleSummary} className="text-indigo-600 font-bold dark:text-indigo-400 text-xs hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 transition-colors">
                ✨ AI Summary
              </Button>
              <button
                onClick={() => openChatWithArticle(article.id, article.title)}
                className="px-2 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 rounded-lg transition-colors"
                title="Ask AI about this article"
              >
                🤖 Ask AI
              </button>
            </div>
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
            <div
              className="newspaper-paper border border-black w-full"
              style={{ outline: '1px solid #000', outlineOffset: '4px' }}
            >
              <div className="border p-4 sm:p-6" style={{ borderColor: '#d0d0d0', borderWidth: '1px' }}>
                 {/* Masthead */}
                 <div className="text-center mb-6 pb-3 border-b-4 border-black border-double">
                    <div className="mb-1">
                      <span className="text-[8px] font-normal uppercase tracking-widest italic">Special AI Edition</span>
                    </div>
                    <h4 className="font-serif text-xl sm:text-2xl font-normal tracking-tight uppercase mb-1">
                      {typeof article.source === 'string'
                        ? article.source
                        : (article.source as { name?: string })?.name || 'The Artificial Dispatch'}
                    </h4>
                 </div>

                 {/* Headline */}
                 <h2 className="font-serif text-lg sm:text-xl font-normal mb-4 leading-tight text-center italic">
                   "{article.title}"
                 </h2>

                 {/* Language Selector */}
                 <div className="flex items-center justify-center gap-2 mb-4">
                   <label
                     htmlFor="lang-select-list"
                     className="text-[10px] uppercase tracking-widest font-normal"
                     style={{ color: '#555' }}
                   >
                     Translate
                   </label>
                   <select
                     id="lang-select-list"
                     value={selectedLang}
                     onChange={(e) => handleLanguageChange(e.target.value)}
                     disabled={isTranslating}
                     className="text-xs border border-slate-400 dark:border-slate-500 rounded px-2 py-1 bg-transparent font-serif focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50 text-slate-800 dark:text-slate-100"
                   >
                     {LANGUAGES.map((l) => (
                       <option key={l.code} value={l.code}>
                         {l.name}
                       </option>
                     ))}
                   </select>
                   {isTranslating && (
                     <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
                   )}
                   {summaryData?.translated && (
                     <span className="text-[9px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-semibold">
                       Translated
                     </span>
                   )}
                 </div>

                 {/* 2-Column Text Body */}
                 <div 
                   className={`text-sm leading-relaxed text-justify md:columns-2 gap-6 whitespace-pre-wrap transition-opacity duration-300 ${isTranslating ? 'opacity-40' : ''}`}
                   style={{ 
                     fontFamily: 'Georgia, "Times New Roman", serif',
                     fontWeight: '300',
                     opacity: isTranslating ? 0.4 : 0.85,
                     color: '#333'
                   }}
                 >
                   {summary}
                </div>

                {/* Audio Player for TTS */}
                {summaryData?.audio_available && summaryData?.summary && (
                  <div className="mt-4 pt-3 border-t border-slate-300 dark:border-slate-600">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[9px] uppercase tracking-widest text-slate-500">Listen to Summary</span>
                    </div>
                    <Suspense fallback={<div className="h-10 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse"></div>}>
                      <AudioPlayer 
                        text={summaryData.summary} 
                        language={selectedLang}
                        className="bg-slate-50 dark:bg-slate-800/50 px-3 rounded-lg"
                      />
                    </Suspense>
                  </div>
                )}
              
                {/* Horizontal Line Separator */}
                <div className="border-t border-black mt-6"></div>
              
                {/* Action Footer */}
                <div className="px-6 py-3" style={{backgroundColor: '#fdfcf0'}}>
                  <div className="flex items-center justify-center gap-4">
                    {/* Icon Buttons - Like & Comment */}
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setIsCommentsOpen(true)}
                        className="p-1.5 hover:opacity-60 transition-opacity"
                        title="Comments"
                        style={{color: '#333'}}
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => setIsLiked(!isLiked)}
                        className="p-1.5 hover:opacity-60 transition-opacity"
                        title="Like"
                        style={{color: '#333'}}
                      >
                        <svg className="w-5 h-5" fill={isLiked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                    </div>

                    <div className="h-4 w-px" style={{backgroundColor: '#333', opacity: 0.3}}></div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setIsModalOpen(false)}
                        className="text-[10px] font-normal uppercase tracking-widest text-slate-700 dark:text-slate-200 px-2 py-1 rounded hover:text-white dark:hover:text-white hover:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors"
                      >
                        Close
                      </button>
                      <button 
                        onClick={() => window.open(article.url, '_blank')}
                        className="text-[10px] font-normal uppercase tracking-widest border border-slate-800 dark:border-slate-200 px-3 py-1 text-slate-900 dark:text-slate-100 bg-[#fdfcf0] dark:bg-slate-900/80 hover:text-white dark:hover:text-white hover:border-indigo-600 dark:hover:border-indigo-300 hover:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors"
                      >
                        Read Full Article
                      </button>
                    </div>
                  </div>
                </div>
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
      <div className="relative h-56 overflow-hidden">
        <img 
          src={imageUrl} 
          alt={article.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 will-change-transform"
        />
        <div className="absolute top-2 left-2 flex gap-2">
          <SentimentBadge sentiment={article.sentiment} />
        </div>
        <div className="absolute top-2 right-2">
          <CredibilityBadge credibility={article.credibility} />
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
          <div className="flex gap-1 group/action relative">
            <button 
              onClick={toggleBookmark}
              className={`p-2 rounded-full transition-all ${isBookmarked ? 'text-white bg-indigo-600 hover:bg-indigo-700' : 'text-slate-700 bg-white hover:bg-indigo-600 hover:text-white border border-slate-200 dark:border-slate-600'}`}
              title="Bookmark"
            >
              <svg className="w-4 h-4" fill={isBookmarked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
            <button 
              onClick={toggleReadLater}
              className={`p-2 rounded-full transition-all ${isInReadLater ? 'text-white bg-indigo-600 hover:bg-indigo-700' : 'text-slate-700 bg-white hover:bg-indigo-600 hover:text-white border border-slate-200 dark:border-slate-600'}`}
              title="Read Later"
            >
              <svg className="w-4 h-4" fill={isInReadLater ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button 
              onClick={() => setIsCommentsOpen(true)}
              className="p-2 rounded-full transition-all text-slate-700 bg-white hover:bg-indigo-600 hover:text-white border border-slate-200 dark:border-slate-600"
              title="Comments"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
            
            {/* ✅ ML Feedback Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setShowFeedbackMenu(!showFeedbackMenu)}
                className={`p-2 rounded-full transition-all ${
                  feedbackSubmitted 
                    ? 'text-white bg-green-600' 
                    : 'text-slate-700 bg-white hover:bg-indigo-600 hover:text-white border border-slate-200 dark:border-slate-600'
                }`}
                title={feedbackSubmitted ? `Rated: ${feedbackSubmitted}` : "Rate Sentiment"}
              >
                {feedbackSubmitted ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                  </svg>
                )}
              </button>
              
              {/* Feedback Dropdown Menu */}
              {showFeedbackMenu && !feedbackSubmitted && (
                <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-600 py-1 z-50 min-w-[120px]">
                  <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                    Rate Sentiment
                  </div>
                  {SENTIMENT_OPTIONS.map((option) => (
                    <button
                      key={option}
                      onClick={() => handleSentimentFeedback(option)}
                      disabled={isSubmittingFeedback}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 ${
                        article.sentiment?.label === option ? 'text-indigo-600 font-semibold' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${
                        option === 'Positive' ? 'bg-green-500' : 
                        option === 'Negative' ? 'bg-red-500' : 'bg-slate-400'
                      }`}></span>
                      {option}
                      {article.sentiment?.label === option && <span className="text-[9px] opacity-60">(AI)</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* ✅ Report Misleading Button */}
            <button 
              onClick={() => setShowReportModal(true)}
              className={`p-2 rounded-full transition-all ${
                reportSubmitted 
                  ? 'text-white bg-orange-600' 
                  : 'text-slate-700 bg-white hover:bg-red-600 hover:text-white border border-slate-200 dark:border-slate-600'
              }`}
              title={reportSubmitted ? "Report Submitted" : "Report Misleading"}
              disabled={reportSubmitted}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </button>
          </div>
          
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleSummary} className="text-indigo-600 font-bold dark:text-indigo-400 text-xs hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 transition-colors">
              ✨ AI Summary
            </Button>
            <button
              onClick={() => openChatWithArticle(article.id, article.title)}
              className="px-2 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 rounded-lg transition-colors"
              title="Ask AI about this article"
            >
              🤖 Ask AI
            </button>
          </div>
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
          <div
            className="newspaper-paper border border-black w-full"
            style={{ outline: '1px solid #000', outlineOffset: '4px' }}
          >
            <div className="border p-4 sm:p-6" style={{ borderColor: '#d0d0d0', borderWidth: '1px' }}>
               {/* Masthead */}
               <div className="text-center mb-6 pb-3 border-b-4 border-black border-double">
                  <div className="mb-1">
                    <span className="text-[8px] font-normal uppercase tracking-widest italic">Special AI Edition</span>
                  </div>
                  <h4 className="font-serif text-xl sm:text-2xl font-normal tracking-tight uppercase mb-1">
                    {typeof article.source === 'string'
                      ? article.source
                      : (article.source as { name?: string })?.name || 'The Artificial Dispatch'}
                  </h4>
               </div>

               {/* Headline */}
               <h2 className="font-serif text-lg sm:text-xl font-normal mb-4 leading-tight text-center italic">
                 "{article.title}"
               </h2>

               {/* Language Selector */}
               <div className="flex items-center justify-center gap-2 mb-4">
                 <label
                   htmlFor="lang-select-grid"
                   className="text-[10px] uppercase tracking-widest font-normal"
                   style={{ color: '#555' }}
                 >
                   Translate
                 </label>
                 <select
                   id="lang-select-grid"
                   value={selectedLang}
                   onChange={(e) => handleLanguageChange(e.target.value)}
                   disabled={isTranslating}
                   className="text-xs border border-slate-400 dark:border-slate-500 rounded px-2 py-1 bg-transparent font-serif focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50 text-slate-800 dark:text-slate-100"
                 >
                   {LANGUAGES.map((l) => (
                     <option key={l.code} value={l.code}>
                       {l.name}
                     </option>
                   ))}
                 </select>
                 {isTranslating && (
                   <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
                 )}
                 {summaryData?.translated && (
                   <span className="text-[9px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-semibold">
                     Translated
                   </span>
                 )}
               </div>

               {/* 2-Column Text Body */}
               <div 
                 className={`text-sm leading-relaxed text-justify md:columns-2 gap-6 whitespace-pre-wrap transition-opacity duration-300 ${isTranslating ? 'opacity-40' : ''}`}
                 style={{ 
                   fontFamily: 'Georgia, "Times New Roman", serif',
                   fontWeight: '300',
                   opacity: isTranslating ? 0.4 : 0.85,
                   color: '#333'
                 }}
               >
                 {summary}
              </div>

              {/* Audio Player for TTS */}
              {summaryData?.audio_available && summaryData?.summary && (
                <div className="mt-4 pt-3 border-t border-slate-300 dark:border-slate-600">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] uppercase tracking-widest text-slate-500">Listen to Summary</span>
                  </div>
                  <Suspense fallback={<div className="h-10 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse"></div>}>
                    <AudioPlayer 
                      text={summaryData.summary} 
                      language={selectedLang}
                      className="bg-slate-50 dark:bg-slate-800/50 px-3 rounded-lg"
                    />
                  </Suspense>
                </div>
              )}
            
            {/* Horizontal Line Separator */}
            <div className="border-t border-black mt-6" ></div>
            
            {/* Action Footer */}
            <div className="px-6 py-3" style={{backgroundColor: '#fdfcf0'}}>
              <div className="flex items-center justify-center gap-4">
                {/* Icon Buttons - Like & Comment */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsCommentsOpen(true)}
                    className="p-1.5 hover:opacity-60 transition-opacity"
                    title="Comments"
                    style={{color: '#333'}}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => setIsLiked(!isLiked)}
                    className="p-1.5 hover:opacity-60 transition-opacity"
                    title="Like"
                    style={{color: '#333'}}
                  >
                    <svg className="w-5 h-5" fill={isLiked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                </div>

                <div className="h-4 w-px" style={{backgroundColor: '#333', opacity: 0.3}}></div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="text-[10px] font-normal uppercase tracking-widest text-slate-700 dark:text-slate-200 px-2 py-1 rounded hover:text-white dark:hover:text-white hover:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors"
                  >
                    Close
                  </button>
                  <button 
                    onClick={() => window.open(article.url, '_blank')}
                    className="text-[10px] font-normal uppercase tracking-widest border border-slate-800 dark:border-slate-200 px-3 py-1 text-slate-900 dark:text-slate-100 bg-[#fdfcf0] dark:bg-slate-900/80 hover:text-white dark:hover:text-white hover:border-indigo-600 dark:hover:border-indigo-300 hover:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors"
                  >
                    Read Full Article
                  </button>
                </div>
              </div>
            </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isCommentsOpen} onClose={() => setIsCommentsOpen(false)} title="💬 Comments">
        <Suspense fallback={<div className="py-8 flex items-center justify-center"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>}>
          <CommentSection articleId={article.id} articleTitle={article.title} />
        </Suspense>
      </Modal>

      {/* ✅ Report Misleading Modal */}
      <Modal isOpen={showReportModal} onClose={() => setShowReportModal(false)} title="⚠️ Report Misleading Content">
        <div className="p-4">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            Help improve our AI by reporting potentially misleading or inaccurate content.
          </p>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Why do you think this is misleading?</label>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Optional: Describe the issue..."
              className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowReportModal(false)}>
              Cancel
            </Button>
            <Button 
              size="sm" 
              onClick={handleReportMisleading}
              disabled={isSubmittingFeedback}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isSubmittingFeedback ? 'Submitting...' : 'Submit Report'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
});

// Display name for React DevTools
NewsCard.displayName = 'NewsCard';