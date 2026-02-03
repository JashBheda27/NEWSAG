import React, { useState, useEffect } from 'react';
import type { ReadLaterItem } from '../types';
import { userService } from '../services/user.service';
import { Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';

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

  return (
    <div className="w-full max-w-[calc(100vw-120px)] lg:max-w-[calc(100vw-140px)] px-4 md:px-8 py-12 animate-fade-in">
      <h2 className="text-3xl font-black mb-8 flex items-center gap-4">
        ⏳ Read Later
        <span className="text-sm font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-500">{items.length}</span>
      </h2>

      <div className="grid gap-4">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 animate-pulse">
               <Skeleton className="h-6 w-full mb-2" />
               <Skeleton className="h-4 w-1/3" />
            </div>
          ))
        ) : items.length > 0 ? (
          items.map(item => (
            <div key={item.id} className="group bg-white dark:bg-slate-800 p-6 rounded-3xl flex items-center justify-between border border-slate-100 dark:border-slate-700 hover:shadow-lg transition-all animate-slide-up">
               <div>
                 <h3 className="font-bold text-lg leading-tight group-hover:text-emerald-600 transition-colors">
                   {item.title}
                 </h3>
                 <span className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2 block">Added 2 hours ago</span>
               </div>
               <div className="flex gap-2">
                 <Button size="sm" variant="ghost" onClick={() => window.open(item.url, '_blank')}>Read</Button>
                 <button 
                  onClick={() => handleRemove(item.id)}
                  className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
               </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-700">
            <p className="text-slate-400 font-medium">Your queue is empty. Ready for some new stories?</p>
          </div>
        )}
      </div>
    </div>
  );
};