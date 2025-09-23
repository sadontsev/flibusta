# Frontend Architecture (TS-first)

The frontend is authored in TypeScript under `backend/public/ts/**` and compiled to plain JS in `backend/public/js/**` during builds. The compiled JS is served by nginx and is treated as a build artifact (untracked by Git).

## Structure

- `backend/public/ts/app.ts` – App orchestrator (FlibustaAppNG)
- `backend/public/ts/modules/`
  - `auth.ts` – authentication and user management
  - `ui.ts` – UI helpers (modals, toasts, content injection)
  - `api.ts` – API calls, download handling, top progress bar
  - `display.ts` – rendering for books/authors/genres/series/details
  - `progressive-loader.ts` – infinite scroll + skeletons, tile sizes
  - `enhanced-search.ts` – search filters, sort, result counts
- `backend/public/ts/shims.d.ts` – minimal globals to work without a bundler
- `backend/public/tsconfig.frontend.json` – TS config for the browser build

Global access in the browser is provided by attaching classes to `window.*` and storing the app instance on `window.app`, avoiding the need for a bundler.

## Build

- Build all (server + frontend): `npm run build`
- Frontend only: `npm run build:frontend`

This compiles TS to `backend/public/js/**`. Do not edit files in `public/js` directly; they are generated.

## Repo policy

- `backend/public/js/` is in `.gitignore` and should not be versioned.
- Legacy JS monoliths were archived to `docs/legacy-frontend/` for reference.

## Visual details

- Covers use `object-contain` with a dark background to keep aspect ratios.
- Book tiles have size controls (sm/md/lg) with persistence via `localStorage`.
- A top progress bar indicates API activity.
- Infinite scrolling with skeleton placeholders for smoother loading.
