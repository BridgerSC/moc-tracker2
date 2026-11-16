# MoC Timeline (v5 rebuild)

A production timeline: projects with deadlines, rows grouped into phases, blocks you drag, resize and
duplicate, a subtask board per block, and sync through a shared GitHub Gist.

This is a clean rewrite of v4.8, whose source was lost (only the built site survived).
[`docs/v4.8-spec.md`](docs/v4.8-spec.md) is the behaviour reverse-engineered from that build, including
a list of its bugs; it is the reference for what the rebuild has to do.

## Commands

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests (vitest, run in America/Denver so DST cases are real)
npm run typecheck
npm run lint
npm run build      # production build into dist/
```

## Layout

| Path | What lives there |
|---|---|
| `src/model/` | Pure data code, no React: types, calendar-date helpers, IDs, colours, reading/writing the Gist file (with v4.8 migration) |
| `src/store/` | Zustand stores. `docStore` holds the synced document and its undo history |
| `src/timeline/` | *(milestone 2)* the canvas: ruler, rows, blocks, zoom/pan, drag and resize |
| `src/panels/` | *(milestone 3)* sidebar, inspector, projects, subtask board |
| `src/sync/` | *(milestone 4)* Gist load/save, token handling, conflicts, local autosave |

## Data format

The Gist file `data.json` is written as format v5:

```json
{
  "version": 5,
  "rev": 12,
  "savedAt": "2026-11-17T09:00:00.000Z",
  "savedBy": "Alice",
  "projects": [{ "id": "p1", "name": "…", "color": "#FFD166", "deadline": "2026-12-01", "archived": false, "notes": "" }],
  "groups":   [{ "id": "g1", "name": "…", "steps": [{ "id": "s1", "name": "…" }] }],
  "tasks":    [{ "id": "t1", "projectId": "p1", "stepId": "s1", "start": "2026-11-16", "duration": 5,
                 "title": "…", "notes": "", "subtasks": [{ "id": "st1", "title": "…", "status": "todo" }] }]
}
```

- Dates are calendar strings, and date arithmetic is done in UTC day numbers, so time zones and daylight
  saving can never shift a date. (v4.8 stored offsets from 2026-05-01 and showed winter dates a day early.)
- `rev` goes up by one on every save and is how a save detects that someone else saved first.
- v4.8 files (and older v4 files with top-level `steps`) are read and upgraded automatically. Files from a
  newer format version are refused rather than overwritten.

**Switching formats is one-way:** once this app saves to the Gist, the old v4.8 site can no longer read it.
Deploy this build to the same GitHub Pages address so everyone switches at once.

## Testing against the real Gist

`src/model/fileFormat.test.ts` also runs against `src/model/__fixtures__/gist.local.json` when that file
exists. It is a downloaded copy of the team's Gist data and is git-ignored.

## Tooling notes

TypeScript is pinned to 6.0 because typescript-eslint does not support TypeScript 7 yet, and oxlint (the
Vite template's linter) is blocked on this machine by Windows Application Control.
