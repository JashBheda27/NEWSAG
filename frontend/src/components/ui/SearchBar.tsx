import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { Article } from '../../types';
import { newsService } from '../../services/news.service';
import { useDebounce } from '../../hooks/useDebounce';
import { Skeleton } from './Skeleton';

export const SearchBar: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const debouncedValue = useDebounce(inputValue, 400);
  const [suggestions, setSuggestions] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const latestQuery = useRef('');
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const query = debouncedValue.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    let isActive = true;
    setLoading(true);
    latestQuery.current = query;

    newsService
      .getSuggestions(query)
      .then((res) => {
        if (!isActive || latestQuery.current !== query) return;
        setSuggestions(res.articles || []);
      })
      .catch(() => {
        if (!isActive) return;
        setSuggestions([]);
      })
      .finally(() => {
        if (!isActive) return;
        setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [debouncedValue]);

  useEffect(() => {
    if (!inputValue.trim()) {
      setSuggestions([]);
      setLoading(false);
      setIsOpen(false);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('q');
      setSearchParams(nextParams);
    }
  }, [inputValue, searchParams, setSearchParams]);

  const handleSelect = (article: Article) => {
    const value = article.title || '';
    setInputValue(value);
    setIsOpen(false);

    const nextParams = new URLSearchParams(searchParams);
    if (value.trim().length >= 2) {
      nextParams.set('q', value.trim());
    } else {
      nextParams.delete('q');
    }
    setSearchParams(nextParams);
  };

  return (
    <div className="flex-1 relative">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 120);
        }}
        placeholder="Search news..."
        className="w-full px-4 py-2.5 pl-10 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-sm text-gray-900 dark:text-slate-200 placeholder-gray-500 dark:placeholder-slate-500 transition-all"
      />
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
        aria-hidden="true"
      />

      {isOpen && (loading || inputValue.trim().length >= 2) && (
        <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg z-50 max-h-64 overflow-auto">
          {loading ? (
            <div className="p-3 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton variant="shimmer" className="w-10 h-10 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton variant="shimmer" className="h-3 w-full" />
                    <Skeleton variant="shimmer" className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : suggestions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-600">No results found</div>
          ) : (
            suggestions.map((item) => (
              <div
                key={item.id || item.url}
                onMouseDown={() => handleSelect(item)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer transition-colors duration-150"
              >
                <img
                  src={item.image_url || `https://picsum.photos/seed/${item.title?.length || 1}/80/80`}
                  alt={item.title}
                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-slate-200 truncate">
                    {item.title}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-slate-400 truncate">
                    {typeof item.source === 'string' ? item.source : (item.source as any)?.name}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
