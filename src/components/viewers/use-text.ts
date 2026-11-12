"use client";

import { useEffect, useState } from "react";

import { fileUrl } from "@/lib/files";

export const MAX_TEXT_BYTES = 3 * 1024 * 1024;

/** Fetch a course file as text (skipped when it's too large to show inline). */
export function useFileText(courseId: string, path: string, size: number, maxBytes = MAX_TEXT_BYTES) {
  const url = fileUrl(courseId, path);
  const tooLarge = size > maxBytes;
  const [result, setResult] = useState<{ url: string; text: string | null; error: string | null } | null>(null);

  useEffect(() => {
    if (tooLarge) return;
    const ctrl = new AbortController();
    fetch(url, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setResult({ url, text: await res.text(), error: null });
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) setResult({ url, text: null, error: String(err) });
      });
    return () => ctrl.abort();
  }, [url, tooLarge]);

  if (tooLarge) return { text: null, error: "too-large", loading: false };
  const current = result?.url === url ? result : null;
  return { text: current?.text ?? null, error: current?.error ?? null, loading: !current };
}
