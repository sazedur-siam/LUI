"use client";

import { FolderOpenIcon, FolderSearchIcon, HardDriveIcon, Loader2Icon, LockOpenIcon } from "lucide-react";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { ProgressSaver } from "@/components/learn/progress-context";
import { type CourseSource, CourseSourceProvider } from "@/components/source/course-source";
import { StatusNotice } from "@/components/status-notice";
import { Button } from "@/components/ui/button";
import { browserCaps } from "@/lib/client/caps";
import { startBrowserRemux } from "@/lib/client/browser-remux";
import {
  type DeviceCourseRecord,
  getDeviceCourse,
  getDeviceDurations,
  getDeviceProgress,
  putDeviceDurations,
  saveDeviceProgress,
} from "@/lib/client/device-db";
import {
  type AccessState,
  checkAccess,
  getDeviceFile,
  getDeviceFileUrl,
  readDeviceText,
  requestAccess,
  rescanDeviceCourse,
} from "@/lib/client/device-files";
import { isMissingFileError } from "@/lib/errors";
import { extOf } from "@/lib/files";
import { flatLessons, locateLesson } from "@/lib/progress";
import { langFromName, subtitleLabel, toVtt } from "@/lib/subtitles";
import type { Course, CourseProgress, SubtitleTrack } from "@/lib/types";

import { useFolderPicker } from "./open-folder";

/* ------------------------------ device source ------------------------------ */

function createDeviceSource(record: DeviceCourseRecord): CourseSource {
  const id = record.id;
  // Sidecar subtitles converted to WebVTT blob URLs, built once per lesson file (plans are polled while repackaging).
  const subtitleCache = new Map<string, Promise<SubtitleTrack[]>>();
  const subtitlesFor = (lessonId: string, path: string) => {
    const lesson = locateLesson(record.course, lessonId)?.lesson;
    if (!lesson || lesson.path !== path || lesson.subtitles.length === 0) return Promise.resolve([]);
    let tracks = subtitleCache.get(path);
    if (!tracks) {
      tracks = Promise.all(
        lesson.subtitles.map(async (file, i) => {
          const text = await readDeviceText(id, file);
          const blob = new Blob([toVtt(text, file)], { type: "text/vtt" });
          return { label: subtitleLabel(file, i), lang: langFromName(file), src: URL.createObjectURL(blob) };
        }),
      );
      subtitleCache.set(path, tracks);
    }
    return tracks;
  };
  return {
    rescan: async () => {
      const next = await rescanDeviceCourse(record);
      // Without a remembered folder (Safari / Firefox) the course page asks for it again.
      window.location.href = next ? window.location.href : `/device/${id}`;
    },
    kind: "device",
    courseId: id,
    basePath: `/device/${id}`,
    canConvert: false,
    canRemux: true,
    getUrl: (path) => getDeviceFileUrl(id, path),
    readText: (path) => readDeviceText(id, path),
    mediaPlan: async ({ lessonId, path, kind, force }) => {
      const ext = extOf(path);
      const base = {
        type: "",
        duration: null,
        hasVideo: kind === "video",
        subtitles: await subtitlesFor(lessonId, path),
      };
      // Repackage to MP4 in the browser when asked to, or when this browser can't open Matroska at all.
      const cannotOpen = (ext === "mkv" || ext === "mka") && !browserCaps().split(",").includes("mkv");
      if (force === "remux" || force === "transcode" || cannotOpen) {
        const job = startBrowserRemux(`${id}|${path}`, await getDeviceFile(id, path), { audioOnly: kind === "audio" });
        return {
          ...base,
          mode: "remux",
          ready: job.status === "done",
          progress: job.progress,
          src: job.url ?? "",
          error: job.status === "error" ? job.error : undefined,
          summary: `${ext.toUpperCase()} → MP4`,
        };
      }
      return { ...base, mode: "direct", ready: true, src: await getDeviceFileUrl(id, path), summary: ext.toUpperCase() };
    },
  };
}

/* ------------------------------ durations ---------------------------------- */

function measure(url: string, audio: boolean) {
  return new Promise<number>((resolve) => {
    const el = document.createElement(audio ? "audio" : "video");
    const finish = (d: number) => {
      clearTimeout(timer);
      el.removeAttribute("src");
      el.load();
      resolve(d);
    };
    const timer = setTimeout(() => finish(0), 10_000);
    el.preload = "metadata";
    el.muted = true;
    el.onloadedmetadata = () => finish(Number.isFinite(el.duration) ? el.duration : 0);
    el.onerror = () => finish(0);
    el.src = url;
  });
}

async function containerDuration(file: Blob) {
  try {
    const { ALL_FORMATS, BlobSource, Input } = await import("mediabunny");
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const d = await input.computeDuration();
    return Number.isFinite(d) ? d : 0;
  } catch {
    return 0;
  }
}

/** Known durations, measuring missing ones in the background (0 = couldn't be read). */
function useDeviceDurations(record: DeviceCourseRecord | null, enabled: boolean) {
  const [state, setState] = useState<{ id: string; map: Record<string, number>; pending: boolean } | null>(null);

  useEffect(() => {
    if (!record || !enabled) return;
    let cancelled = false;
    void (async () => {
      const map = { ...(await getDeviceDurations(record.id)) };
      const missing = flatLessons(record.course).filter(
        (l) => (l.kind === "video" || l.kind === "audio") && !(l.id in map),
      );
      if (cancelled) return;
      setState({ id: record.id, map: { ...map }, pending: missing.length > 0 });
      let sinceSave = 0;
      const worker = async () => {
        for (let l = missing.shift(); l && !cancelled; l = missing.shift()) {
          try {
            map[l.id] = await measure(await getDeviceFileUrl(record.id, l.path), l.kind === "audio");
            // Browsers that can't open the container (e.g. MKV in Safari) can still have it read directly.
            if (!map[l.id] && /\.(mkv|mka|webm)$/i.test(l.path)) {
              map[l.id] = await containerDuration(await getDeviceFile(record.id, l.path));
            }
          } catch {
            map[l.id] = 0;
          }
          if (++sinceSave >= 12 && !cancelled) {
            sinceSave = 0;
            setState({ id: record.id, map: { ...map }, pending: true });
            void putDeviceDurations(record.id, map);
          }
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      if (cancelled) return;
      await putDeviceDurations(record.id, map);
      setState({ id: record.id, map: { ...map }, pending: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [record, enabled]);

  const current = state && record && state.id === record.id ? state : null;
  return { durations: current?.map ?? {}, pending: current?.pending ?? true };
}

/* -------------------------------- the gate --------------------------------- */

export interface DeviceCourseContextValue {
  record: DeviceCourseRecord;
  course: Course;
  progress: CourseProgress;
  durations: Record<string, number>;
  durationsPending: boolean;
  save: ProgressSaver;
}

const Ctx = createContext<DeviceCourseContextValue | null>(null);

export function useDeviceCourse() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDeviceCourse must be used inside <DeviceCourseGate>");
  return ctx;
}

type Status = "loading" | "missing" | "folder-missing" | AccessState;

const RESCAN_AFTER_MS = 30_000;

/**
 * Loads a device course from IndexedDB, makes sure this browser can read its
 * folder (asking for permission or a re-pick when needed), then renders children.
 */
export function DeviceCourseGate({
  courseId,
  children,
  fallback,
}: {
  courseId: string;
  children: (ctx: DeviceCourseContextValue) => React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [state, setState] = useState<{
    id: string;
    status: Status;
    record: DeviceCourseRecord | null;
    progress: CourseProgress | null;
  } | null>(null);
  const current = state?.id === courseId ? state : null;
  const status: Status = current?.status ?? "loading";
  const record = current?.record ?? null;

  // Bumped to re-read the course after access is granted or the folder is re-picked.
  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rec = await getDeviceCourse(courseId);
      if (cancelled) return;
      if (!rec) {
        setState({ id: courseId, status: "missing", record: null, progress: null });
        return;
      }
      const [access, progress] = await Promise.all([checkAccess(rec), getDeviceProgress(courseId)]);
      if (!cancelled) setState({ id: courseId, status: access, record: rec, progress });
    })().catch((err) => toast.error(String(err)));
    return () => {
      cancelled = true;
    };
  }, [courseId, version]);

  // Pick up added / renamed files automatically when the folder can be re-read without a prompt.
  useEffect(() => {
    if (status !== "ready" || !record?.handle || Date.now() - record.scannedAt < RESCAN_AFTER_MS) return;
    let cancelled = false;
    rescanDeviceCourse(record)
      .then((next) => {
        if (cancelled || !next) return;
        if (JSON.stringify(next.course) === JSON.stringify(record.course)) return;
        const before = new Set(flatLessons(record.course).map((l) => l.id));
        const after = flatLessons(next.course).map((l) => l.id);
        const added = after.filter((id) => !before.has(id)).length;
        const removed = before.size - (after.length - added);
        const parts = [added && `${added} new`, removed && `${removed} removed`].filter(Boolean);
        toast.success(`Course updated${parts.length ? ` · ${parts.join(", ")}` : ""}`);
        setState((s) => (s && s.id === courseId ? { ...s, record: next } : s));
      })
      .catch((err) => {
        if (!cancelled && isMissingFileError(err)) {
          setState((s) => (s && s.id === courseId ? { ...s, status: "folder-missing" } : s));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [status, record, courseId]);

  const { durations, pending } = useDeviceDurations(record, status === "ready");
  const source = useMemo(() => (record ? createDeviceSource(record) : null), [record]);
  const save = useCallback<ProgressSaver>((patches) => void saveDeviceProgress(courseId, patches), [courseId]);

  const picker = useFolderPicker({
    onDone: (rec) => {
      if (rec.id !== courseId) {
        toast.error(`That's “${rec.folderName}”, not “${record?.folderName}”. It was added as its own course.`);
        return;
      }
      load();
    },
  });

  if (status === "loading") return <>{fallback ?? <Centered><Loader2Icon className="size-5 animate-spin text-primary" /></Centered>}</>;

  if (status === "missing" || !record || !source || !current?.progress) {
    return (
      <Notice icon={<HardDriveIcon className="size-6" />} title="This course isn't on this device">
        <p>Device courses are saved per browser. Open the folder here to add it.</p>
        <Button asChild variant="outline">
          <Link href="/">Back to my courses</Link>
        </Button>
      </Notice>
    );
  }

  if (status === "needs-permission") {
    return (
      <Notice icon={<LockOpenIcon className="size-6" />} title={`Allow access to “${record.folderName}”`}>
        <p>Your browser needs your OK each visit before LUI can read this folder again.</p>
        <Button
          onClick={async () => {
            if (await requestAccess(record)) load();
            else toast.error("Permission was not granted.");
          }}
        >
          <LockOpenIcon /> Allow access
        </Button>
      </Notice>
    );
  }

  if (status === "folder-missing") {
    return (
      <Notice icon={<FolderSearchIcon className="size-6" />} title={`Can't find “${record.folderName}”`}>
        <p>The folder was moved, renamed or deleted. Choose it again (same folder name) and your progress is kept.</p>
        <Button onClick={picker.open} disabled={picker.busy}>
          {picker.busy ? <Loader2Icon className="animate-spin" /> : <FolderOpenIcon />} Choose folder again
        </Button>
        {picker.input}
      </Notice>
    );
  }

  if (status === "needs-pick") {
    return (
      <Notice icon={<FolderOpenIcon className="size-6" />} title={`Re-open “${record.folderName}”`}>
        <p>This browser can&apos;t remember folders, so pick the same folder again to continue. Your progress is kept.</p>
        <Button onClick={picker.open} disabled={picker.busy}>
          {picker.busy ? <Loader2Icon className="animate-spin" /> : <FolderOpenIcon />} Choose folder
        </Button>
        {picker.input}
      </Notice>
    );
  }

  const value: DeviceCourseContextValue = {
    record,
    course: record.course,
    progress: current.progress,
    durations,
    durationsPending: pending,
    save,
  };
  return (
    <CourseSourceProvider source={source}>
      <Ctx.Provider value={value}>{children(value)}</Ctx.Provider>
    </CourseSourceProvider>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-64 flex-1 items-center justify-center">{children}</div>;
}

function Notice({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <StatusNotice icon={icon} title={title}>
      {children}
    </StatusNotice>
  );
}
