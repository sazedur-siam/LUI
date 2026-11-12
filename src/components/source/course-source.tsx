"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { browserCaps } from "@/lib/client/caps";
import { fileUrl } from "@/lib/files";
import type { PlaybackPlan } from "@/lib/types";

export interface MediaPlanRequest {
  lessonId: string;
  path: string;
  /** Set when playing a resource attached to the lesson. */
  resourcePath?: string;
  kind: "video" | "audio";
  force?: "remux" | "transcode" | null;
}

/**
 * Where a course's files come from. "server" reads the folder on the machine
 * running LUI (local mode); "device" reads a folder opened in this browser.
 */
export interface CourseSource {
  kind: "server" | "device";
  courseId: string;
  /** Route prefix for this course, e.g. "/course/abc" or "/device/abc". */
  basePath: string;
  /** Synchronous URL when one exists without async work (server mode). */
  urlSync?: (path: string, download?: boolean) => string;
  getUrl: (path: string) => Promise<string>;
  readText: (path: string) => Promise<string>;
  mediaPlan: (req: MediaPlanRequest) => Promise<PlaybackPlan>;
  /** Only available when the files live on this machine's disk. */
  openExternally?: (path: string, action: "open" | "reveal") => Promise<void>;
  /** Whether the source can transcode formats the browser can't play. */
  canConvert: boolean;
}

const Ctx = createContext<CourseSource | null>(null);

export function CourseSourceProvider({ source, children }: { source: CourseSource; children: React.ReactNode }) {
  return <Ctx.Provider value={source}>{children}</Ctx.Provider>;
}

export function useCourseSource() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCourseSource must be used inside a CourseSourceProvider");
  return ctx;
}

/** URL for a course file; null while it is being resolved (device mode). */
export function useFileUrl(path: string, opts?: { download?: boolean }) {
  const source = useCourseSource();
  const sync = source.urlSync?.(path, opts?.download) ?? null;
  const [resolved, setResolved] = useState<{ path: string; url: string } | null>(null);

  useEffect(() => {
    if (sync) return;
    let cancelled = false;
    source
      .getUrl(path)
      .then((url) => !cancelled && setResolved({ path, url }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [source, path, sync]);

  return sync ?? (resolved?.path === path ? resolved.url : null);
}

/* ------------------------------ server source ----------------------------- */

export function createServerSource(courseId: string): CourseSource {
  return {
    kind: "server",
    courseId,
    basePath: `/course/${courseId}`,
    canConvert: true,
    urlSync: (path, download) => fileUrl(courseId, path, { download }),
    getUrl: async (path) => fileUrl(courseId, path),
    readText: async (path) => {
      const res = await fetch(fileUrl(courseId, path));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    },
    mediaPlan: async ({ lessonId, resourcePath, force }) => {
      const qs = new URLSearchParams({ caps: browserCaps() });
      if (force) qs.set("force", force);
      if (resourcePath) qs.set("file", resourcePath);
      const res = await fetch(`/api/media/${courseId}/${lessonId}?${qs}`);
      const data = (await res.json()) as PlaybackPlan & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load this media file.");
      return data;
    },
    openExternally: async (path, action) => {
      const res = await fetch("/api/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, path, action }),
      });
      if (!res.ok) toast.error("Could not open the file");
    },
  };
}

export function ServerSourceProvider({ courseId, children }: { courseId: string; children: React.ReactNode }) {
  const source = useMemo(() => createServerSource(courseId), [courseId]);
  return <CourseSourceProvider source={source}>{children}</CourseSourceProvider>;
}
