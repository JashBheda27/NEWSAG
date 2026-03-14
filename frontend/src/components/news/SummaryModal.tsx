import React, { useEffect, useState } from 'react';
import { AlertTriangle, Heart, MessageCircle, RefreshCw } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { FormErrorMessage } from '../ui/FormErrorMessage';
import { newsService } from '../../services/news.service';
import type { SummaryData } from '../../types';
import { CommentSection } from './commentSection';
import { AudioPlayer } from './AudioPlayer';
import { SUPPORTED_LANGUAGES } from '../../utils/constants';

// Alias for backward compatibility
const LANGUAGES = SUPPORTED_LANGUAGES;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title?: string;
  description?: string;
  content?: string;
  articleId?: string;
  source?: string;
}

export const SummaryModal: React.FC<Props> = ({ isOpen, onClose, url, title, description, content, articleId, source }) => {
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [selectedLang, setSelectedLang] = useState('en');

  // Fetch summary (initial load in English)
  useEffect(() => {
    if (!isOpen) return;
    setSelectedLang('en');
    let mounted = true;
    const fetchSummary = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await newsService.getSummary(url, content, description, 'en', title, source);
        if (!mounted) return;
        setSummaryData(res);
      } catch (err: any) {
        if (!mounted) return;
        setError(err.message || 'Failed to generate summary.');
      } finally {
        if (!mounted) return;
        setIsLoading(false);
      }
    };
    fetchSummary();
    return () => { mounted = false; };
  }, [isOpen, url, content, description, title, source]);

  // Handle retry
  const handleRetry = async () => {
    setIsLoading(true);
    setError(null);
    setSummaryData(null);
    try {
      const res = await newsService.getSummary(url, content, description, selectedLang, title, source);
      setSummaryData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to generate summary.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle language change (translate existing summary)
  const handleLanguageChange = async (lang: string) => {
    if (lang === selectedLang) return;
    setSelectedLang(lang);
    setIsTranslating(true);
    setError(null);
    try {
      const res = await newsService.getSummary(url, content, description, lang, title, source);
      setSummaryData(res);
    } catch (err: any) {
      setError(err.message || 'Translation failed.');
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose}>
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-500 font-serif italic animate-pulse">Consulting the archives...</p>
        </div>
      ) : error ? (
        <div className="py-8 text-center font-serif">
          <h4 className="font-serif text-2xl mb-4">DISPATCH ERROR</h4>
          <div className="mb-6 max-w-xl mx-auto">
            <FormErrorMessage message={error} />
          </div>
          <Button onClick={onClose}>Close Bulletin</Button>
        </div>
      ) : (
        <div
          className="newspaper-paper border border-black w-full"
          style={{ outline: '1px solid #000', outlineOffset: '4px' }}
        >
          <div className="border p-3 sm:p-4" style={{ borderColor: '#d0d0d0', borderWidth: '1px' }}>
             <div className="text-center mb-3 pb-2 border-b-4 border-black border-double">
                <div className="mb-1">
                  <span className="text-[8px] font-normal uppercase tracking-widest italic">Special AI Edition</span>
                </div>
                <h4 className="font-serif text-xl sm:text-2xl font-normal tracking-tight uppercase mb-1">
                  {source || 'The Artificial Dispatch'}
                </h4>
             </div>

             <h2 className="font-serif text-lg sm:text-xl font-normal mb-2 leading-tight text-center italic">
               "{title}"
             </h2>

             {/* Language Selector */}
             <div className="flex items-center justify-center gap-2 mb-3">
               <label
                 htmlFor="lang-select"
                 className="text-[10px] uppercase tracking-widest font-normal"
                 style={{ color: '#555' }}
               >
                 Translate
               </label>
               <select
                 id="lang-select"
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

             <div 
               className={`text-base leading-snug text-justify md:columns-2 gap-6 whitespace-pre-wrap transition-opacity duration-300 ${isTranslating ? 'opacity-40' : ''} ${selectedLang === 'hi' ? 'devanagari' : ''}`}
               style={{ 
                 ...(selectedLang !== 'hi' ? { fontFamily: 'Georgia, "Times New Roman", serif' } : {}),
                 fontWeight: '300',
                 opacity: isTranslating ? 0.4 : 0.85,
                 color: '#333'
               }}
             >
               {summaryData?.summary || 'No summary available.'}
            </div>

            {/* Fallback indicator */}
            {summaryData?.is_fallback && (
              <div className="mt-2 flex items-center justify-between px-3 py-1.5 rounded border" style={{ backgroundColor: '#fffbe6', borderColor: '#ffe58f' }}>
                <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#ad6800' }}>
                    <AlertTriangle size={12} className="inline mr-1" aria-hidden="true" />
                    {summaryData.source === 'description' ? 'Limited summary (from description)' : summaryData.source === 'placeholder' ? 'Summary unavailable' : 'Partial summary'}
                </span>
                <button
                  onClick={handleRetry}
                  className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded hover:bg-amber-100 transition-colors"
                  style={{ color: '#ad6800' }}
                >
                    <RefreshCw size={12} className="inline mr-1" aria-hidden="true" /> Retry
                </button>
              </div>
            )}

            {/* Audio Player for TTS */}
            {summaryData?.audio_available && summaryData?.summary && (
              <div className="mt-3 pt-2 border-t border-slate-300 dark:border-slate-600">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] uppercase tracking-widest text-slate-500">Listen to Summary</span>
                </div>
                <AudioPlayer 
                  text={summaryData.summary} 
                  language={selectedLang}
                  className="bg-slate-50 dark:bg-slate-800/50 px-3 rounded-lg"
                />
              </div>
            )}
          
          <div className="border-t border-black mt-3" ></div>
          
          <div className="px-4 py-2" style={{backgroundColor: '#ececec'}}>
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsCommentsOpen(true)}
                  className="p-1.5 hover:opacity-60 transition-opacity"
                  title="Comments"
                  style={{color: '#333'}}
                >
                  <MessageCircle size={20} aria-hidden="true" />
                </button>
                <button 
                  onClick={() => setIsLiked(!isLiked)}
                  className="p-1.5 hover:opacity-60 transition-opacity"
                  title="Like"
                  style={{color: '#333'}}
                >
                  <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} aria-hidden="true" />
                </button>
              </div>

              <div className="h-4 w-px" style={{backgroundColor: '#333', opacity: 0.3}}></div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={onClose}
                  className="text-[10px] font-normal uppercase tracking-widest text-slate-700 dark:text-slate-200 px-2 py-1 rounded hover:text-white dark:hover:text-white hover:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors"
                >
                  Close
                </button>
                <button 
                  onClick={() => window.open(url, '_blank')}
                  className="text-[10px] font-normal uppercase tracking-widest border border-slate-800 dark:border-slate-200 px-3 py-1 text-slate-900 dark:text-slate-100 bg-[#ececec] dark:bg-slate-900/80 hover:text-white dark:hover:text-white hover:border-indigo-600 dark:hover:border-indigo-300 hover:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors"
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
    {isCommentsOpen && articleId && (
      <Modal isOpen={isCommentsOpen} onClose={() => setIsCommentsOpen(false)} title="Comments" accent="comments">
        <CommentSection articleId={articleId} articleTitle={title || ''} />
      </Modal>
    )}
    </>
  );
};
