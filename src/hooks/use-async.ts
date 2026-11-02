import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { toAppError, type AppError } from '@/lib/api';

export interface AsyncState<T> {
  data: T | undefined;
  error: AppError | null;
  loading: boolean;
  refreshing: boolean;
  reload: () => void;
  refresh: () => Promise<void>;
  setData: (updater: T | ((prev: T | undefined) => T)) => void;
}

/**
 * Carrega dados e recarrega silenciosamente quando a tela volta ao foco.
 * `refresh` é para pull-to-refresh (mantém os dados atuais visíveis).
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = [], { reloadOnFocus = true } = {}): AsyncState<T> {
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<AppError | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loaderRef = useRef(loader);
  const hasLoaded = useRef(false);

  useLayoutEffect(() => {
    loaderRef.current = loader;
  });

  const fetchData = useCallback(
    () =>
      loaderRef.current().then(
        (result) => {
          setDataState(result);
          setError(null);
          hasLoaded.current = true;
        },
        (err) => setError(toAppError(err)),
      ),
    [],
  );

  useEffect(() => {
    let active = true;
    loaderRef.current()
      .then(
        (result) => {
          if (!active) return;
          setDataState(result);
          setError(null);
          hasLoaded.current = true;
        },
        (err) => active && setError(toAppError(err)),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFocusEffect(
    useCallback(() => {
      if (reloadOnFocus && hasLoaded.current) fetchData();
    }, [reloadOnFocus, fetchData]),
  );

  const reload = useCallback(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const setData = useCallback((updater: T | ((prev: T | undefined) => T)) => {
    setDataState((prev) => (typeof updater === 'function' ? (updater as (p: T | undefined) => T)(prev) : updater));
  }, []);

  return { data, error, loading, refreshing, reload, refresh, setData };
}
