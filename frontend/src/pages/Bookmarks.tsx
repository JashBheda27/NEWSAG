import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Bookmark } from '../types';
import { userService } from '../services/user.service';
import { Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { SummaryModal } from '../components/news/SummaryModal';
import { EmptyState } from '../components/ui/EmptyState';

export const Bookmarks: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setIsLoading(true);
      try {
        const data = await userService.getBookmarks();
        setBookmarks(data);
      } catch (err) {
        console.error('Failed to fetch bookmarks:', err);
        setBookmarks([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, []);

  const handleRemove = async (id: string) => {
    try {
      await userService.removeBookmark(id);
      setBookmarks(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalUrl, setModalUrl] = useState<string>('');
  const [modalTitle, setModalTitle] = useState<string | undefined>(undefined);
  const [modalDescription, setModalDescription] = useState<string | undefined>(undefined);
  const [modalArticleId, setModalArticleId] = useState<string | undefined>(undefined);
  const [modalSource, setModalSource] = useState<string | undefined>(undefined);

  const openSummary = (item: Bookmark) => {
    setModalUrl(item.url);
    setModalTitle(item.title);
    setModalDescription(item.description);
    setModalArticleId(item.article_id || item.id);
    setModalSource(item.source);
    setIsModalOpen(true);
  };

  return (
    <motion.div 
      className="w-full max-w-[96%] mx-auto px-2 sm:px-3 md:px-4 py-8 sm:py-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.h2 
        className="text-3xl font-black mb-8 flex items-center gap-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        🔖 Saved Stories
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
          [...Array(3)].map((_, i) => (
            <motion.div 
              key={i} 
              className="bg-white dark:bg-slate-800 p-4 rounded-3xl flex gap-4 border border-slate-100 dark:border-slate-700"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.1 }}
            >
               <Skeleton className="w-24 h-24 rounded-2xl flex-shrink-0" />
               <div className="flex-1 space-y-3 pt-2">
                 <Skeleton className="h-6 w-full" />
                 <Skeleton className="h-4 w-2/3" />
               </div>
            </motion.div>
          ))
        ) : bookmarks.length > 0 ? (
          bookmarks.map((item, idx) => (
            <motion.div 
              key={item.id} 
              className="group bg-white dark:bg-slate-800 p-4 rounded-3xl flex gap-4 border border-slate-100 dark:border-slate-700 hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-800 transition-all"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.3 }}
              whileHover={{ scale: 1.02 }}
            >
               {item.image_url && (
                 <motion.div 
                   className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0"
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
                   <Button size="sm" variant="ghost" onClick={() => openSummary(item)}>View</Button>
                   <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                     <Button size="sm" variant="ghost" className="text-rose-500" onClick={() => handleRemove(item.id)}>Remove</Button>
                   </motion.div>
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
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          url={modalUrl}
          title={modalTitle}
          description={modalDescription}
          articleId={modalArticleId}
          source={modalSource}
        />
      </motion.div>
    </motion.div>
  );
};