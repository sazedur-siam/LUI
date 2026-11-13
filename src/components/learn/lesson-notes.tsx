"use client";

import { AlarmClockPlusIcon, CheckIcon, NotebookPenIcon, PlayIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { MAX_NOTES_LENGTH } from "@/lib/progress";
import { formatStamp, listStamps } from "@/lib/timestamps";

import { useProgress } from "./progress-context";

const SAVE_DELAY_MS = 800;

/**
 * Per-lesson notes. On media lessons, `N` (or the clock button) inserts the
 * current time as "[m:ss]", and the stamps become buttons that seek the player.
 */
export function LessonNotes({
  lessonId,
  getMedia,
  canStamp,
}: {
  lessonId: string;
  getMedia: () => HTMLMediaElement | null;
  canStamp: boolean;
}) {
  const { get, saveNotes } = useProgress();
  const [text, setText] = useState(() => get(lessonId)?.notes ?? "");
  const [open, setOpen] = useState(() => !!get(lessonId)?.notes);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const area = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);

  const scheduleSave = (value: string) => {
    pending.current = value;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      pending.current = null;
      saveNotes(lessonId, value);
      setStatus("saved");
    }, SAVE_DELAY_MS);
  };

  // Don't lose the last keystrokes when leaving the lesson.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current !== null) saveNotes(lessonId, pending.current);
    },
    [lessonId, saveNotes],
  );

  const update = (value: string) => {
    setText(value);
    scheduleSave(value);
  };

  const insertStamp = () => {
    const media = getMedia();
    setOpen(true);
    if (!media) return;
    const el = area.current;
    const stamp = `[${formatStamp(media.currentTime)}] `;
    const at = el ? el.selectionStart : text.length;
    const before = text.slice(0, at);
    const prefix = before && !before.endsWith("\n") ? "\n" : "";
    const value = `${before}${prefix}${stamp}${text.slice(at)}`.slice(0, MAX_NOTES_LENGTH);
    update(value);
    const cursor = before.length + prefix.length + stamp.length;
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(cursor, cursor);
    });
  };

  // "N" anywhere on the page (outside inputs) adds a timestamped note.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (e.key !== "n" || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      if (canStamp) insertStamp();
      else {
        setOpen(true);
        requestAnimationFrame(() => area.current?.focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const seek = (seconds: number) => {
    const media = getMedia();
    if (!media) return;
    media.currentTime = seconds;
    void media.play().catch(() => {});
  };

  const stamps = canStamp ? listStamps(text) : [];
  const rows = Math.min(16, Math.max(4, text.split("\n").length + 1));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => area.current?.focus());
        }}
        className="mt-6 flex w-full items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-[#bbdefb] hover:bg-[#f7fbff]"
      >
        <NotebookPenIcon className="size-4 text-[#039BE5]" />
        Add a note
        <span className="ml-auto flex items-center gap-1 text-xs">
          <Kbd>N</Kbd> {canStamp ? "at current time" : ""}
        </span>
      </button>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border bg-white">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <NotebookPenIcon className="size-4 text-[#039BE5]" />
        <h2 className="text-sm font-medium">Notes</h2>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {status === "saving" ? "Saving…" : status === "saved" ? (
            <span className="inline-flex items-center gap-1">
              <CheckIcon className="size-3 text-success" /> Saved
            </span>
          ) : null}
        </span>
        {canStamp && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={insertStamp}>
            <AlarmClockPlusIcon /> Add timestamp <Kbd className="ml-1">N</Kbd>
          </Button>
        )}
      </div>
      <textarea
        ref={area}
        value={text}
        rows={rows}
        maxLength={MAX_NOTES_LENGTH}
        onChange={(e) => update(e.target.value)}
        placeholder={canStamp ? "Write a note… press N while watching to stamp the time." : "Write a note…"}
        className="block w-full resize-y bg-transparent px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
      />
      {stamps.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t px-4 py-2.5">
          {stamps.map((s) => (
            <button
              key={s.seconds}
              type="button"
              onClick={() => seek(s.seconds)}
              className="inline-flex items-center gap-1 rounded-full bg-[#e3f2fd] px-2.5 py-0.5 text-xs font-medium text-[#1565c0] transition-colors hover:bg-[#bbdefb]"
              title={`Jump to ${s.stamp}`}
            >
              <PlayIcon className="size-3" /> {s.stamp}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
