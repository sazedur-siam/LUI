"use client";

/**
 * Repackages a video (e.g. MKV) into MP4 inside the browser, copying the
 * audio/video streams without re-encoding, for browsers that can't play the
 * original container (Safari, older Firefox). Mirrors the server's "remux" route.
 */

export interface RemuxJob {
  status: "running" | "done" | "error";
  progress: number;
  url?: string;
  error?: string;
}

const jobs = new Map<string, RemuxJob>();

/** Start (or return) the remux job for a file. Results are cached for the session. */
export function startBrowserRemux(key: string, file: Blob, opts?: { audioOnly?: boolean }): RemuxJob {
  const existing = jobs.get(key);
  if (existing && existing.status !== "error") return existing;

  const job: RemuxJob = { status: "running", progress: 0 };
  jobs.set(key, job);

  void (async () => {
    // Loaded on demand: only browsers that need it pay for the download.
    const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } = await import(
      "mediabunny"
    );
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      video: opts?.audioOnly ? { discard: true } : undefined,
      showWarnings: false,
    });
    if (!conversion.isValid) {
      const reasons = conversion.discardedTracks.map((t) => t.reason).join(", ");
      throw new Error(`This file's streams can't be repackaged in the browser${reasons ? ` (${reasons})` : ""}.`);
    }
    conversion.onProgress = (p) => {
      job.progress = Math.min(0.99, p);
    };
    await conversion.execute();
    const buffer = output.target.buffer;
    if (!buffer) throw new Error("Repackaging produced no output.");
    job.url = URL.createObjectURL(new Blob([buffer], { type: opts?.audioOnly ? "audio/mp4" : "video/mp4" }));
    job.progress = 1;
    job.status = "done";
  })().catch((err) => {
    job.status = "error";
    job.error = err instanceof Error ? err.message : String(err);
  });

  return job;
}
