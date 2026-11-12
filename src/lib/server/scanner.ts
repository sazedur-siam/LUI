import "server-only";

import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import { buildCourse, type FileEntry, humanize, isHidden } from "@/lib/course-builder";
import type { Course } from "@/lib/types";

import { hashId } from "./paths";

async function readDir(dir: string): Promise<Dirent[]> {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function walk(root: string, dir: string, out: FileEntry[]) {
  for (const entry of await readDir(dir)) {
    if (isHidden(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(root, abs, out);
    } else if (entry.isFile()) {
      const size = await fs.stat(abs).then(
        (s) => s.size,
        () => 0,
      );
      out.push({ path: path.relative(root, abs).split(path.sep).join("/"), size });
    }
  }
  return out;
}

export function courseTitleFromPath(root: string) {
  return humanize(path.basename(path.resolve(root)));
}

export async function scanCourse(id: string, root: string, title: string): Promise<Course> {
  const files = await walk(root, root, []);
  return buildCourse({ id, title, root, files, hash: hashId });
}
