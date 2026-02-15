import React, { useState, useEffect } from 'react';
import type { Bookmark } from '../types';
import { userService } from '../services/user.service';
import { Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { SummaryModal } from '../components/news/SummaryModal';

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
    <div className="w-full max-w-[96%] mx-auto px-2 sm:px-3 md:px-4 py-8 sm:py-12 animate-fade-in">
      <h2 className="text-3xl font-black mb-8 flex items-center gap-4">
        🔖 Saved Stories
        <span className="text-sm font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-500">{bookmarks.length}</span>
      </h2>

      <div className="space-y-4">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 p-4 rounded-3xl flex gap-4 border border-slate-100 dark:border-slate-700 animate-pulse">
               <Skeleton className="w-24 h-24 rounded-2xl flex-shrink-0" />
               <div className="flex-1 space-y-3 pt-2">
                 <Skeleton className="h-6 w-full" />
                 <Skeleton className="h-4 w-2/3" />
               </div>
            </div>
          ))
        ) : bookmarks.length > 0 ? (
          bookmarks.map(item => (
            <div key={item.id} className="group bg-white dark:bg-slate-800 p-4 rounded-3xl flex gap-4 border border-slate-100 dark:border-slate-700 hover:shadow-lg transition-all animate-slide-up">
               {item.image_url && (
                 <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0">
                    <img src={item.image_url} className="w-full h-full object-cover" alt="" />
                 </div>
               )}
               <div className="flex flex-col justify-between flex-1 py-1">
                 <h3 className="font-bold text-lg leading-tight group-hover:text-indigo-600 transition-colors line-clamp-2">
                   {item.title}
                 </h3>
                 {item.description && (
                   <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-2 mb-2">
                     {item.description}
                   </p>
                 )}
                 <div className="flex gap-2">
                   <Button size="sm" variant="ghost" onClick={() => openSummary(item)}>View</Button>
                   <Button size="sm" variant="ghost" className="text-rose-500" onClick={() => handleRemove(item.id)}>Remove</Button>
                 </div>
               </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-700">
            <p className="text-slate-400 font-medium">No bookmarks yet. Save articles you love!</p>
          </div>
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
      </div>
    </div>
  );
};