# AGENTS.md

Min is an Electron browser (fork of `minbrowser/min`; this checkout's `origin` is `septianari/min`). Electron 44.9.0; CI builds with Node 24.

## Commands

- Setup: `npm install` (runs `postinstall` -> `scripts/setupDevEnv.js`, which flips Electron fuses and re-codesigns the dev Electron on macOS arm64).
- Dev: `npm run start` builds all bundles, then runs the watcher and Electron with `--development-mode` (uses a separate `-development` userData dir). Reload the UI with `Ctrl+Alt+R` / `Cmd+Opt+R`.
- Build bundles only: `npm run build` (`buildMain` + `buildBrowser` + `buildBrowserStyles` + `buildPreload`).
- **There is no test suite.** `npm test` just runs `standard` over `js/**/*.js` and `main/*.js`, and it currently exits non-zero on pre-existing errors (e.g. `ipc is not defined` in `js/webviews.js`). Use `npx standard <path>` to check files you touched; a green run is not the acceptance gate.
- `npm run lint` runs `prettier --write` over all css/md/html/json (including every `localization/languages/*.json`) plus `standard --fix`, piped through `snazzy` (the pipe hides the exit code).
- Packages: `npm run buildWindows | buildMacIntel | buildMacArm | buildDebian | buildRedhat | buildAppImage`; artifacts land in `dist/app`. README also mentions `buildRaspi`/`buildLinuxArm64`, but those scripts do not exist.
- Data lists: `npm run updateFilters | updateHttpsList | updateSuffixes`.

## Build system (easy to get wrong)

- **Main process and preload are concatenated, not imported.** `scripts/buildMain.js` and `scripts/buildPreload.js` join an ordered file list into `main.build.js` and `dist/preload.js`. Any top-level function/`var` from an earlier file is a global for later files (e.g. `main/main.js` uses `settings` and `registryInstaller` without requiring them). New main/preload files must be added to those arrays.
- **The UI is a browserify bundle.** `js/default.js` (plus generated localization) -> `dist/bundle.js`; CSS files are concatenated into `dist/bundle.css`. UI modules use `require(...)` with `js/` and the repo root as module paths.
- `dist/` and `main.build.js` are generated and gitignored — never edit them.
- Localization: `dist/localization.build.js` is generated from `localization/languages/*.json` by `scripts/buildLocalization.js` (invoked by buildMain/buildBrowser). Use `l('stringId')`, or the `data-string`/`data-label`/`data-value` attributes (add `data-allowHTML` for HTML strings). Add new strings to `localization/languages/en-US.json`; other languages may be `null`. There is no `npm run buildLocalization` script despite the wiki.
- A new implicit global used under `js/**` or `main/*` needs a matching entry in `package.json` `standard.globals`, or lint fails.

## Architecture

- **main process** (`main/`): opens windows, app menu, network request filtering, forwards IPC between processes; it does not render UI. Serves the app bundle over the privileged `min://` scheme (`main/minInternalProtocol.js`); the app loads `min://app/index.html`.
- **UI process**: one renderer per window, loads root `index.html` -> `dist/bundle.js`. Has full Node access; must not render untrusted content.
- **places window**: hidden window (`js/places/placesService.html`) owns the Dexie/IndexedDB "places" database (history, bookmarks, full-text search) and answers IPC queries.
- **tabs**: each tab is a sandboxed `WebContentsView` (Electron 44 API; wiki and some comments still say `BrowserView`) managed by `main/viewManager.js`. Its preload (`js/preload/`, concatenated) runs sandboxed with `ipc` access.
- UI and tabs never talk directly — all messages route through the main process.

## Conventions / gotchas

- Style is [Standard](https://standardjs.com): 2-space indent, no semicolons, single quotes. Prettier applies only to css/md/html/json.
- `WebContentsView`s paint above all UI, so to show UI over a page call `webviews.requestPlaceholder(name)`, then `webviews.hidePlaceholder(name)` when done.
- Tab/view API: `webviews.callAsync(tabId, method, args, cb)`, `webviews.bindEvent(event, cb, opts)`, `webviews.bindIPC(name, cb)`.
- Multi-window: `tasks`/`tabs` state is global and replicated across windows by `js/tabState/windowSync.js`; a task belongs to one window via its `selectedInWindow` property.
- Settings: `settings.get/set/listen` in main and UI. In-content pages (`pages/`) use the same API from `js/util/settings/settingsContent.js` over IPC.
- Electron fuses: `GrantFileProtocolExtraPrivileges: false` is set in **both** `scripts/setupDevEnv.js` and `scripts/createPackage.js` — keep them in sync. Packaging uses electron-builder with `asar: false` and `npmRebuild: false` (native rebuilds are broken on Electron 32+); set `MIN_SKIP_WIN_EXE_METADATA_EDIT=1` to skip Windows exe metadata editing when symlink privileges are unavailable.
- CI (`.github/workflows/build-packages.yml`): Node 24, five build targets, and publishes a GitHub release on any tag push. `.nvmrc` says `15.7.0` and is stale.
