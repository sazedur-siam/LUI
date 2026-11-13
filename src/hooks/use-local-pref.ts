"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "lui:pref";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function read(key: string, fallback: boolean) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}

/** A boolean preference stored in localStorage, safe for server rendering. */
export function useLocalPref(key: string, fallback: boolean) {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback,
  );
  const set = useCallback(
    (next: boolean) => {
      try {
        localStorage.setItem(key, next ? "1" : "0");
      } catch {
        // Storage unavailable (private mode); the toggle just won't persist.
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  return [value, set] as const;
}

function readNumber(key: string, fallback: number) {
  try {
    const v = Number(localStorage.getItem(key));
    return localStorage.getItem(key) == null || !Number.isFinite(v) ? fallback : v;
  } catch {
    return fallback;
  }
}

/** A numeric preference stored in localStorage (e.g. playback speed), safe for server rendering. */
export function useLocalNumber(key: string, fallback: number) {
  const value = useSyncExternalStore(
    subscribe,
    () => readNumber(key, fallback),
    () => fallback,
  );
  const set = useCallback(
    (next: number) => {
      try {
        localStorage.setItem(key, String(next));
      } catch {
        // Storage unavailable; the value just won't persist.
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  return [value, set] as const;
}
