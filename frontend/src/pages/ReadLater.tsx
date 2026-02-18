import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { ReadLaterItem } from '../types';
import { userService } from '../services/user.service';
import { Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { SummaryModal } from '../components/news/SummaryModal';
import { EmptyState } from '../components/ui/EmptyState';
import { formatRelativeTime } from '../utils/timeUtils';

export const ReadLater: React.FC = () => {
  const [items, setItems] = useState<ReadLaterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setIsLoading(true);
      try {
        const data = await userService.getReadLater();
        setItems(data);
      } catch (err) {
        console.error('Failed to fetch read later items:', err);
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, []);

  const handleRemove = async (id: string) => {
    try {
      await userService.removeFromReadLater(id);
      setItems(prev => prev.filter(b => b.id !== id));
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

  const openSummary = (item: ReadLaterItem) => {
    setModalUrl(item.url);
    setModalTitle(item.title);
    setModalDescription(undefined);
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
        ⏳ Read Later
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
          [...Array(3)].map((_, i) => (
            <motion.div 
              key={i} 
              className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.1 }}
            >
               <Skeleton className="h-6 w-full mb-2" />
               <Skeleton className="h-4 w-1/3" />
            </motion.div>
          ))
        ) : items.length > 0 ? (
          items.map((item, idx) => (
            <motion.div 
              key={item.id} 
              className="group bg-white dark:bg-slate-800 p-6 rounded-3xl flex items-center justify-between border border-slate-100 dark:border-slate-700 hover:shadow-lg hover:border-orange-200 dark:hover:border-orange-800 transition-all"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.3 }}
              whileHover={{ scale: 1.02 }}
            >
               <div>
                 <h3 className="font-bold text-lg leading-tight group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                   {item.title}
                 </h3>
                 <span className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2 block">
                   Added {formatRelativeTime(item.created_at)}
                 </span>
               </div>
               <div className="flex gap-2">
                 <Button size="sm" variant="ghost" onClick={() => openSummary(item)}>Read</Button>
                 <motion.button 
                   onClick={() => handleRemove(item.id)}
                   className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-full transition-colors"
                   aria-label="Remove from Read Later"
                   title="Remove"
                   whileHover={{ scale: 1.1 }}
                   whileTap={{ scale: 0.9 }}
                 >
                   <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                     <path d="M9 3a1 1 0 00-1 1v1H4a1 1 0 100 2h16a1 1 0 100-2h-4V4a1 1 0 00-1-1H9zM7 8v11a2 2 0 002 2h6a2 2 0 002-2V8H7zm3 2a1 1 0 012 0v7a1 1 0 11-2 0V10zm4 0a1 1 0 012 0v7a1 1 0 11-2 0V10z" />
                   </svg>
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