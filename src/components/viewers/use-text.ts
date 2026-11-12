"use client";

import { useEffect, useState } from "react";

import { useCourseSource } from "@/components/source/course-source";
import { isMissingFileError } from "@/lib/errors";

export const MAX_TEXT_BYTES = 3 * 1024 * 1024;

/** Read a course file as text (skipped when it's too large to show inline). */
export function useFileText(path: string, size: number, maxBytes = MAX_TEXT_BYTES) {
  const source = useCourseSource();
  const key = `${source.courseId}|${path}`;
  const tooLarge = size > maxBytes;
  const [result, setResult] = useState<{ key: string; text: string | null; error: string | null; missing: boolean } | null>(
    null,
  );

  useEffect(() => {
    if (tooLarge) return;
    let cancelled = false;
    source
      .readText(path)
      .then((text) => !cancelled && setResult({ key, text, error: null, missing: false }))
      .catch(
        (err) =>
          !cancelled && setResult({ key, text: null, error: String(err), missing: isMissingFileError(err) }),
      );
    return () => {
      cancelled = true;
    };
  }, [source, path, key, tooLarge]);

  if (tooLarge) return { text: null, error: "too-large", loading: false, missing: false };
  const current = result?.key === key ? result : null;
  return {
    text: current?.text ?? null,
    error: current?.error ?? null,
    loading: !current,
    missing: current?.missing ?? false,
  };
}
