import { getProgress, type ProgressPatch, updateProgress } from "@/lib/server/store";

export async function GET(_request: Request, ctx: RouteContext<"/api/progress/[courseId]">) {
  const { courseId } = await ctx.params;
  return Response.json(await getProgress(courseId));
}

/** Accepts a single patch or an array (sendBeacon flushes several at once). */
export async function POST(request: Request, ctx: RouteContext<"/api/progress/[courseId]">) {
  const { courseId } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const patches = (Array.isArray(body) ? body : [body]) as ProgressPatch[];
  try {
    for (const patch of patches) {
      if (typeof patch?.lessonId !== "string") continue;
      await updateProgress(courseId, {
        lessonId: patch.lessonId,
        completed: patch.completed,
        position: patch.position,
        duration: patch.duration,
        page: patch.page,
        opened: patch.opened === true,
      });
    }
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 404 });
  }
  return Response.json({ ok: true });
}
