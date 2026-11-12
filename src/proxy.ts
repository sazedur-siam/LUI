import { NextResponse } from "next/server";

import { SERVER_FILES_DISABLED_MESSAGE, serverFilesEnabled } from "@/lib/server/mode";

/** Block every API that touches the server's disk when running hosted. */
export function proxy() {
  if (serverFilesEnabled()) return NextResponse.next();
  return NextResponse.json({ error: SERVER_FILES_DISABLED_MESSAGE }, { status: 403 });
}

export const config = {
  matcher: [
    "/api/fs/:path*",
    "/api/file/:path*",
    "/api/media/:path*",
    "/api/subs/:path*",
    "/api/reveal/:path*",
    "/api/progress/:path*",
  ],
};
