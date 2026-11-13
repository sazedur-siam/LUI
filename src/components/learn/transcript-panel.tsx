"use client";

import { CopyIcon, Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatStamp } from "@/lib/timestamps";
import type { SubtitleTrack } from "@/lib/types";
import { cn } from "@/lib/utils";
import { type Cue, parseVtt } from "@/lib/vtt";

/** Transcript built from the lesson's subtitle tracks; follows playback and seeks on click. */
export function TranscriptPanel({
  tracks,
  getMedia,
}: {
  tracks: SubtitleTrack[];
  getMedia: () => HTMLMediaElement | null;
}) {
  const [trackIndex, setTrackIndex] = useState(0);
  const track = tracks[Math.min(trackIndex, tracks.length - 1)];
  const [loaded, setLoaded] = useState<{ src: string; cues: Cue[]; error?: boolean } | null>(null);
  const cues = loaded && track && loaded.src === track.src ? loaded.cues : null;
  const failed = !!loaded?.error && loaded.src === track?.src;
  const [time, setTime] = useState(0);
  const [query, setQuery] = useState("");
  const [matchCursor, setMatchCursor] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const userScrolledAt = useRef(0);

  useEffect(() => {
    if (!track) return;
    let cancelled = false;
    fetch(track.src)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(String(res.status)))))
      .then((text) => !cancelled && setLoaded({ src: track.src, cues: parseVtt(text) }))
      .catch(() => !cancelled && setLoaded({ src: track.src, cues: [], error: true }));
    return () => {
      cancelled = true;
    };
  }, [track]);

  // Follow the player (polling keeps this independent of when the media element appears).
  useEffect(() => {
    const id = setInterval(() => {
      const media = getMedia();
      if (media) setTime(media.currentTime);
    }, 400);
    return () => clearInterval(id);
  }, [getMedia]);

  const active = useMemo(() => {
    if (!cues) return -1;
    let found = -1;
    for (let i = 0; i < cues.length && cues[i].start <= time; i++) found = i;
    return found;
  }, [cues, time]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => (cues && q ? cues.flatMap((c, i) => (c.text.toLowerCase().includes(q) ? [i] : [])) : []),
    [cues, q],
  );

  // Keep the active line in view unless the reader scrolled in the last few seconds.
  useEffect(() => {
    if (active < 0 || q || Date.now() - userScrolledAt.current < 4000) return;
    const container = list.current;
    const row = container?.querySelector<HTMLElement>(`[data-cue="${active}"]`);
    if (container && row) {
      container.scrollTo({ top: row.offsetTop - container.clientHeight / 3, behavior: "smooth" });
    }
  }, [active, q]);

  const seek = (seconds: number) => {
    const media = getMedia();
    if (!media) return;
    media.currentTime = seconds;
    void media.play().catch(() => {});
  };

  const jumpToMatch = () => {
    if (matches.length === 0 || !list.current) return;
    const index = matches[matchCursor % matches.length];
    setMatchCursor((c) => c + 1);
    const row = list.current.querySelector<HTMLElement>(`[data-cue="${index}"]`);
    if (row) list.current.scrollTo({ top: row.offsetTop - list.current.clientHeight / 2, behavior: "smooth" });
  };

  const highlight = (text: string) => {
    if (!q) return text;
    const parts: React.ReactNode[] = [];
    const lower = text.toLowerCase();
    let at = 0;
    for (let i = lower.indexOf(q); i >= 0; i = lower.indexOf(q, i + q.length)) {
      parts.push(
        text.slice(at, i),
        <mark key={i} className="rounded bg-[#bbdefb] text-inherit">
          {text.slice(i, i + q.length)}
        </mark>,
      );
      at = i + q.length;
    }
    parts.push(text.slice(at));
    return parts;
  };

  const shown = cues ? (q ? matches.map((i) => [i, cues[i]] as const) : cues.map((c, i) => [i, c] as const)) : [];

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <h2 className="pl-1 text-sm font-medium">Transcript</h2>
        {tracks.length > 1 && (
          <select
            value={trackIndex}
            onChange={(e) => setTrackIndex(Number(e.target.value))}
            className="h-7 rounded-md border bg-white px-2 text-xs outline-none focus:border-primary"
            aria-label="Transcript language"
          >
            {tracks.map((t, i) => (
              <option key={t.src} value={i}>
                {t.label}
              </option>
            ))}
          </select>
        )}
        <div className="relative ml-auto min-w-40 flex-1 sm:max-w-64">
          <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setMatchCursor(0);
            }}
            onKeyDown={(e) => e.key === "Enter" && jumpToMatch()}
            placeholder="Search transcript"
            aria-label="Search transcript"
            className="h-7 w-full rounded-md border bg-white pl-7 pr-12 text-xs outline-none focus:border-primary"
          />
          {q && (
            <>
              <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground">
                {matches.length}
              </span>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <XIcon className="size-3.5" />
              </button>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Copy transcript"
          disabled={!cues?.length}
          onClick={() => {
            void navigator.clipboard
              .writeText((cues ?? []).map((c) => c.text).join("\n"))
              .then(() => toast.success("Transcript copied"));
          }}
        >
          <CopyIcon />
        </Button>
      </div>

      <div
        ref={list}
        onWheel={() => {
          userScrolledAt.current = Date.now();
        }}
        onTouchMove={() => {
          userScrolledAt.current = Date.now();
        }}
        className="scrollbar-thin relative max-h-80 overflow-y-auto py-1"
      >
        {!cues && !failed && (
          <div className="flex h-24 items-center justify-center text-primary">
            <Loader2Icon className="size-4 animate-spin" />
          </div>
        )}
        {failed && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Couldn&apos;t load this transcript.</p>
        )}
        {cues && !failed && shown.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">{q ? "No matches." : "This track is empty."}</p>
        )}
        {shown.map(([i, cue]) => (
          <button
            key={i}
            type="button"
            data-cue={i}
            onClick={() => seek(cue.start)}
            className={cn(
              "flex w-full gap-3 px-4 py-1.5 text-left text-sm leading-relaxed transition-colors hover:bg-[#f7fbff]",
              i === active && "bg-[#e3f2fd] text-[#1565c0]",
            )}
          >
            <span className="w-12 shrink-0 pt-px text-right text-xs tabular-nums text-muted-foreground">
              {formatStamp(cue.start)}
            </span>
            <span>{highlight(cue.text)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
