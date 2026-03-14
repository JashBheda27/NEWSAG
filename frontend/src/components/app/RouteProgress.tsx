import { useEffect } from 'react';
import NProgress from 'nprogress';
import { useLocation } from 'react-router-dom';

NProgress.configure({
  showSpinner: false,
  trickleSpeed: 120,
  minimum: 0.08,
});

export const RouteProgress = () => {
  const location = useLocation();

  useEffect(() => {
    NProgress.start();
    const doneTimer = window.setTimeout(() => {
      NProgress.done();
    }, 220);

    return () => {
      window.clearTimeout(doneTimer);
      NProgress.done();
    };
  }, [location.pathname, location.search]);

  return null;
};
