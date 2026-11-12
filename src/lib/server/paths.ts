import "server-only";

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { serverFilesEnabled } from "./mode";

export const DATA_DIR = process.env.LUI_DATA_DIR
  ? path.resolve(process.env.LUI_DATA_DIR)
  : path.join(process.cwd(), ".data");

export const CACHE_DIR = path.join(DATA_DIR, "cache");

export function hashId(input: string, length = 12) {
  return createHash("sha1").update(input).digest("hex").slice(0, length);
}

export class PathError extends Error {}

/**
 * Resolve a course-relative POSIX path to an absolute path, refusing anything
 * that escapes the course root (including through symlinks).
 */
export async function resolveInside(root: string, relPath: string) {
  if (!serverFilesEnabled()) throw new PathError("Server file access is disabled");
  const normalizedRoot = path.resolve(root);
  const abs = path.resolve(normalizedRoot, ...relPath.split("/"));
  if (abs !== normalizedRoot && !abs.startsWith(normalizedRoot + path.sep)) {
    throw new PathError("Path is outside of the course folder");
  }
  const [realRoot, realAbs] = await Promise.all([fs.realpath(normalizedRoot), fs.realpath(abs)]);
  if (realAbs !== realRoot && !realAbs.startsWith(realRoot + path.sep)) {
    throw new PathError("Path is outside of the course folder");
  }
  return realAbs;
}

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

/** Write JSON atomically so a crash never leaves a half-written file. */
export async function writeJsonAtomic(file: string, data: unknown) {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data));
  await fs.rename(tmp, file);
}

export async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}
