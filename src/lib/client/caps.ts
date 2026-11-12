"use client";

let cached: string | null = null;

/**
 * Detects which containers and codecs this browser can play natively. The
 * server uses this to choose direct play, a fast MP4 remux, or a transcode.
 */
export function browserCaps(): string {
  if (cached) return cached;
  if (typeof document === "undefined") return "";
  const v = document.createElement("video");
  const a = document.createElement("audio");
  const mse = typeof window !== "undefined" ? window.MediaSource : undefined;
  const can = (type: string) => {
    try {
      return v.canPlayType(type) !== "" || a.canPlayType(type) !== "" || !!mse?.isTypeSupported?.(type);
    } catch {
      return false;
    }
  };

  const ua = navigator.userAgent;
  const isSafari = /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(ua);
  const isChromium = /chrome|chromium|edg\//i.test(ua) && !isSafari;

  const caps: Record<string, boolean> = {
    // Containers
    webm: can("video/webm"),
    // Chromium plays Matroska through its WebM demuxer; others are tried and fall back on error.
    mkv: isChromium || can("video/x-matroska") || can("video/mkv"),
    ogg: can("audio/ogg"),
    wav: can("audio/wav"),
    flac: can("audio/flac"),
    aacfile: can("audio/aac"),
    // Video codecs
    hevc: can('video/mp4; codecs="hvc1.1.6.L120.90"') || can('video/mp4; codecs="hev1.1.6.L120.90"'),
    vp8: can('video/webm; codecs="vp8"'),
    vp9: can('video/webm; codecs="vp9"') || can('video/mp4; codecs="vp09.00.10.08"'),
    av1: can('video/mp4; codecs="av01.0.08M.08"'),
    // Audio codecs
    opus: can('audio/webm; codecs="opus"') || can('audio/mp4; codecs="opus"'),
    vorbis: can('audio/ogg; codecs="vorbis"') || can('audio/webm; codecs="vorbis"'),
    flaccodec: can('audio/mp4; codecs="flac"'),
    ac3: can('audio/mp4; codecs="ac-3"'),
    eac3: can('audio/mp4; codecs="ec-3"'),
    alac: can('audio/mp4; codecs="alac"'),
    pcm: can("audio/wav"),
  };

  const list = Object.entries(caps)
    .filter(([, ok]) => ok)
    .map(([k]) => (k === "flaccodec" ? "flac" : k));
  cached = [...new Set(list)].join(",");
  return cached;
}
