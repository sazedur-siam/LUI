import path from "node:path";

import { hlsPlaylist, hlsSegment, jobDir } from "@/lib/server/media";
import { serveFile } from "@/lib/server/serve";

/** Serves remuxed MP4/M4A files and HLS playlists/segments produced by ffmpeg. */
export async function GET(request: Request, ctx: RouteContext<"/api/media/out/[key]/[file]">) {
  const { key, file } = await ctx.params;
  let dir: string;
  try {
    dir = jobDir(key);
  } catch {
    return new Response("Bad key", { status: 400 });
  }

  if (file === "index.m3u8") {
    const playlist = await hlsPlaylist(key);
    if (!playlist) return new Response("Not found", { status: 404 });
    return new Response(playlist, {
      headers: { "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-cache" },
    });
  }

  const seg = /^seg_(\d{5})\.ts$/.exec(file);
  if (seg) {
    try {
      const segFile = await hlsSegment(key, Number(seg[1]), request.signal);
      if (!segFile) return new Response("Segment unavailable", { status: 503 });
      return serveFile(request, segFile, { contentType: "video/mp2t", cache: "private, max-age=31536000, immutable" });
    } catch (err) {
      return new Response(String(err), { status: 500 });
    }
  }

  if (file === "media.mp4" || file === "media.m4a") {
    try {
      return await serveFile(request, path.join(dir, file), {
        contentType: file.endsWith("mp4") ? "video/mp4" : "audio/mp4",
      });
    } catch {
      return new Response("Not ready", { status: 404 });
    }
  }

  return new Response("Not found", { status: 404 });
}
