"use client";

import "@videojs/react/video/neutral-skin.css";
import "@videojs/react/audio/neutral-skin.css";

import { Audio, AudioPlayer, NeutralAudioSkin } from "@videojs/react/audio";
import { HlsJsVideo } from "@videojs/react/media/hlsjs-video";
import { NeutralVideoSkin, Video, VideoPlayer } from "@videojs/react/video";
import { AlertTriangleIcon, DownloadIcon, ExternalLinkIcon, Loader2Icon, WandSparklesIcon } from "lucide-react";
import { type CSSProperties, type SyntheticEvent, useCallback, useEffect, useRef, useState } from "react";

import { Bar } from "@/components/progress-visuals";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlaybackPlan } from "@/lib/types";

import { useCourseSource, useFileUrl } from "@/components/source/course-source";

export interface MediaPlayerProps {
  lessonId: string;
  /** Course-relative path when playing a lesson resource instead of the lesson itself. */
  resourcePath?: string;
  /** Course-relative path of the underlying file (for "open externally"). */
  filePath: string;
  kind: "video" | "audio";
  startAt?: number;
  autoPlay?: boolean;
  onTime?: (position: number, duration: number) => void;
  onEnded?: () => void;
  onPause?: (position: number, duration: number) => void;
  overlay?: React.ReactNode;
  className?: string;
}

const SKIN_STYLE = {
  "--media-accent-color": "#1E88E5",
  "--media-accent-text-color": "#ffffff",
  "--media-border-radius": "16px",
  "--media-border-color": "transparent",
  "--media-font-family": "var(--font-sans), system-ui, sans-serif",
} as CSSProperties;

type Force = null | "remux" | "transcode";

const MODE_LABEL: Record<PlaybackPlan["mode"], { label: string; color: string; hint: string }> = {
  direct: { label: "Direct play", color: "#26A69A", hint: "Playing the original file" },
  remux: { label: "Optimized", color: "#039BE5", hint: "Repackaged to MP4 without re-encoding" },
  transcode: { label: "Converting", color: "#5C6BC0", hint: "Converted on the fly with ffmpeg" },
};

export function MediaPlayer(props: MediaPlayerProps) {
  const { lessonId, resourcePath, filePath, kind, autoPlay, overlay, className } = props;
  const source = useCourseSource();
  const courseId = source.courseId;
  const [force, setForce] = useState<Force>(null);

  // Results are keyed by request so a new lesson / fallback never shows a stale plan.
  const reqKey = `${courseId}|${lessonId}|${resourcePath ?? ""}|${force ?? ""}`;
  const [result, setResult] = useState<{ key: string; plan: PlaybackPlan | null; error: string | null }>({
    key: "",
    plan: null,
    error: null,
  });
  const plan = result.key === reqKey ? result.plan : null;
  const error = result.key === reqKey ? result.error : null;
  const setError = useCallback((msg: string) => setResult((r) => ({ ...r, key: reqKey, error: msg })), [reqKey]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      const data = await source.mediaPlan({ lessonId, path: filePath, resourcePath, kind, force });
      if (cancelled) return;
      const remuxPending = data.mode === "remux" && !data.ready;
      setResult({ key: reqKey, plan: data, error: remuxPending && data.error ? data.error : null });
      if (remuxPending && !data.error) timer = setTimeout(load, 600);
    };
    load().catch((err) => !cancelled && setResult({ key: reqKey, plan: null, error: String(err) }));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [source, lessonId, filePath, resourcePath, kind, force, reqKey]);

  const fallback = () => {
    if (!plan) return;
    if (!source.canConvert) {
      setError(
        `This browser can't play ${plan.summary} files. Download it, or run LUI on your computer, which converts it automatically.`,
      );
    } else if (plan.mode === "direct") setForce("remux");
    else if (plan.mode === "remux" && plan.hasVideo) setForce("transcode");
    else setError("This file could not be played in the browser.");
  };

  // Which source the resume position has been applied to (refs are only touched in handlers).
  const restoredFor = useRef<string | null>(null);

  const handlers = {
    onLoadedMetadata: (e: SyntheticEvent<HTMLMediaElement>) => {
      const el = e.currentTarget;
      // Some browsers "play" an unsupported video stream as audio only; treat that as a failure.
      if (plan?.hasVideo && kind === "video" && el instanceof HTMLVideoElement && el.videoWidth === 0) {
        if (plan.mode !== "transcode") return fallback();
      }
      const at = props.startAt ?? 0;
      if (restoredFor.current == null && at > 3 && Number.isFinite(el.duration) && at < el.duration - 3) {
        el.currentTime = at;
      }
      restoredFor.current = plan?.src ?? "";
    },
    onTimeUpdate: (e: SyntheticEvent<HTMLMediaElement>) => {
      const el = e.currentTarget;
      if (restoredFor.current != null) props.onTime?.(el.currentTime, el.duration);
    },
    onPause: (e: SyntheticEvent<HTMLMediaElement>) => {
      const el = e.currentTarget;
      props.onPause?.(el.currentTime, el.duration);
    },
    onEnded: () => props.onEnded?.(),
    onError: () => fallback(),
  };

  const isAudio = kind === "audio" || (plan != null && !plan.hasVideo);

  let body: React.ReactNode;
  if (error) {
    body = (
      <StatusBox isAudio={isAudio}>
        <AlertTriangleIcon className="size-7 text-[#FFA000]" />
        <p className="max-w-md text-center text-sm text-[#37474F]">{error}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {source.canConvert && plan?.mode !== "transcode" && plan?.hasVideo !== false && (
            <Button size="sm" onClick={() => setForce("transcode")}>
              <WandSparklesIcon /> Try converting
            </Button>
          )}
          {source.openExternally ? (
            <Button size="sm" variant="outline" onClick={() => source.openExternally?.(filePath, "open")}>
              <ExternalLinkIcon /> Open in default app
            </Button>
          ) : (
            <DownloadButton path={filePath} />
          )}
        </div>
      </StatusBox>
    );
  } else if (!plan) {
    body = (
      <StatusBox isAudio={isAudio}>
        <Loader2Icon className="size-6 animate-spin text-[#1E88E5]" />
        <p className="text-sm text-[#1E88E5]">Preparing {kind}…</p>
      </StatusBox>
    );
  } else if (!plan.ready) {
    body = (
      <StatusBox isAudio={isAudio}>
        <WandSparklesIcon className="size-6 text-[#1E88E5]" />
        <div className="w-64 space-y-2 text-center">
          <p className="text-sm text-[#37474F]">Optimizing for your browser…</p>
          <Bar value={(plan.progress ?? 0) * 100} color="#1E88E5" className="bg-white" />
          <p className="text-xs text-[#78909C]">{plan.summary} → MP4 · no quality loss</p>
        </div>
      </StatusBox>
    );
  } else if (isAudio) {
    body = (
      <AudioPlayer key={plan.src}>
        <NeutralAudioSkin style={SKIN_STYLE} className="w-full">
          <Audio src={plan.src} autoPlay={autoPlay} preload="metadata" {...handlers} />
        </NeutralAudioSkin>
      </AudioPlayer>
    );
  } else {
    const tracks = plan.subtitles.map((t, i) => (
      <track key={t.src} kind="subtitles" src={t.src} label={t.label} srcLang={t.lang ?? "en"} default={i === 0 && false} />
    ));
    body = (
      <VideoPlayer key={plan.src}>
        <NeutralVideoSkin style={SKIN_STYLE} className="aspect-video w-full">
          {plan.mode === "transcode" ? (
            <HlsJsVideo src={plan.src} autoPlay={autoPlay} playsInline preload="auto" {...handlers}>
              {tracks}
            </HlsJsVideo>
          ) : (
            <Video src={plan.src} autoPlay={autoPlay} playsInline preload="auto" {...handlers}>
              {tracks}
            </Video>
          )}
        </NeutralVideoSkin>
      </VideoPlayer>
    );
  }

  const mode = plan ? MODE_LABEL[plan.mode] : null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className={cn("relative overflow-hidden rounded-2xl", !isAudio && plan?.ready && "bg-[#0d2b45]")}>
        {body}
        {overlay}
      </div>
      {plan && mode && (
        <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground" title={mode.hint}>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full" style={{ background: mode.color }} />
            {mode.label}
          </span>
          <span className="text-border">•</span>
          <span>{plan.summary}</span>
          {source.canConvert && plan.mode === "direct" && plan.hasVideo && (
            <button
              type="button"
              className="ml-auto hover:text-foreground"
              onClick={() => setForce("transcode")}
              title="Use this if the picture or sound is wrong"
            >
              Playback issues? Convert
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DownloadButton({ path }: { path: string }) {
  const url = useFileUrl(path, { download: true });
  if (!url) return null;
  return (
    <Button size="sm" variant="outline" asChild>
      <a href={url} download={path.split("/").pop()}>
        <DownloadIcon /> Download
      </a>
    </Button>
  );
}

function StatusBox({ children, isAudio }: { children: React.ReactNode; isAudio: boolean }) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-[#d6e6f5] bg-linear-to-b from-[#f5faff] to-[#e3f2fd] p-6",
        isAudio ? "min-h-40" : "aspect-video",
      )}
    >
      {children}
    </div>
  );
}
