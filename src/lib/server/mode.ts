/**
 * Server-side file access (reading course folders from the server's disk,
 * ffmpeg, opening files) only makes sense when the app runs on your own
 * machine. On a hosted deployment the server's disk is not yours, so these
 * features are disabled and folders are opened in the browser instead.
 *
 * Override with LUI_SERVER_FILES=1 (force on) or LUI_SERVER_FILES=0 (force off).
 */
export function serverFilesEnabled() {
  const flag = process.env.LUI_SERVER_FILES;
  if (flag === "1") return true;
  if (flag === "0") return false;
  return !process.env.VERCEL;
}

export const SERVER_FILES_DISABLED_MESSAGE =
  "Server folders are disabled on the hosted version. Open a folder from this device instead.";
