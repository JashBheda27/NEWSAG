import { Toaster } from 'sonner';

export const AppToaster = () => {
  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      expand={false}
      toastOptions={{
        duration: 4000,
      }}
    />
  );
};
