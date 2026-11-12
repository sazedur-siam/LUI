# CLAUDE.md

LUI is a local-only course player. A folder on disk becomes a course (modules, lessons, resources) that is viewed in the browser, with progress tracking. `README.md` covers the features and the folder rules users rely on; this file covers how to work on the code.

@AGENTS.md

## Commands

```bash
pnpm dev          # 127.0.0.1:3000. Never bind to 0.0.0.0; the app serves local files.
pnpm typecheck    # run `npx next typegen` first if route types (PageProps/RouteContext) are stale
pnpm lint         # must report 0 problems
pnpm build        # the real check for Cache Components / prerender errors
```

Run all three (typecheck, lint, build) before you finish a change. There is no test suite. Verify behaviour in the browser (see Testing).

## Stack and versions that matter

- **Next.js 16** with `cacheComponents: true` and `partialPrefetching: true`. Read `node_modules/next/dist/docs/` before using a Next API (see AGENTS.md).
- **React 19.3** with the React Compiler ESLint rules. `react-hooks/set-state-in-effect` and "Cannot access refs during render" are errors, not warnings.
- **Tailwind 4** + **shadcn/ui** (Radix base, `radix-nova` style). Components in `src/components/ui/` are generated; edit them only for deliberate overrides.
- **Video.js 10** (`@videojs/react`). Vidstack is deprecated; don't add it back. Docs are bundled at `node_modules/@videojs/react/docs/`.
- **pnpm 11**: packages with install scripts must be allowed under `allowBuilds` in `pnpm-workspace.yaml` (`ffmpeg-static: true` is needed for the binary download).

## Architecture

```
Browser ──► app/ pages (server components) ──► lib/server/* (fs, JSON store, ffmpeg)
        ──► app/api/* route handlers ──► lib/server/serve.ts (Range streaming)
```

- `lib/server/scanner.ts`: folder → `Course`. Ids are `sha1` hashes of relative paths, so they stay stable across rescans. `lib/server/courses.ts` caches each scan for 15s per course.
- `lib/server/store.ts`: `.data/db.json` (library and progress). It is held in memory on `globalThis` (which survives HMR), with debounced atomic writes. Never write `db.json` while the server is running; go through the API or actions.
- `lib/server/media.ts`: the playback pipeline. `decide()` picks `direct | remux | transcode` from the ffprobe info and the browser caps sent by the client (`lib/client/caps.ts`).
  - remux = ffmpeg stream copy to `.data/cache/media/<key>/media.mp4`, polled by the client until ready.
  - transcode = an HLS VOD playlist generated up front (4s segments). Segments are encoded on demand. A request far beyond the encoder's position restarts ffmpeg with `-ss` / `-start_number` / `-output_ts_offset`. At most 2 encoders run at a time (LRU).
  - Bump `PIPELINE_VERSION` when changing encoder output so old caches are ignored.
- `components/viewers/media-player.tsx`: fallback chain on the client. A media `error` event, or `videoWidth === 0` for a file that has video, moves direct → remux → transcode.
- `components/learn/progress-context.tsx`: client progress store with optimistic updates. It queues POSTs to `/api/progress/[courseId]` and flushes with `sendBeacon` on `pagehide`.
- `app/course/[courseId]/learn/layout.tsx` holds the sidebar (it persists across lesson navigation); `[lessonId]/page.tsx` renders `LessonView`.

## Conventions and gotchas

- **Cache Components:** any server component that reads params, the filesystem or the store must be inside `<Suspense>` and call `await connection()` before reading. Otherwise you get "blocking route" / `Date.now()` prerender errors. Follow the pattern in the existing pages: a sync page that renders `<Suspense><AsyncInner params={params} /></Suspense>`.
- **Route handlers** get params via `ctx: RouteContext<"/api/...">`, and pages use `PageProps<"/...">`. Both are global types from `next typegen`.
- **Lint-safe React patterns used here:**
  - Never reset state at the top of an effect. Key the state by its inputs instead, e.g. `{ key, data }` with `const data = state.key === key ? state.data : null` (see `media-player.tsx`, `use-text.ts`, `code-block.tsx`).
  - Write refs only in event handlers or effects, never during render.
  - Derive state from changing props by adjusting it during render (see `openedFor` in `course-sidebar.tsx`).
  - Read localStorage through `useLocalPref` (`useSyncExternalStore`), never in `useState` initialisers, which would break hydration.
- **Security invariants (keep them):**
  - Every course file path goes through `resolveInside()` (`lib/server/paths.ts`), which checks the realpath against the course root.
  - HTML/SVG served from `/api/file` carry `Content-Security-Policy: sandbox …`, and the iframe has a `sandbox` without `allow-same-origin`.
  - Notebook HTML/SVG output goes through DOMPurify.
- **ffmpeg binaries** come from `ffmpeg-static` / `ffprobe-static`, which are listed in `serverExternalPackages`. Spawn with argument arrays, never a shell string. Add `/*turbopackIgnore: true*/` to dynamic `spawn` calls that would otherwise trace the whole project.
- **Design:** minimal white UI with light-blue Material accents; the user rejected black-and-white and multi-hue palettes.
  - Theme tokens live in `src/app/globals.css` (`--primary: #1e88e5`, Blue 50 `#e3f2fd` tints, Blue Grey text).
  - Accent colours come from `lib/colors.ts` (blue family only) and per-kind colours from `KIND_META` in `components/kind-icon.tsx`.
  - Use the `.tint` utility with `style={{ "--c": hex }}` for soft tinted chips.
  - Don't introduce dark backgrounds or a dark mode.
- **Shared code:** `lib/` modules imported by client code must not import `lib/server/*` (those modules start with `import "server-only"`).

## Testing changes

1. `pnpm dev`, then add a course through the UI (**Add course** → path). Never edit `.data/db.json` by hand.
2. Media: generate small clips in several formats into a folder under `.playwright-mcp/` (git-ignored) and add it as a course. Use bash for ffmpeg arrays, because zsh doesn't split `$VAR` arguments. Useful set: AVI (mpeg4 + mp3), WMV, FLV, HEVC MOV, MKV with AC-3, WebM VP9/Opus, MPEG-2, MP4 with an `.srt` sidecar, MP3, WMA, FLAC. Each should play, and the route label under the player shows which path it took.
3. `curl` checks for the pipeline:
   - `GET /api/media/<course>/<lesson>?caps=h264,aac&force=transcode` returns a plan.
   - Then fetch its `index.m3u8` and `seg_00000.ts`, plus a far segment to check the seek restart.
4. If a dev server is already running on :3000 and serves stale CSS, restart it and `rm -rf .next`. Turbopack's CSS cache can stick.
5. Remove test courses and reset any progress you created in the user's real courses afterwards.

## Git workflow

- Commit as the repo-local identity `sazedur-siam <37084945+sazedur-siam@users.noreply.github.com>`, which is already configured in `.git/config`. Never use the global work identity here.
- **No AI attribution:** no `Co-Authored-By: Claude`, and no "Generated with Claude Code" footers in commits or PRs.
- Ship work as small chunks:
  1. Create a branch from `main` (`feat/…`, `fix/…`, `docs/…`, `chore/…`) and commit with Conventional Commits.
  2. Push the branch and open a PR on `sazedur-siam/LUI`.
  3. Merge it (merge commit), delete the branch, then pull `main`.
- `gh` has two accounts and the work account is the active one. Run `gh` commands as `GH_TOKEN=$(gh auth token --user sazedur-siam) gh …`. Pushes use the repo-local credential helper, which fetches that same token.
