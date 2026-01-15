import { toast, type ExternalToast } from 'sonner';

type ToastOptions = Partial<ExternalToast> & {
  description?: string;
  id?: string;
};

const baseDuration = 4000;
const errorDuration = 5000;

const buildOptions = (opts?: ToastOptions, duration = baseDuration) => ({
  duration,
  ...opts,
});

export const toastSuccess = (title: string, opts?: ToastOptions) =>
  toast.success(title, buildOptions(opts));

export const toastInfo = (title: string, opts?: ToastOptions) =>
  toast.info(title, buildOptions(opts));

export const toastWarning = (title: string, opts?: ToastOptions) =>
  toast.warning(title, buildOptions(opts, errorDuration));

export const toastError = (title: string, opts?: ToastOptions) =>
  toast.error(title, buildOptions(opts, errorDuration));

export const toastApiError = (error: unknown, fallback: string, opts?: ToastOptions) => {
  let message: string | null = null;

  if (typeof error === 'string') {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (error && typeof error === 'object') {
    const maybeResponse = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
    const maybeMessage = (error as { message?: string }).message;
    const maybeError = (error as { error?: string }).error;
    message = maybeResponse || maybeMessage || maybeError || null;
  }

  return toastError(message ?? fallback, opts);
};
