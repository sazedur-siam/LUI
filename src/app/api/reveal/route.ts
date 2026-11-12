import { spawn } from "node:child_process";
import path from "node:path";

import { getCourseRecord } from "@/lib/server/store";
import { resolveInside } from "@/lib/server/paths";

/** Opens a course file with the default app, or reveals it in Finder / Explorer. */
export async function POST(request: Request) {
  const { courseId, path: rel, action } = (await request.json().catch(() => ({}))) as {
    courseId?: string;
    path?: string;
    action?: "open" | "reveal";
  };
  const record = courseId ? await getCourseRecord(courseId) : null;
  if (!record || typeof rel !== "string") return Response.json({ error: "Not found" }, { status: 404 });

  let abs: string;
  try {
    abs = await resolveInside(record.root, rel);
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const reveal = action === "reveal";
  let cmd: string;
  let args: string[];
  if (process.platform === "darwin") {
    cmd = "open";
    args = reveal ? ["-R", abs] : [abs];
  } else if (process.platform === "win32") {
    cmd = "explorer.exe";
    args = reveal ? [`/select,${abs}`] : [abs];
  } else {
    cmd = "xdg-open";
    args = [reveal ? path.dirname(abs) : abs];
  }
  // Opens a user file outside the app; nothing to trace for deployment.
  spawn(/*turbopackIgnore: true*/ cmd, args, { detached: true, stdio: "ignore" }).unref();
  return Response.json({ ok: true });
}
