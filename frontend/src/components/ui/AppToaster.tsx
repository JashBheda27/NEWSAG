import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';

export const AppToaster = () => {
  const [isCompactViewport, setIsCompactViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1024;
  });

  useEffect(() => {
    const onResize = () => setIsCompactViewport(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <>
      <Toaster
        position={isCompactViewport ? 'top-right' : 'bottom-right'}
        richColors
        closeButton
        expand={false}
        toastOptions={{
          duration: 4000,
        }}
      />
      <style>{`
        @media (max-width: 1023px) {
          [data-sonner-toaster][data-y-position='top'][data-x-position='right'] {
            top: 76px !important;
            right: 12px !important;
            left: auto !important;
          }
        }
      `}</style>
    </>
  );
};
