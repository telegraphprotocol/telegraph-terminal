"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TerminalLogEntry } from "@/lib/mock-data";

const DEFAULT_STREAM_DURATION_MS = 4000;
const DEFAULT_RECEIPT_DELAY_MS = 400;
const DEFAULT_THROTTLE_MS = 280;
const MIN_INTERVAL_MS = 120;
const MAX_INTERVAL_MS = 500;

export type TerminalPlaybackReceipt = Record<string, unknown>;

export type PlayScriptOptions = {
  /** When true, show receipt after the last log line (+ receiptDelayMs). */
  revealReceiptAfter?: boolean;
  /** Total time budget to reveal all entries (default 4000ms). */
  totalDurationMs?: number;
  /** Per-line interval override (ms). */
  intervalMs?: number;
  /** Delay before revealing receipt after last log. */
  receiptDelayMs?: number;
  /** Replace displayed logs (default) or append to existing. */
  mode?: "replace" | "append";
  /** Called once after the last log line and receipt (if any) are shown. */
  onComplete?: () => void;
};

/** `HH:mm:ss.SSS` at reveal time. */
export function formatRevealTimestamp(date = new Date()): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

function stampEntry(entry: Omit<TerminalLogEntry, "time">): TerminalLogEntry {
  return { ...entry, time: formatRevealTimestamp() };
}

function computeIntervalMs(entryCount: number, opts?: PlayScriptOptions): number {
  if (opts?.intervalMs != null && opts.intervalMs > 0) return opts.intervalMs;
  const total = opts?.totalDurationMs ?? DEFAULT_STREAM_DURATION_MS;
  const n = Math.max(entryCount, 1);
  return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, Math.floor(total / n)));
}

export function useTerminalPlayback<TReceipt extends TerminalPlaybackReceipt = TerminalPlaybackReceipt>() {
  const [displayedLogs, setDisplayedLogs] = useState<TerminalLogEntry[]>([]);
  const [displayedReceipt, setDisplayedReceipt] = useState<TReceipt | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const throttleQueueRef = useRef<TerminalLogEntry[]>([]);
  const throttleDrainScheduledRef = useRef(false);
  const lastAppendAtRef = useRef(0);
  const pendingReceiptRef = useRef<{ receipt: TReceipt; delayMs: number } | null>(null);
  const playbackCompleteRef = useRef<(() => void) | null>(null);

  const invokePlaybackComplete = useCallback(() => {
    const cb = playbackCompleteRef.current;
    playbackCompleteRef.current = null;
    cb?.();
  }, []);

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    throttleQueueRef.current = [];
    throttleDrainScheduledRef.current = false;
    pendingReceiptRef.current = null;
    playbackCompleteRef.current = null;
  }, []);

  const scheduleTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  const reset = useCallback(() => {
    clearAllTimeouts();
    setDisplayedLogs([]);
    setDisplayedReceipt(null);
    setIsRevealing(false);
    lastAppendAtRef.current = 0;
  }, [clearAllTimeouts]);

  const revealReceipt = useCallback(
    (
      receipt: TReceipt,
      delayMs = DEFAULT_RECEIPT_DELAY_MS,
      onComplete?: () => void,
    ) => {
      const finish = () => {
        setDisplayedReceipt(receipt);
        setIsRevealing(false);
        onComplete?.();
        invokePlaybackComplete();
      };
      if (delayMs <= 0) {
        finish();
        return;
      }
      scheduleTimeout(finish, delayMs);
    },
    [scheduleTimeout, invokePlaybackComplete],
  );

  const appendOne = useCallback((entry: TerminalLogEntry) => {
    setDisplayedLogs((prev) => [...prev, entry]);
  }, []);

  const playScript = useCallback(
    (
      entries: Array<Omit<TerminalLogEntry, "time">>,
      receipt?: TReceipt | null,
      opts?: PlayScriptOptions,
    ) => {
      clearAllTimeouts();
      playbackCompleteRef.current = opts?.onComplete ?? null;

      const stamped = entries.map((e) => stampEntry(e));
      const mode = opts?.mode ?? "replace";

      if (mode === "replace") {
        setDisplayedLogs([]);
        setDisplayedReceipt(null);
      }

      if (stamped.length === 0) {
        if (receipt && opts?.revealReceiptAfter) {
          setIsRevealing(true);
          revealReceipt(receipt, opts.receiptDelayMs ?? DEFAULT_RECEIPT_DELAY_MS);
        } else {
          setIsRevealing(false);
          invokePlaybackComplete();
        }
        return;
      }

      setIsRevealing(true);
      const interval = computeIntervalMs(stamped.length, opts);

      stamped.forEach((entry, i) => {
        scheduleTimeout(() => {
          appendOne(entry);
          if (i === stamped.length - 1) {
            if (receipt && opts?.revealReceiptAfter) {
              revealReceipt(receipt, opts.receiptDelayMs ?? DEFAULT_RECEIPT_DELAY_MS);
            } else {
              setIsRevealing(false);
              invokePlaybackComplete();
            }
          }
        }, (i + 1) * interval);
      });
    },
    [clearAllTimeouts, appendOne, revealReceipt, scheduleTimeout, invokePlaybackComplete],
  );

  const drainThrottleQueue = useCallback(
    (minGapMs: number) => {
      const queue = throttleQueueRef.current;
      if (queue.length === 0) {
        throttleDrainScheduledRef.current = false;
        if (pendingReceiptRef.current) {
          const { receipt, delayMs } = pendingReceiptRef.current;
          pendingReceiptRef.current = null;
          revealReceipt(receipt, delayMs);
        } else {
          setIsRevealing(false);
          invokePlaybackComplete();
        }
        return;
      }

      const now = Date.now();
      const elapsed = now - lastAppendAtRef.current;
      const wait = lastAppendAtRef.current === 0 ? 0 : Math.max(0, minGapMs - elapsed);

      scheduleTimeout(() => {
        const next = throttleQueueRef.current.shift();
        if (!next) {
          drainThrottleQueue(minGapMs);
          return;
        }
        lastAppendAtRef.current = Date.now();
        appendOne(next);
        drainThrottleQueue(minGapMs);
      }, wait);
    },
    [appendOne, revealReceipt, scheduleTimeout, invokePlaybackComplete],
  );

  const appendThrottled = useCallback(
    (entry: Omit<TerminalLogEntry, "time">, minGapMs = DEFAULT_THROTTLE_MS) => {
      setIsRevealing(true);
      throttleQueueRef.current.push(stampEntry(entry));
      if (!throttleDrainScheduledRef.current) {
        throttleDrainScheduledRef.current = true;
        drainThrottleQueue(minGapMs);
      }
    },
    [drainThrottleQueue],
  );

  const queueReceiptAfterThrottle = useCallback(
    (receipt: TReceipt, delayMs = DEFAULT_RECEIPT_DELAY_MS, onComplete?: () => void) => {
      if (onComplete) playbackCompleteRef.current = onComplete;
      if (throttleQueueRef.current.length > 0 || throttleDrainScheduledRef.current) {
        pendingReceiptRef.current = { receipt, delayMs };
        return;
      }
      revealReceipt(receipt, delayMs);
    },
    [revealReceipt],
  );

  useEffect(() => () => clearAllTimeouts(), [clearAllTimeouts]);

  return {
    displayedLogs,
    displayedReceipt,
    isRevealing,
    reset,
    playScript,
    appendThrottled,
    revealReceipt,
    queueReceiptAfterThrottle,
  };
}
