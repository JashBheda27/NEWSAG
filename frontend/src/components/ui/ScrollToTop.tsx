import { useState, useEffect, useCallback, memo } from 'react';

/**
 * ScrollToTop - A performant, GPU-optimized scroll-to-top button
 * Uses transform and opacity for smooth animations without layout thrashing
 */
export const ScrollToTop = memo(() => {
  const [isVisible, setIsVisible] = useState(false);

  // Throttled scroll handler for performance
  useEffect(() => {
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsVisible(window.scrollY > 400);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, []);

  return (
    <button
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className={`
        fixed bottom-24 right-6 z-40
        w-12 h-12 
        bg-white dark:bg-slate-800 
        text-indigo-600 dark:text-indigo-400
        rounded-full 
        shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50
        border border-slate-200 dark:border-slate-700
        flex items-center justify-center
        transform-gpu transition-all duration-300 ease-out
        hover:scale-110 hover:shadow-xl hover:bg-indigo-50 dark:hover:bg-slate-700
        active:scale-95
        ${isVisible 
          ? 'translate-y-0 opacity-100 pointer-events-auto' 
          : 'translate-y-4 opacity-0 pointer-events-none'
        }
      `}
    >
      <svg 
        className="w-5 h-5" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          d="M5 10l7-7m0 0l7 7m-7-7v18" 
        />
      </svg>
    </button>
  );
});

ScrollToTop.displayName = 'ScrollToTop';
