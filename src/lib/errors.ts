/** A course file (or the whole course folder) is no longer where the course expects it. */
export class MissingFileError extends Error {
  constructor(public readonly path: string) {
    super("This file was moved, renamed or deleted.");
    this.name = "MissingFileError";
  }
}

export function isMissingFileError(err: unknown): err is MissingFileError {
  return err instanceof Error && err.name === "MissingFileError";
}

/** DOMException names the File System Access API / Blob reads use for vanished files. */
export function isVanishedFileException(err: unknown) {
  return err instanceof DOMException && (err.name === "NotFoundError" || err.name === "NotReadableError");
}
