"use client";

import { ArrowRightIcon, CaptionsIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, PaperclipIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { KindIcon } from "@/components/kind-icon";
import { ResourceItem } from "@/components/resource-dialog";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FileViewer } from "@/components/viewers/file-viewer";
import { formatBytes, KIND_LABEL } from "@/lib/files";
import { useCourseSource } from "@/components/source/course-source";
import { useLocalPref } from "@/hooks/use-local-pref";
import type { Lesson, SubtitleTrack } from "@/lib/types";
import { cn } from "@/lib/utils";

import { LockedLesson, useLessonAccess } from "./lesson-access";
import { LessonNotes } from "./lesson-notes";
import { TranscriptPanel } from "./transcript-panel";
import { useProgress } from "./progress-context";

interface NavLesson {
  id: string;
  title: string;
}

export interface LessonViewProps {
  lesson: Lesson;
  moduleTitle: string;
  moduleNumber: number | null;
  index: number;
  total: number;
  prev: NavLesson | null;
  next: NavLesson | null;
}

const AUTOPLAY_KEY = "lui:autoplay-next";
const COMPLETE_AT = 0.9;

export function LessonView({ lesson, moduleTitle, moduleNumber, index, total, prev, next }: LessonViewProps) {
  const { basePath } = useCourseSource();
  const router = useRouter();
  const { get, setCompleted, savePosition, savePage, markOpened } = useProgress();
  const progress = get(lesson.id);
  const completed = !!progress?.completed;
  const isMedia = lesson.kind === "video" || lesson.kind === "audio";

  const [autoNext, setAutoNext] = useLocalPref(AUTOPLAY_KEY, true);
  const [upNext, setUpNext] = useState<number | null>(null);

  // "?t=123" (from a note timestamp) opens the lesson at that time.
  const searchParams = useSearchParams();
  const linkedTime = Number(searchParams.get("t"));

  // Snapshot the resume point once per lesson so live position updates don't re-seek.
  const [startAt] = useState(() => {
    if (Number.isFinite(linkedTime) && linkedTime > 0) return linkedTime;
    const pos = progress?.position ?? 0;
    const dur = progress?.duration ?? 0;
    return dur > 0 && pos > dur - 15 ? 0 : pos;
  });
  const [initialPage] = useState(() => progress?.page);

  // Guided courses: lessons past the frontier stay locked until the previous one is finished.
  const access = useLessonAccess();
  const unlocked = access.isUnlocked(lesson.id);
  const nextOpen = !!next && access.isUnlocked(next.id);
  const nextLockedHint = next && !nextOpen ? `Finish “${access.blockerFor(next.id)?.title ?? lesson.title}” to unlock` : undefined;

  useEffect(() => {
    if (unlocked) markOpened(lesson.id);
  }, [lesson.id, markOpened, unlocked]);

  // Set from event handlers only, so auto-complete fires once per view.
  const autoCompleted = useRef(false);
  const mediaEl = useRef<HTMLMediaElement | null>(null);
  const getMedia = useCallback(() => mediaEl.current, []);
  const [tracks, setTracks] = useState<SubtitleTrack[]>([]);
  const [showTranscript, setShowTranscript] = useLocalPref("lui:transcript", false);
  const lastSaved = useRef(0);

  const goNext = useCallback(() => {
    if (next && access.isUnlocked(next.id)) router.push(`${basePath}/learn/${next.id}`);
  }, [next, router, basePath, access]);

  // Up-next countdown after a video ends.
  useEffect(() => {
    if (upNext === null) return;
    const t = setTimeout(() => {
      if (upNext <= 1) {
        setUpNext(null);
        goNext();
      } else {
        setUpNext(upNext - 1);
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [upNext, goNext]);

  // Shift+N / Shift+P to move between lessons; T toggles the transcript.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (e.key === "t" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && tracks.length > 0) {
        e.preventDefault();
        setShowTranscript(!showTranscript);
        return;
      }
      if (!e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "N" && next && access.isUnlocked(next.id)) {
        e.preventDefault();
        router.push(`${basePath}/learn/${next.id}`);
      } else if (e.key === "P" && prev) {
        e.preventDefault();
        router.push(`${basePath}/learn/${prev.id}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [basePath, next, prev, router, tracks.length, showTranscript, setShowTranscript, access]);

  const onTime = (position: number, duration: number) => {
    if (Math.abs(position - lastSaved.current) >= 5) {
      lastSaved.current = position;
      savePosition(lesson.id, position, duration);
    }
    if (!completed && !autoCompleted.current && duration > 0 && position / duration >= COMPLETE_AT) {
      autoCompleted.current = true;
      setCompleted(lesson.id, true);
    }
  };

  const onEnded = () => {
    if (!completed && !autoCompleted.current) {
      autoCompleted.current = true;
      setCompleted(lesson.id, true);
    }
    if (autoNext && next) setUpNext(5);
  };

  const overlay =
    upNext !== null && next && nextOpen ? (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0d2b45]/55 p-4 backdrop-blur-[2px]">
        <div className="w-full max-w-xs rounded-2xl bg-white p-5 text-center shadow-[0_12px_40px_-12px_rgba(13,43,69,0.5)]">
          <p className="text-xs text-muted-foreground">Up next in {upNext}s</p>
          <p className="mt-1 line-clamp-2 font-medium">{next.title}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="outline" onClick={() => setUpNext(null)}>
              Cancel
            </Button>
            <Button onClick={goNext}>
              Play now <ArrowRightIcon />
            </Button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-white/90 px-3 backdrop-blur-md">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-muted-foreground">
            {moduleNumber != null ? `Module ${moduleNumber} · ` : ""}
            {moduleTitle}
          </p>
          <p className="truncate text-sm font-medium">{lesson.title}</p>
        </div>
        <div className="flex items-center gap-1">
          <NavButton href={prev && `${basePath}/learn/${prev.id}`} label="Previous" hint="P" title={prev?.title}>
            <ChevronLeftIcon />
            <span className="hidden sm:inline">Previous</span>
          </NavButton>
          <NavButton
            href={nextOpen && next ? `${basePath}/learn/${next.id}` : null}
            label="Next"
            hint="N"
            title={next?.title}
            disabledHint={nextLockedHint}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRightIcon />
          </NavButton>
        </div>
      </header>

      {!unlocked ? (
        <LockedLesson lesson={lesson} blocker={access.blockerFor(lesson.id)} frontier={access.frontier} basePath={basePath} />
      ) : (
      <div className={cn("mx-auto w-full px-4 py-5 sm:px-6", isMedia ? "max-w-6xl" : "max-w-7xl")}>
        <FileViewer
          key={lesson.id}
          lessonId={lesson.id}
          file={{ path: lesson.path, name: lesson.fileName, kind: lesson.kind, size: lesson.size }}
          media={{
            startAt,
            autoPlay: true,
            onTime,
            onPause: (pos, dur) => savePosition(lesson.id, pos, dur, true),
            onEnded,
            overlay,
            onMediaElement: (el) => {
              mediaEl.current = el;
            },
            onSubtitles: setTracks,
          }}
          pdf={{ initialPage, onPage: (page) => savePage(lesson.id, page) }}
        />

        {showTranscript && tracks.length > 0 && <TranscriptPanel tracks={tracks} getMedia={getMedia} />}

        <div className="mt-6 flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <KindIcon kind={lesson.kind} className="size-3.5" />
              {KIND_LABEL[lesson.kind]} · Lesson {index + 1} of {total} · {formatBytes(lesson.size)}
            </p>
            <h1 className="mt-1 text-xl font-medium leading-snug tracking-tight">{lesson.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tracks.length > 0 && (
              <Button
                variant={showTranscript ? "secondary" : "ghost"}
                onClick={() => setShowTranscript(!showTranscript)}
                aria-pressed={showTranscript}
                title="Transcript (T)"
              >
                <CaptionsIcon /> Transcript
              </Button>
            )}
            {isMedia && next && (
              <label className="mr-1 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <Switch
                  checked={autoNext}
                  onCheckedChange={setAutoNext}
                />
                Autoplay next
              </label>
            )}
            <Button
              variant={completed ? "secondary" : "outline"}
              onClick={() => setCompleted(lesson.id, !completed)}
            >
              {completed ? <CheckIcon className="text-success" /> : null}
              {completed ? "Completed" : "Mark complete"}
            </Button>
            {next && (
              <Button
                // Completing the frontier lesson unlocks the next one, so navigate directly
                // (the access check would still see the pre-completion state here).
                disabled={completed && !nextOpen}
                title={completed && !nextOpen ? nextLockedHint : undefined}
                onClick={() => {
                  if (!completed) setCompleted(lesson.id, true);
                  router.push(`${basePath}/learn/${next.id}`);
                }}
              >
                {completed ? "Next lesson" : "Complete & continue"} <ArrowRightIcon />
              </Button>
            )}
          </div>
        </div>

        <LessonNotes key={`notes-${lesson.id}`} lessonId={lesson.id} getMedia={getMedia} canStamp={isMedia} />

        {lesson.resources.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
              <PaperclipIcon className="size-4 text-[#039BE5]" /> Resources
              <span className="text-xs font-normal text-muted-foreground">{lesson.resources.length}</span>
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {lesson.resources.map((r) => (
                <ResourceItem key={r.path} resource={{ ...r, lessonId: lesson.id }} />
              ))}
            </div>
          </section>
        )}
      </div>
      )}
    </>
  );
}

function NavButton({
  href,
  label,
  hint,
  title,
  disabledHint,
  children,
}: {
  href: string | null;
  label: string;
  hint: string;
  title?: string;
  /** Why the button is disabled (e.g. the next lesson is locked). */
  disabledHint?: string;
  children: React.ReactNode;
}) {
  if (!href) {
    // Disabled buttons don't get pointer events, so the hint sits on a wrapper.
    return (
      <span title={disabledHint}>
        <Button variant="ghost" size="sm" disabled aria-label={disabledHint ? `${label} (locked)` : label}>
          {children}
        </Button>
      </span>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="sm" asChild>
          <Link href={href} aria-label={label}>
            {children}
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        <span className="line-clamp-2">{title}</span>
        <span className="mt-1 flex items-center gap-1 opacity-70">
          <Kbd>⇧</Kbd>
          <Kbd>{hint}</Kbd>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
