# CLAUDE.md

LUI is a course player for folders of videos, PDFs and notes. It runs in two modes:
- **Local:** the Next.js server reads folders on its own disk, with ffmpeg for any video format.
- **Hosted / device:** the browser reads a folder on the user's device, and progress lives in IndexedDB. This is what https://luilearn.vercel.app runs.

`README.md` covers features and folder rules for users; this file covers how to work on the code. Every change must work in **both** modes.

@AGENTS.md

## Commands

```bash
pnpm dev                     # 127.0.0.1:3000. Never bind to 0.0.0.0; local mode serves files from disk.
LUI_SERVER_FILES=0 pnpm dev  # behave like Vercel: server file APIs off, only device courses
pnpm typecheck               # run `npx next typegen` first if route types (PageProps/RouteContext) are stale
pnpm lint                    # must report 0 problems
pnpm build                   # the real check for Cache Components / prerender errors
```

Run typecheck, lint and build before you finish a change. There is no test suite. Verify behaviour in the browser (see Testing).

## Stack and versions that matter

- **Next.js 16** with `cacheComponents: true` and `partialPrefetching: true`. Read `node_modules/next/dist/docs/` before using a Next API (see AGENTS.md).
  - Middleware is now `src/proxy.ts`.
  - `error.tsx` gets `{ error: unknown, retry }`.
- **React 19.3** with the React Compiler ESLint rules. `react-hooks/set-state-in-effect` and "Cannot access refs during render" are errors, not warnings.
- **Tailwind 4** + **shadcn/ui** (Radix base, `radix-nova` style). Components in `src/components/ui/` are generated; edit them only for deliberate overrides.
- **Video.js 10** (`@videojs/react`). Vidstack is deprecated; don't add it back. Docs are bundled at `node_modules/@videojs/react/docs/`.
- **Mediabunny** (pinned `1.62.1`): in-browser MKV → MP4 remux and container durations. Import it only via dynamic `import("mediabunny")`.
- **pnpm 11**: packages with install scripts must be allowed under `allowBuilds` in `pnpm-workspace.yaml` (`ffmpeg-static: true` is needed for the binary download).
- Pin new dependencies to a release at least two weeks old.

## Architecture

```
Local:  page (server) ──► lib/server/* (scanner, JSON store, ffmpeg) ──► app/api/* (Range streaming)
Device: page (client) ──► components/device/* ──► lib/client/device-* (IndexedDB, folder handles, object URLs)
Both:   CourseSource context ──► viewers / player / notes / transcript (never hard-code /api URLs)
```

- **One course algorithm:** `lib/course-builder.ts` turns a flat file list into a `Course`.
  - The server scanner (`lib/server/scanner.ts`, sha1 ids) and device folders (`lib/client/device-files.ts`, `cyrb53` ids) both use it.
  - Ids are path-based, so they're stable across rescans, but they differ between modes. Match by relative path when moving data across (`lib/progress-transfer.ts` does).
- **CourseSource** (`components/source/course-source.tsx`):
  - provides `getUrl` / `readText` / `mediaPlan` / `rescan` and an optional `openExternally`
  - flags: `canConvert` (server ffmpeg) and `canRemux` (server or in-browser)
  - `createServerSource` is local mode; `createDeviceSource` (in `components/device/device-course.tsx`) is device mode
  - Viewers must use `useFileUrl` / `useFileAccess` / `useFileText`.
- **Mode switch:** `lib/server/mode.ts` (`serverFilesEnabled()` is false on Vercel; `LUI_SERVER_FILES` overrides it) plus `src/proxy.ts`, which returns 403 for the file APIs. Any new route that touches the disk must be in the proxy matcher **and** check `serverFilesEnabled()`.
- **Local pieces:**
  - `lib/server/store.ts`: `.data/db.json`, held in memory on `globalThis` with debounced atomic writes. Never write it while the server runs.
  - `lib/server/courses.ts`: caches scans for 15s.
  - `lib/server/media.ts`: `decide()` picks `direct | remux | transcode`.
    - remux = ffmpeg stream copy to `.data/cache/media/<key>/media.mp4`
    - transcode = an HLS VOD playlist generated up front, with 4s segments encoded on demand; a far seek restarts ffmpeg; at most 2 encoders (LRU)
    - Bump `PIPELINE_VERSION` when encoder output changes.
- **Device pieces:**
  - `lib/client/device-db.ts`: IndexedDB `lui-device` with three stores: courses (with `handle`, `access`), progress, durations.
  - `lib/client/device-files.ts`: the Chromium `showDirectoryPicker` handle is persisted; Safari/Firefox use a `webkitdirectory` input (re-picked each visit).
    - MKV object URLs are created untyped so Chrome sniffs them.
    - `isNewDeviceCourse()` is `addedAt === scannedAt`.
  - `lib/client/browser-remux.ts`: Mediabunny remux, used when the browser can't open MKV or after a direct-play failure.
  - `DeviceCourseGate`: loads the record, checks access (granted / needs permission / needs re-pick / folder missing), rescans in the background (at most every 30s), measures durations, and provides the source.
- **Player fallback** (`components/viewers/media-player.tsx`): a media `error`, or `videoWidth === 0`, moves direct → remux (server or browser) → transcode (server only) → error card. A `MissingFileError` (`lib/errors.ts`) shows the "moved or renamed" card instead.
- **Progress:** `components/learn/progress-context.tsx` is an optimistic client store with a pluggable saver: the server API (beacon on `pagehide`), or `saveDeviceProgress` (IndexedDB). Patches are applied by the shared `applyProgressPatch()` (completed, position, page, notes, opened).
- **Guided courses:** `access?: "open" | "guided"` on both record types (missing = open).
  - The lock rule is `lib/lesson-access.ts`; the client `LessonAccessProvider` (`components/learn/lesson-access.tsx`) derives it from live progress.
  - Gate locked lessons **on the client**, never in a server page, because the server store lags behind queued progress writes.
  - `resumeLesson(course, progress, access)` never returns a locked lesson.
- **Routes:**
  - `app/course/[courseId]/…` is local and `app/device/[courseId]/…` is device; both reuse `CourseOverview`, `LearnFrame`, `LessonView`.
  - The learn layout holds the sidebar, so it persists across lesson navigation.

## Conventions and gotchas

- **Cache Components:**
  - Server components that read params, the filesystem or the store sit inside `<Suspense>` and call `await connection()` first. Follow the pattern in the existing pages: a sync page rendering `<Suspense><AsyncInner params={params} /></Suspense>`.
  - Client components using `useParams` / `useSearchParams` / `usePathname` also need a `<Suspense>` ancestor.
  - The device learn segments set `export const instant = false`, because they render from IndexedDB.
- **Route handlers** get params via `ctx: RouteContext<"/api/...">`, and pages use `PageProps<"/...">`. Both are global types from `next typegen`.
- **Lint-safe React patterns used here:**
  - Never reset state at the top of an effect. Key the state by its inputs instead, e.g. `{ key, data }` with `const data = state.key === key ? state.data : null` (see `media-player.tsx`, `use-text.ts`).
  - Async loaders run inside the effect with a `cancelled` flag; re-run them by bumping a `version` state (see `DeviceCourseGate`).
  - Write refs only in event handlers or effects, never during render.
  - Derive state from changing props by adjusting it during render (see `openedFor` and `seenFrontier` in `course-sidebar.tsx`).
  - Read localStorage through `useLocalPref` / `useLocalNumber` (`useSyncExternalStore`), never in `useState` initialisers.
  - Siblings rendered with `key={lesson.id}` need distinct keys (e.g. `notes-${id}`).
- **Global keys:** `Shift+N` / `Shift+P` move between lessons, `N` adds a note stamp, `T` toggles the transcript. All of them ignore events from inputs and textareas.
- **Security invariants (keep them):**
  - Every server file path goes through `resolveInside()` (`lib/server/paths.ts`), which checks the realpath against the course root and refuses when server files are disabled.
  - HTML/SVG served from `/api/file` carry `Content-Security-Policy: sandbox …`.
  - Course HTML iframes use `sandbox` without `allow-same-origin`.
  - Never offer "open in new tab" for device blob URLs of HTML/SVG; they would run with the app's origin.
  - Notebook HTML/SVG output goes through DOMPurify.
- **ffmpeg binaries** come from `ffmpeg-static` / `ffprobe-static`, which are listed in `serverExternalPackages`. Spawn with argument arrays, never a shell string. Add `/*turbopackIgnore: true*/` to dynamic `spawn` calls.
- **Design:** minimal white UI with light-blue Material accents; the user rejected black-and-white and multi-hue palettes.
  - Theme tokens live in `src/app/globals.css` (`--primary: #1e88e5`, Blue 50 `#e3f2fd` tints, Blue Grey text).
  - Accent colours come from `lib/colors.ts` (blue family only) and per-kind colours from `KIND_META` in `components/kind-icon.tsx`.
  - Use `.tint` with `style={{ "--c": hex }}` for chips, and `StatusNotice` for empty, error, locked and missing states.
  - Use `bg-linear-to-*` (Tailwind 4), and the `plural()` helper from `lib/files.ts` for counts.
  - Don't introduce dark backgrounds or a dark mode.
- **Shared code:** `lib/` modules imported by client code must not import `lib/server/*` (those modules start with `import "server-only"`).

## Testing changes

1. **Local:** run `pnpm dev`, then add a course through **Add course** → path. Never edit `.data/db.json` by hand.
2. **Device flow (Chrome automation):** the native picker can't be automated, so:
   - Chrome path: write files into OPFS (`navigator.storage.getDirectory()`) and set `window.showDirectoryPicker = async () => handle` before clicking **Open in browser** / **Open folder**.
   - Safari/Firefox path: set `window.showDirectoryPicker = undefined`, click the button, and upload a folder to the file chooser.
   - A full page reload forgets picked file lists, which is the expected "Re-open" screen.
3. **Media:** generate small clips in several formats into a folder under `.playwright-mcp/` (git-ignored) and add it as a course.
   - Use bash for ffmpeg arrays, because zsh doesn't split `$VAR` arguments.
   - Useful set: AVI (mpeg4 + mp3), WMV, FLV, HEVC MOV, MKV with AC-3, WebM VP9/Opus, MPEG-2, MP4 with an `.srt` sidecar, MP3, WMA, FLAC.
   - The route label under the player shows which path each one took.
4. **Pipeline:** `GET /api/media/<course>/<lesson>?caps=h264,aac&force=transcode`, then fetch `index.m3u8`, `seg_00000.ts`, and a far segment.
5. **Stale state:**
   - If a dev server already on :3000 serves stale CSS, restart it and `rm -rf .next`.
   - If the automation browser reports "already in use", a previous session's automation Chrome (the `mcp-chrome-*` profile) is still running. Close only that one.
6. **Clean up:** remove test courses and reset any progress you created in the user's real courses (AI Engineer and IELTS courses) afterwards.

## Git workflow

- Commit as the repo-local identity `sazedur-siam <37084945+sazedur-siam@users.noreply.github.com>`, which is already configured in `.git/config`. Never use the global work identity here.
- **No AI attribution:** no `Co-Authored-By: Claude`, and no "Generated with Claude Code" footers in commits or PRs.
- Ship work as small chunks:
  1. Create a branch from `main` (`feat/…`, `fix/…`, `docs/…`, `chore/…`) and commit with Conventional Commits.
  2. Push the branch and open a PR on `sazedur-siam/LUI`.
  3. Merge it (merge commit), delete the branch, then pull `main`.
- **`main` deploys to Vercel**, so only merge after typecheck, lint and build pass.
- `gh` has two accounts and the work account is the active one. Run `gh` commands as `GH_TOKEN=$(gh auth token --user sazedur-siam) gh …`. Pushes use the repo-local credential helper, which fetches that same token.
- `docs/` (local feature specs) is git-ignored. Delete a spec once its feature ships.
