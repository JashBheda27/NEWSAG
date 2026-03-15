import React, { useState, useEffect, useRef } from 'react';
import type { TrendingHeadline } from '../../services/news.service';
import { newsService } from '../../services/news.service';
import { Skeleton } from '../ui/Skeleton';

interface TrendingBulletinProps {
  onError?: (msg: string) => void;
}

export const TrendingBulletin: React.FC<TrendingBulletinProps> = ({ onError }) => {
  const [headlines, setHeadlines] = useState<TrendingHeadline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const onErrorRef = useRef(onError);

  // Change-detection ref (prevents unnecessary re-renders)
  const headlinesRef = useRef<TrendingHeadline[]>([]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    let cancelled = false;

    const fetchTrending = async () => {
      try {
        const newHeadlines = await newsService.getTrendingHeadlines(10);
        if (cancelled) return;

        const prevIds = headlinesRef.current.map(h => h.id).join(',');
        const nextIds = newHeadlines.map(h => h.id).join(',');

        if (prevIds !== nextIds) {
          headlinesRef.current = newHeadlines;
          setHeadlines(newHeadlines);
        }
      } catch (err) {
        console.error('Trending headlines error:', err);
        onErrorRef.current?.('Failed to load trending headlines');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchTrending();

    // Backend refreshes every 10 min → frontend poll safely every 5 min
    const interval = setInterval(fetchTrending, 5 * 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="mb-4">
        <Skeleton variant="shimmer" className="h-8 w-full" />
      </div>
    );
  }

  if (!headlines.length) return null;

  return (
    <div className="mb-8">
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl overflow-hidden border border-indigo-400/30 shadow-lg shadow-indigo-500/20">
        <div className="border-t border-white/20 overflow-hidden">
          {/* SINGLE headline → static */}
          {headlines.length === 1 ? (
            <div className="py-3 px-6 text-white/90 text-lg truncate">
              ● {headlines[0].title}
            </div>
          ) : (
            <div className="relative w-full overflow-hidden">
              <div className="animate-scroll-x whitespace-nowrap py-3 text-lg lg:text-xl">
                {[...headlines, ...headlines].map((headline, idx) => (
                  <a
                    key={`${headline.id}-${idx}`}
                    href={headline.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 px-6 text-white/90 hover:text-white transition-colors"
                  >
                    <span className="text-white/70">●</span>
                    <span className="truncate max-w-[240px] sm:max-w-[420px] md:max-w-[600px] lg:max-w-[900px]">
                      {headline.title}
                    </span>
                    <span className="text-white/40">|</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
