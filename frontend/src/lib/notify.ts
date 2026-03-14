import { toast } from 'sonner';

type ToastType = 'success' | 'error' | 'warning' | 'info';

const TOAST_DURATION: Record<ToastType, number> = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 4000,
};

export const notify = {
  success: (message: string) => toast.success(message, { duration: TOAST_DURATION.success }),
  error: (message: string) => toast.error(message, { duration: TOAST_DURATION.error }),
  warning: (message: string) => toast.warning(message, { duration: TOAST_DURATION.warning }),
  info: (message: string) => toast.info(message, { duration: TOAST_DURATION.info }),
  loading: (message: string) => toast.loading(message),
  dismiss: (id?: string | number) => toast.dismiss(id),
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) =>
    toast.promise(promise, {
      loading: messages.loading,
      success: () => messages.success,
      error: () => messages.error,
    }),
};

export const notifyLegacy = (message: string, type: 'error' | 'success' = 'error') => {
  if (type === 'success') {
    notify.success(message);
    return;
  }

  notify.error(message);
};
