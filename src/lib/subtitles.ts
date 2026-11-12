/** Subtitle helpers shared by the server routes and device (browser) courses. */

export function srtToVtt(srt: string) {
  const body = srt
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/(\d{1,2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return `WEBVTT\n\n${body}`;
}

/** Normalise a sidecar subtitle file (.srt or .vtt) to WebVTT text. */
export function toVtt(text: string, fileName: string) {
  return fileName.toLowerCase().endsWith(".vtt") ? text : srtToVtt(text);
}

/** "video.en.srt" -> "en" */
export function langFromName(file: string) {
  const m = /\.([a-z]{2,3})(?:-[a-z]{2})?\.(?:srt|vtt)$/i.exec(file);
  return m?.[1]?.toLowerCase();
}

export function subtitleLabel(file: string, index: number) {
  const lang = langFromName(file);
  if (lang) {
    try {
      return new Intl.DisplayNames(["en"], { type: "language" }).of(lang) ?? lang.toUpperCase();
    } catch {
      return lang.toUpperCase();
    }
  }
  return index === 0 ? "Subtitles" : `Subtitles ${index + 1}`;
}
