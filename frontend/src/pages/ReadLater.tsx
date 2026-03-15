import React, { useCallback, useEffect, useState } from 'react';
import { Clock3, Eye, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ReadLaterItem } from '../types';
import { userService } from '../services/user.service';
import { Button } from '../components/ui/Button';
import { SummaryModal } from '../components/news/SummaryModal';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { notify } from '../lib/notify';
import { formatRelativeTime } from '../utils/timeUtils';
import { useAsyncState } from '../hooks/useAsyncState';
import { BookmarkSkeleton } from '../components/ui/skeletons/BookmarkSkeleton';

export const ReadLater: React.FC = () => {
  const {
    data: items,
    loading: isLoading,
    error: fetchError,
    executeLatest,
    setData: setItems,
  } = useAsyncState<ReadLaterItem[]>({
    initialData: [],
    getErrorMessage: (err) => err instanceof Error ? err.message : 'Failed to fetch read later items',
  });

  const fetchReadLater = useCallback(async () => {
    try {
      await executeLatest(() => userService.getReadLater());
    } catch (err) {
      setItems([]);
    }
  }, [executeLatest, setItems]);

  useEffect(() => {
    fetchReadLater();
  }, [fetchReadLater]);

  const handleRemove = async (id: string) => {
    try {
      await notify.promise(userService.removeFromReadLater(id), {
        loading: 'Removing from read later...',
        success: 'Removed from read later',
        error: 'Failed to remove article',
      });
      setItems(prev => prev.filter(b => b.id !== id));
    } catch {
      // Toast is already handled by notify.promise.
    }
  };

  const [summaryModal, setSummaryModal] = useState<{
    isOpen: boolean;
    url: string;
    title?: string;
    description?: string;
    articleId?: string;
    source?: string;
  }>({
    isOpen: false,
    url: '',
  });

  const openSummary = (item: ReadLaterItem) => {
    setSummaryModal({
      isOpen: true,
      url: item.url,
      title: item.title,
      description: undefined,
      articleId: item.article_id || item.id,
      source: item.source,
    });
  };

  return (
    <motion.div 
      className="w-full max-w-[96%] mx-auto px-2 sm:px-3 md:px-4 py-8 sm:py-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.h2 
        className="text-lg sm:text-xl lg:text-2xl font-black mb-8 flex items-center gap-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Clock3 size={30} aria-hidden="true" /> Read Later
        <motion.span 
          className="text-sm font-bold bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 px-3 py-1 rounded-full text-orange-600 dark:text-orange-400"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          {items.length}
        </motion.span>
      </motion.h2>

      <motion.div 
        className="grid gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        {isLoading ? (
          <BookmarkSkeleton rows={4} variant="readLater" />
        ) : fetchError ? (
          <ErrorState
            title="Unable to load read later list"
            message={fetchError}
            onRetry={fetchReadLater}
          />
        ) : items.length > 0 ? (
          items.map((item, idx) => (
            <motion.div 
              key={item.id} 
              className="group bg-white dark:bg-slate-800 p-6 rounded-3xl flex items-center justify-between border border-slate-100 dark:border-slate-700 hover:shadow-lg hover:border-orange-200 dark:hover:border-orange-800 transition-all"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.3 }}
            >
               <div>
                 <h3 className="font-bold text-lg leading-tight group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                   {item.title}
                 </h3>
                 <span className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2 block">
                   Added {formatRelativeTime(item.created_at)}
                 </span>
               </div>
               <div className="flex gap-2 shrink-0">
                 <Button size="sm" variant="ghost" className="sm:hidden h-10 w-10 !px-0" onClick={() => openSummary(item)} aria-label="Read article">
                   <Eye size={18} aria-hidden="true" />
                 </Button>
                 <Button size="sm" variant="ghost" className="hidden sm:inline-flex" onClick={() => openSummary(item)}>Read</Button>
                 <motion.button 
                   onClick={() => handleRemove(item.id)}
                   className="h-10 w-10 inline-flex items-center justify-center bg-rose-100 dark:bg-rose-900/30 border border-rose-300 dark:border-rose-700/60 hover:bg-rose-200 dark:hover:bg-rose-900/40 rounded-full transition-colors"
                   style={{ padding: 0, color: '#be123c' }}
                   aria-label="Remove from Read Later"
                   title="Remove"
                   whileTap={{ scale: 0.98 }}
                 >
                   <Trash2 size={18} strokeWidth={2.5} aria-hidden="true" style={{ color: '#be123c' }} />
                 </motion.button>
               </div>
            </motion.div>
          ))
        ) : (
          <EmptyState
            title="Read Later List Empty"
            description="Articles saved here are waiting for you to read when you have time"
            action={{ label: 'Find Articles', href: '/' }}
            illustration="readlater"
          />
        )}
        <SummaryModal
          isOpen={summaryModal.isOpen}
          onClose={() => setSummaryModal((prev) => ({ ...prev, isOpen: false }))}
          url={summaryModal.url}
          title={summaryModal.title}
          description={summaryModal.description}
          articleId={summaryModal.articleId}
          source={summaryModal.source}
        />
      </motion.div>
    </motion.div>
  );
};