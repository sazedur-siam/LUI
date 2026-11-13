"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { rescanCourseAction } from "@/app/actions";
import { browserCaps } from "@/lib/client/caps";
import { isMissingFileError, MissingFileError } from "@/lib/errors";
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
  /** Whether the source can repackage (remux) a container the browser can't open. */
  canRemux: boolean;
  /** Re-read the course folder (after files were added, moved or renamed). */
  rescan?: () => Promise<void>;
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
  return useFileAccess(path, opts).url;
}

/**
 * URL for a course file plus whether the file has gone missing. In server mode
 * the URL is immediate and existence is checked with a HEAD request.
 */
export function useFileAccess(path: string, opts?: { download?: boolean; check?: boolean }) {
  const source = useCourseSource();
  const sync = source.urlSync?.(path, opts?.download) ?? null;
  const check = opts?.check ?? false;
  const key = `${source.courseId}|${path}`;
  const [resolved, setResolved] = useState<{ key: string; url: string | null; missing: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (sync) {
      if (!check) return;
      fetch(sync, { method: "HEAD" })
        .then((res) => !cancelled && setResolved({ key, url: sync, missing: res.status === 404 }))
        .catch(() => {});
    } else {
      source
        .getUrl(path)
        .then((url) => !cancelled && setResolved({ key, url, missing: false }))
        .catch((err) => !cancelled && setResolved({ key, url: null, missing: isMissingFileError(err) }));
    }
    return () => {
      cancelled = true;
    };
  }, [source, path, sync, check, key]);

  const current = resolved?.key === key ? resolved : null;
  return { url: sync ?? current?.url ?? null, missing: current?.missing ?? false };
}

/* ------------------------------ server source ----------------------------- */

export function createServerSource(courseId: string): CourseSource {
  return {
    kind: "server",
    courseId,
    basePath: `/course/${courseId}`,
    canConvert: true,
    canRemux: true,
    urlSync: (path, download) => fileUrl(courseId, path, { download }),
    getUrl: async (path) => fileUrl(courseId, path),
    readText: async (path) => {
      const res = await fetch(fileUrl(courseId, path));
      if (res.status === 404) throw new MissingFileError(path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    },
    mediaPlan: async ({ lessonId, path, resourcePath, force }) => {
      const qs = new URLSearchParams({ caps: browserCaps() });
      if (force) qs.set("force", force);
      if (resourcePath) qs.set("file", resourcePath);
      const res = await fetch(`/api/media/${courseId}/${lessonId}?${qs}`);
      const data = (await res.json()) as PlaybackPlan & { error?: string };
      if (res.status === 404) throw new MissingFileError(path);
      if (!res.ok) throw new Error(data.error ?? "Could not load this media file.");
      return data;
    },
    rescan: async () => {
      await rescanCourseAction(courseId);
      window.location.reload();
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
