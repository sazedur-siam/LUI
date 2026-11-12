import path from "node:path";

import { extOf } from "@/lib/files";
import { getCourseRecord } from "@/lib/server/store";
import { PathError, resolveInside } from "@/lib/server/paths";
import { serveFile } from "@/lib/server/serve";

async function handle(request: Request, ctx: RouteContext<"/api/file/[courseId]/[...path]">) {
  const { courseId, path: segments } = await ctx.params;
  const record = await getCourseRecord(courseId);
  if (!record) return new Response("Unknown course", { status: 404 });

  let abs: string;
  try {
    abs = await resolveInside(record.root, segments.map((s) => decodeURIComponent(s)).join("/"));
  } catch (err) {
    if (err instanceof PathError) return new Response("Forbidden", { status: 403 });
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const download = url.searchParams.has("download") ? path.basename(abs) : undefined;
  const ext = extOf(abs);
  // Course HTML runs in an opaque origin even if opened directly, so it can never reach this app's API.
  const extraHeaders: Record<string, string> =
    ext === "html" || ext === "htm" || ext === "svg"
      ? { "Content-Security-Policy": "sandbox allow-scripts allow-forms allow-popups allow-modals" }
      : {};

  try {
    return await serveFile(request, abs, { download, extraHeaders });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

export const GET = handle;
export const HEAD = handle;
