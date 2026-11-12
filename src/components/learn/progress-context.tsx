"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import type { CourseProgress, LessonProgress } from "@/lib/types";

interface Patch {
  lessonId: string;
  completed?: boolean;
  position?: number;
  duration?: number;
  page?: number;
  opened?: boolean;
}

interface ProgressApi {
  courseId: string;
  lessons: Record<string, LessonProgress>;
  get: (lessonId: string) => LessonProgress | undefined;
  setCompleted: (lessonId: string, completed: boolean) => void;
  savePosition: (lessonId: string, position: number, duration: number, flush?: boolean) => void;
  savePage: (lessonId: string, page: number) => void;
  markOpened: (lessonId: string) => void;
}

const Ctx = createContext<ProgressApi | null>(null);

export function useProgress() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProgress must be used inside <ProgressProvider>");
  return ctx;
}

export function ProgressProvider({
  courseId,
  initial,
  children,
}: {
  courseId: string;
  initial: CourseProgress;
  children: React.ReactNode;
}) {
  const [lessons, setLessons] = useState(initial.lessons);
  const queue = useRef(new Map<string, Patch>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = useCallback(
    (patches: Patch[], beacon = false) => {
      if (patches.length === 0) return;
      const url = `/api/progress/${courseId}`;
      const body = JSON.stringify(patches);
      if (beacon && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
        return;
      }
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    },
    [courseId],
  );

  const flush = useCallback(
    (beacon = false) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      const patches = [...queue.current.values()];
      queue.current.clear();
      send(patches, beacon);
    },
    [send],
  );

  const enqueue = useCallback(
    (patch: Patch, immediate = false) => {
      const prev = queue.current.get(patch.lessonId);
      queue.current.set(patch.lessonId, { ...prev, ...patch });
      if (immediate) flush();
      else if (!timer.current) timer.current = setTimeout(() => flush(), 4000);
    },
    [flush],
  );

  useEffect(() => {
    const onHide = () => flush(true);
    const onVisibility = () => document.visibilityState === "hidden" && onHide();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [flush]);

  const update = useCallback((lessonId: string, patch: Partial<LessonProgress>) => {
    setLessons((prev) => ({
      ...prev,
      [lessonId]: { ...prev[lessonId], ...patch, completed: patch.completed ?? prev[lessonId]?.completed ?? false, updatedAt: Date.now() },
    }));
  }, []);

  const api = useMemo<ProgressApi>(
    () => ({
      courseId,
      lessons,
      get: (id) => lessons[id],
      setCompleted: (lessonId, completed) => {
        update(lessonId, { completed });
        enqueue({ lessonId, completed }, true);
      },
      savePosition: (lessonId, position, duration, now) => {
        if (!Number.isFinite(position)) return;
        const d = Number.isFinite(duration) ? duration : undefined;
        update(lessonId, { position, duration: d });
        enqueue({ lessonId, position, duration: d }, now);
      },
      savePage: (lessonId, page) => {
        update(lessonId, { page });
        enqueue({ lessonId, page });
      },
      markOpened: (lessonId) => enqueue({ lessonId, opened: true }, true),
    }),
    [courseId, lessons, update, enqueue],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
