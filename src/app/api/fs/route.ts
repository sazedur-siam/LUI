import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { SERVER_FILES_DISABLED_MESSAGE, serverFilesEnabled } from "@/lib/server/mode";

/** Lists sub-folders of a directory for the "Add course" folder browser. */
export async function GET(request: Request) {
  if (!serverFilesEnabled()) return Response.json({ error: SERVER_FILES_DISABLED_MESSAGE }, { status: 403 });
  const url = new URL(request.url);
  const requested = url.searchParams.get("path");
  const dir = path.resolve(requested && requested.trim() ? requested.replace(/^~(?=$|\/)/, os.homedir()) : os.homedir());

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const folders = entries
      .filter((e) => (e.isDirectory() || e.isSymbolicLink()) && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
    const parent = path.dirname(dir);
    return Response.json({
      path: dir,
      parent: parent === dir ? null : parent,
      home: os.homedir(),
      folders,
    });
  } catch {
    return Response.json({ error: "Cannot open that folder", path: dir }, { status: 404 });
  }
}
