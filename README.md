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
npm run deploy     # checks + build, then publishes dist/ to the gh-pages branch (GitHub Pages)
```

## Layout

| Path | What lives there |
|---|---|
| `src/model/` | Pure data code, no React: types, calendar-date helpers, IDs, colours, edit operations (move/resize/ripple/duplicate/paste), reading/writing the Gist file (with v4.8 migration) |
| `src/store/` | Zustand stores. `docStore`: the synced document and its undo history. `uiStore`: zoom, selection, gesture in progress |
| `src/timeline/` | The canvas: ruler, deadline lane, rows, blocks, zoom/pan, selection box, drag and resize. Gestures preview with the same pure function they commit |
| `src/app/` | Header, keyboard shortcuts, user-level actions (with delete confirmations), context menu, dialogs, import/download |
| `src/panels/` | Right panel (Inspector, Projects) and the subtask board under the timeline |
| `src/sync/` | Local autosave; Gist client; sync decisions (pure, tested); the sync store (load, upload, conflicts, team key) |

## Controls

Press `?` in the app for the full list. The ones that differ from v4.8:

- **Wheel scrolls; Ctrl+wheel (or pinch) zooms.** v4.8 zoomed on every wheel event.
- **Shift+drag** a block or edge **ripples**: later blocks in the same row move with it.
- **Alt+drag an edge** is the rolling resize (v4.8 used Shift+edge).
- **Ctrl+D** duplicates next to the original; **Ctrl+A** selects all; **Esc** cancels a drag or clears the selection; **Enter/F2** renames.
- Deleting a project leaves its blocks as “No Project”; deleting a category or row that has blocks asks first.
  Archiving a project hides its blocks and deadline flag until restored.

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

## Sync

- Anyone can view the shared timeline. Editing needs the **team key**: a GitHub token from the Gist's owner
  with Gist access (only a Gist's owner can save to it). It's stored only in that browser
  (`localStorage`, same key as v4.8, so existing users keep theirs). Without it the app is view-only.
- Edits autosave in the browser; **Upload** sends them to the Gist. The header shows the shared version and
  "Unsaved changes" when there's something to upload.
- Every save bumps `rev`. Before uploading, the app re-reads the Gist: if someone else saved in between it
  asks whether to overwrite theirs or load theirs (undoable). Loading or refreshing takes the shared version
  automatically when you have no unsaved changes, and asks when you do.
- The app re-checks the Gist when the window regains focus (at most once a minute).

## Rolling out

1. **Test on a copy.** Create a new *secret* Gist (same GitHub account) with one file, `data.json`, holding a
   copy of the live file's contents. Run `npm run dev`, click **View only**, paste the key and the copy's
   Gist ID. Edit, upload, refresh, and try a conflict from two browsers. The live Gist is untouched.
2. **Deploy.** `git push`, then `npm run deploy` publishes to the repo's `gh-pages` branch, replacing the
   old site at the same address. Reading the live v4.8 file is safe; nothing changes until someone uploads.
3. **Switch.** In the access dialog, set the Gist ID back to the live one (or clear the stored copy ID).
   The first upload asks for confirmation, then converts the file to v5. Do it once everyone has the new site.

`VITE_GIST_ID` (e.g. in `.env.local`) overrides the default Gist for a build or dev session.

## Testing against the real Gist

`src/model/fileFormat.test.ts` also runs against `src/model/__fixtures__/gist.local.json` when that file
exists. It is a downloaded copy of the team's Gist data and is git-ignored.

## Tooling notes

TypeScript is pinned to 6.0 because typescript-eslint does not support TypeScript 7 yet, and oxlint (the
Vite template's linter) is blocked on this machine by Windows Application Control.
