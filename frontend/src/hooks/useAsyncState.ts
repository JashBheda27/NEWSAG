import { useCallback, useEffect, useRef, useState } from 'react';

interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

interface UseAsyncStateOptions<T> {
  initialData: T;
  getErrorMessage?: (error: unknown) => string;
}

type AsyncOperation<R> = (context: { signal: AbortSignal }) => Promise<R>;

const ABORT_REASON = 'Request cancelled in favor of a newer operation';

const isAbortError = (error: unknown) => {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }

  if (error && typeof error === 'object') {
    const maybeError = error as { name?: string; code?: string; message?: string };
    return (
      maybeError.name === 'CanceledError' ||
      maybeError.code === 'ERR_CANCELED' ||
      maybeError.message === 'canceled'
    );
  }

  return false;
};

const defaultErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : 'Unexpected error';
};

export const useAsyncState = <T,>({
  initialData,
  getErrorMessage = defaultErrorMessage,
}: UseAsyncStateOptions<T>) => {
  const isMountedRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);
  const operationIdRef = useRef(0);
  const getErrorMessageRef = useRef(getErrorMessage);

  const [state, setState] = useState<AsyncState<T>>({
    data: initialData,
    loading: false,
    error: null,
  });

  useEffect(() => {
    getErrorMessageRef.current = getErrorMessage;
  }, [getErrorMessage]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      controllerRef.current?.abort(ABORT_REASON);
    };
  }, []);

  const run = useCallback(async <R,>(
    operation: AsyncOperation<R>,
    mapResult?: (result: R) => T,
    cancelPrevious: boolean = false,
  ) => {
    const operationId = operationIdRef.current + 1;
    operationIdRef.current = operationId;

    if (cancelPrevious) {
      controllerRef.current?.abort(ABORT_REASON);
    }

    const controller = new AbortController();
    controllerRef.current = controller;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const result = await operation({ signal: controller.signal });

      if (!isMountedRef.current || operationId !== operationIdRef.current) {
        return result;
      }

      const nextData = mapResult ? mapResult(result) : (result as unknown as T);
      setState({ data: nextData, loading: false, error: null });
      return result;
    } catch (error) {
      if (isAbortError(error)) {
        if (isMountedRef.current && operationId === operationIdRef.current) {
          setState((prev) => ({ ...prev, loading: false }));
        }
        return undefined as R;
      }

      if (!isMountedRef.current || operationId !== operationIdRef.current) {
        return undefined as R;
      }

      const message = getErrorMessageRef.current(error);
      setState((prev) => ({ ...prev, loading: false, error: message }));
      throw error;
    }
  }, []);

  const execute = useCallback(async <R,>(operation: AsyncOperation<R>, mapResult?: (result: R) => T) => {
    return run(operation, mapResult, false);
  }, [run]);

  const executeLatest = useCallback(async <R,>(operation: AsyncOperation<R>, mapResult?: (result: R) => T) => {
    return run(operation, mapResult, true);
  }, [run]);

  const abortInFlight = useCallback(() => {
    controllerRef.current?.abort(ABORT_REASON);
  }, []);

  const setData = useCallback((updater: T | ((previous: T) => T)) => {
    setState((prev) => {
      const nextData = typeof updater === 'function'
        ? (updater as (previous: T) => T)(prev.data)
        : updater;

      return {
        ...prev,
        data: nextData,
      };
    });
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    execute,
    executeLatest,
    setData,
    clearError,
    abortInFlight,
  };
};
