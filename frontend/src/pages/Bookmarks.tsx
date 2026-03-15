import React, { useCallback, useEffect, useState } from 'react';
import { BookmarkX, Eye, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Bookmark } from '../types';
import { userService } from '../services/user.service';
import { Button } from '../components/ui/Button';
import { SummaryModal } from '../components/news/SummaryModal';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { notify } from '../lib/notify';
import { useAsyncState } from '../hooks/useAsyncState';
import { BookmarkSkeleton } from '../components/ui/skeletons/BookmarkSkeleton';

export const Bookmarks: React.FC = () => {
  const {
    data: bookmarks,
    loading: isLoading,
    error: fetchError,
    executeLatest,
    setData: setBookmarks,
  } = useAsyncState<Bookmark[]>({
    initialData: [],
    getErrorMessage: (err) => err instanceof Error ? err.message : 'Failed to fetch bookmarks',
  });

  const fetchBookmarks = useCallback(async () => {
    try {
      await executeLatest(() => userService.getBookmarks());
    } catch (err) {
      setBookmarks([]);
    }
  }, [executeLatest, setBookmarks]);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  const handleRemove = async (id: string) => {
    try {
      await notify.promise(userService.removeBookmark(id), {
        loading: 'Removing bookmark...',
        success: 'Bookmark removed',
        error: 'Failed to remove bookmark',
      });
      setBookmarks(prev => prev.filter(b => b.id !== id));
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

  const openSummary = (item: Bookmark) => {
    setSummaryModal({
      isOpen: true,
      url: item.url,
      title: item.title,
      description: item.description,
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
        <BookmarkX size={30} aria-hidden="true" /> Saved Stories
        <motion.span 
          className="text-sm font-bold bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 px-3 py-1 rounded-full text-indigo-600 dark:text-indigo-400"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          {bookmarks.length}
        </motion.span>
      </motion.h2>

      <motion.div 
        className="space-y-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        {isLoading ? (
          <BookmarkSkeleton rows={5} variant="bookmarks" />
        ) : fetchError ? (
          <ErrorState
            title="Unable to load bookmarks"
            message={fetchError}
            onRetry={fetchBookmarks}
          />
        ) : bookmarks.length > 0 ? (
          bookmarks.map((item, idx) => (
            <motion.div 
              key={item.id} 
              className="group bg-white dark:bg-slate-800 p-4 rounded-3xl flex flex-col sm:flex-row gap-4 border border-slate-100 dark:border-slate-700 hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-800 transition-all"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.3 }}
            >
               {item.image_url && (
                 <motion.div 
                   className="w-full h-44 sm:w-24 sm:h-24 rounded-2xl overflow-hidden flex-shrink-0"
                   whileHover={{ scale: 1.05 }}
                 >
                    <img src={item.image_url} className="w-full h-full object-cover" alt="" />
                 </motion.div>
               )}
               <div className="flex flex-col justify-between flex-1 py-1">
                 <h3 className="font-bold text-lg leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                   {item.title}
                 </h3>
                 {item.description && (
                   <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-2 mb-2">
                     {item.description}
                   </p>
                 )}
                 <div className="flex gap-2">
                   <Button size="sm" variant="ghost" className="sm:hidden h-10 w-10 !px-0" onClick={() => openSummary(item)} aria-label="View article">
                     <Eye size={18} aria-hidden="true" />
                   </Button>
                   <Button size="sm" variant="ghost" className="sm:hidden h-10 w-10 !px-0 text-rose-500" onClick={() => handleRemove(item.id)} aria-label="Remove bookmark">
                     <Trash2 size={18} aria-hidden="true" />
                   </Button>
                   <Button size="sm" variant="ghost" className="hidden sm:inline-flex" onClick={() => openSummary(item)}>View</Button>
                   <Button size="sm" variant="ghost" className="hidden sm:inline-flex text-rose-500" onClick={() => handleRemove(item.id)}>Remove</Button>
                 </div>
               </div>
            </motion.div>
          ))
        ) : (
          <EmptyState
            title="No Bookmarks Yet"
            description="Start saving articles you love to build your reading list"
            action={{ label: 'Browse News', href: '/' }}
            illustration="bookmarks"
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