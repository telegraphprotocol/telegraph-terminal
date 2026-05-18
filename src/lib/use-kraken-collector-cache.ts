"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { DaemonResultItem } from "@/lib/engine-daemon-types";
import { KRAKEN_MIN_INTEREST } from "@/lib/kraken-dashboard-config";
import {
  ALERTS_LIMIT,
  buildApiCategoryParam,
  buildFeedViewFromPool,
  buildSlidingWindows,
  CATCHUP_LIMIT,
  COLLECTOR_POOL_TARGET,
  countDashboardFeedRowsInPool,
  fetchCollectorPoolByTimeWindows,
  fetchLatestCollectorPage,
  fetchNextWindowedCollectorPage,
  mergeCollectorIntoPool,
  resolveFeedSpanHours,
  topAlertsFromPool,
  type DashboardCategoryId,
  type DaemonSort,
  type TimeWindow,
  type WindowedPoolFetchResult,
} from "@/lib/kraken-dashboard-filters";

export type CacheStatus = "idle" | "bootstrapping" | "background" | "ready";

export type UseKrakenCollectorCacheParams = {
  sort: DaemonSort;
  sinceHours: number;
  useManualTimeRange: boolean;
  selectedCategories: readonly DashboardCategoryId[];
};

export function useKrakenCollectorCache({
  sort,
  sinceHours,
  useManualTimeRange,
  selectedCategories,
}: UseKrakenCollectorCacheParams) {
  const categorySet = useMemo(() => new Set(selectedCategories), [selectedCategories]);
  const autoCatchUp = !useManualTimeRange;
  const feedSpanHours = resolveFeedSpanHours(useManualTimeRange, sinceHours);

  const [cache, setCache] = useState<DaemonResultItem[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [status, setStatus] = useState<CacheStatus>("idle");
  const [apiExhausted, setApiExhausted] = useState(false);
  const [daemonTotal, setDaemonTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);

  const fetchGenerationRef = useRef(0);
  const windowIndexRef = useRef(0);
  const windowOffsetRef = useRef(0);
  const cacheReadyRef = useRef(false);
  const categorySetRef = useRef(categorySet);
  const sortRef = useRef(sort);
  const feedSpanHoursRef = useRef(feedSpanHours);
  categorySetRef.current = categorySet;
  sortRef.current = sort;
  feedSpanHoursRef.current = feedSpanHours;

  const skip = pageIndex * CATCHUP_LIMIT;
  const view = useMemo(
    () => buildFeedViewFromPool(cache, categorySet, sort, skip, CATCHUP_LIMIT),
    [cache, categorySet, sort, skip],
  );
  const topAlerts = useMemo(
    () => topAlertsFromPool(cache, categorySet, ALERTS_LIMIT),
    [cache, categorySet],
  );

  const applyFetchResult = useCallback((result: WindowedPoolFetchResult) => {
    windowIndexRef.current = result.nextWindowIndex;
    windowOffsetRef.current = result.nextOffset;
    setApiExhausted(result.exhausted);
    if (result.apiTotal > 0) {
      setDaemonTotal((prev) => Math.max(prev ?? 0, result.apiTotal));
    }
    setCache(result.pool);
  }, []);

  const buildFetchPage = useCallback(
    (window: TimeWindow, pageOffset: number) => {
      const categoryParam = buildApiCategoryParam(categorySet);
      return apiClient.fetchSignals({
        since: window.since,
        until: window.until,
        ...(categoryParam ? { category: categoryParam } : {}),
        sort,
        order: "desc",
        limit: CATCHUP_LIMIT,
        offset: pageOffset,
        ...(KRAKEN_MIN_INTEREST !== undefined ? { min_interest: KRAKEN_MIN_INTEREST } : {}),
      });
    },
    [categorySet, sort],
  );

  const resetAndBootstrap = useCallback(async () => {
    const gen = ++fetchGenerationRef.current;
    const spanHours = feedSpanHoursRef.current;
    setStatus("bootstrapping");
    setError(null);
    setCache([]);
    setPageIndex(0);
    windowIndexRef.current = 0;
    windowOffsetRef.current = 0;
    setApiExhausted(false);
    setDaemonTotal(null);
    cacheReadyRef.current = false;

    if (categorySetRef.current.size === 0) {
      setStatus("ready");
      return;
    }

    const shouldStopFirstScreen = (pool: DaemonResultItem[]) =>
      countDashboardFeedRowsInPool(pool, categorySetRef.current) >= CATCHUP_LIMIT;

    try {
      const healthPromise = apiClient.getHealth();

      const bootstrap = await fetchCollectorPoolByTimeWindows(buildFetchPage, {
        totalSpanHours: spanHours,
        shouldStop: shouldStopFirstScreen,
        onProgress: (pool) => {
          if (gen !== fetchGenerationRef.current) return;
          setCache(pool);
        },
      });

      if (gen !== fetchGenerationRef.current) return;
      applyFetchResult(bootstrap);
      cacheReadyRef.current = true;
      setStatus("ready");

      if (!bootstrap.exhausted && bootstrap.pool.length < COLLECTOR_POOL_TARGET) {
        setStatus("background");
        const background = await fetchCollectorPoolByTimeWindows(buildFetchPage, {
          totalSpanHours: spanHours,
          targetCount: COLLECTOR_POOL_TARGET,
          startWindowIndex: bootstrap.nextWindowIndex,
          startOffset: bootstrap.nextOffset,
          existing: bootstrap.pool,
          onProgress: (pool) => {
            if (gen !== fetchGenerationRef.current) return;
            setCache(pool);
          },
        });
        if (gen !== fetchGenerationRef.current) return;
        applyFetchResult(background);
      }

      const health = await healthPromise;
      if (gen !== fetchGenerationRef.current) return;
      if (health.status.toLowerCase() !== "ok") {
        throw new Error(`Daemon health check returned "${health.status}"`);
      }
    } catch (err) {
      if (gen !== fetchGenerationRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load daemon data");
    } finally {
      if (gen === fetchGenerationRef.current) {
        setStatus("ready");
      }
    }
  }, [applyFetchResult, buildFetchPage]);

  useEffect(() => {
    void resetAndBootstrap();
  }, [resetAndBootstrap, feedSpanHours]);

  useEffect(() => {
    if (pageIndex > 0 && view.items.length === 0 && view.filteredTotal > 0) {
      setPageIndex(0);
    }
  }, [pageIndex, view.items.length, view.filteredTotal]);

  const pollTick = useCallback(async () => {
    if (!cacheReadyRef.current || categorySetRef.current.size === 0) return;
    const gen = fetchGenerationRef.current;
    const latestWindow = buildSlidingWindows(feedSpanHoursRef.current)[0];
    if (!latestWindow) return;
    try {
      const { rows } = await fetchLatestCollectorPage((offset) =>
        buildFetchPage(latestWindow, offset),
      );
      if (gen !== fetchGenerationRef.current) return;
      if (rows.length === 0) return;
      setCache((prev) =>
        mergeCollectorIntoPool(prev, rows, { position: "prepend", cap: COLLECTOR_POOL_TARGET }),
      );
    } catch (err) {
      if (gen !== fetchGenerationRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to refresh feed");
    }
  }, [buildFetchPage]);

  const fetchNextApiPage = useCallback(async (): Promise<boolean> => {
    if (apiExhausted) return false;
    const gen = fetchGenerationRef.current;
    try {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const { rows, nextWindowIndex, nextOffset, exhausted } =
          await fetchNextWindowedCollectorPage(buildFetchPage, {
            totalSpanHours: feedSpanHoursRef.current,
            windowIndex: windowIndexRef.current,
            offset: windowOffsetRef.current,
          });
        if (gen !== fetchGenerationRef.current) return false;
        windowIndexRef.current = nextWindowIndex;
        windowOffsetRef.current = nextOffset;
        setApiExhausted(exhausted);
        if (rows.length > 0) {
          setCache((prev) =>
            mergeCollectorIntoPool(prev, rows, { position: "append", cap: COLLECTOR_POOL_TARGET }),
          );
          return true;
        }
        if (exhausted) return false;
      }
      return false;
    } catch (err) {
      if (gen !== fetchGenerationRef.current) return false;
      setError(err instanceof Error ? err.message : "Failed to load more signals");
      return false;
    }
  }, [apiExhausted, buildFetchPage]);

  const goToNextPage = useCallback(async () => {
    if (view.hasMore) {
      setPageIndex((p) => p + 1);
      return;
    }
    if (apiExhausted) return;
    setIsFetchingNextPage(true);
    try {
      const merged = await fetchNextApiPage();
      if (merged) setPageIndex((p) => p + 1);
    } finally {
      setIsFetchingNextPage(false);
    }
  }, [apiExhausted, fetchNextApiPage, view.hasMore]);

  const prevPage = useCallback(() => {
    setPageIndex((p) => Math.max(0, p - 1));
  }, []);

  const showTableSpinner = status === "bootstrapping" && view.items.length === 0;
  const firstScreenFull =
    view.items.length >= CATCHUP_LIMIT || (apiExhausted && view.filteredTotal > 0);
  const autoAdvanceEnabled =
    autoCatchUp && pageIndex === 0 && firstScreenFull && status !== "bootstrapping";
  const canGoNext =
    view.hasMore ||
    (!apiExhausted && !isFetchingNextPage && categorySet.size > 0);
  const isFillingFirstScreen =
    status === "bootstrapping" && pageIndex === 0 && view.items.length < CATCHUP_LIMIT;

  const footerStats = daemonTotal != null ? `${daemonTotal} daemon` : "";

  const footerExtra = useMemo(() => {
    const parts: string[] = [];
    if (autoCatchUp) parts.push(`batch ${pageIndex + 1}`);
    if (isFillingFirstScreen) parts.push(`filling ${view.items.length}/${CATCHUP_LIMIT}`);
    if (status === "background") parts.push("loading more…");
    if (autoCatchUp && pageIndex > 0) parts.push("auto-advance paused");
    return parts.length > 0 ? ` · ${parts.join(" · ")}` : "";
  }, [autoCatchUp, isFillingFirstScreen, pageIndex, status, view.items.length]);

  return {
    signals: view.items,
    filteredTotal: view.filteredTotal,
    cacheSize: cache.length,
    footerStats,
    topAlerts,
    pageIndex,
    autoCatchUp,
    showTableSpinner,
    autoAdvanceEnabled,
    canGoNext,
    isFetchingNextPage,
    error,
    footerExtra,
    pollTick,
    goToNextPage,
    prevPage,
    resetPageIndex: () => setPageIndex(0),
  };
}
