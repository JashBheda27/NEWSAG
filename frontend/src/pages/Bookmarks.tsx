import React, { useState, useEffect } from 'react';
import type { Bookmark } from '../types';
import { userService } from '../services/user.service';
import { Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';

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

  return (
    <div className="w-full max-w-[calc(100vw-120px)] lg:max-w-[calc(100vw-140px)] px-4 md:px-8 py-12 animate-fade-in">
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
                 <div className="flex gap-2">
                   <Button size="sm" variant="ghost" onClick={() => window.open(item.url, '_blank')}>View</Button>
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
      </div>
    </div>
  );
};