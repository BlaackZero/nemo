# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.3] - 2026-06-18

### Added

- **Cross-scope drag-and-drop** — move memories between Project, Global, and Shared (Git), including into target folders; style overlays transfer with Copilot scopes.

### Fixed

- **Inject into Chat (macOS and all platforms)** — open chat before attach; try `github.copilot.chat.attachFile` first; attempt native attach for Project/Global files before content fallback; no extra prompt text after successful attach.
- Drag between Project and Global no longer silently no-ops.
- Cross-scope drag **moves** (not copies) including Shared ↔ Copilot.

### Changed

- Drag-and-drop uses unified `moveNodeToScope` with visible error messages on failure.

## [0.3.2] - 2026-06-18

### Added

- **`nemo.injectFolder`** — inject an entire memory folder into Copilot Chat (native folder attach when under workspace; multi-file attach or content fallback otherwise).

### Fixed

- **Inject into Chat** works without the file open in the editor; Project/Global memory uses reliable content injection instead of silent attach failures.
- **`.nemo/` / `.nemo.json`** are no longer created when browsing Project/Global/External memory; the workspace store is created only for Shared (Git) writes or external style overlays.
- Attach pipeline tries `workbench.action.chat.attachFile` before `github.copilot.chat.attachFile`.
- Clear warning when no tree item is selected for inject/edit commands.

### Changed

- Inject file/folder commands appear in the contextual menu (`2_sync`) in addition to inline tree actions.

## [0.3.1] - 2026-06-18

### Added

- **Color and icon** for **Project Memory** and **Global Memory** via style overlays (Copilot files unchanged).
- Project Memory styles stored in extension **workspaceStorage** (`.nemo-project-styles.json`).
- Global Memory styles stored in extension **globalStorage** (`.nemo-global-styles.json`).

### Changed

- Style picker now available for all four tree sections (Project, Global, Shared, External).
- Folder rename/delete/move in Copilot scopes keeps style overlay paths in sync.
- Legacy `copilotRepo` entries in `.nemo.json` are migrated automatically to extension workspace storage.

## [0.3.0] - 2026-06-18

### Added

- **External** section — read-only tree of project markdown (AI instruction files + project markdown); **Inject into Chat** without moving files.
- **`nemo.importExternalFile`** — import a single External file to Project Memory, Shared (Git), or both.
- Colors and icons for **External** items via `external` overlay in `.nemo.json`.

### Changed

- UI rename: **Repository memory** → **Project Memory**, **User memory** → **Global Memory** (ES: Memoria de proyecto / Memoria global).
- Style picker available for **Shared (Git)** and **External** (not Project/Global Copilot-native files).

### Planned

- Pinned favorites in External
- External manual sort / drag reorder
- Section visibility settings

## [0.2.0] - 2026-06-18

### Added

- **Native Copilot memory manager** — sidebar sections for **Repository memory** (`/memories/repo/`), **User memory** (`/memories/`), and **Shared (Git)** (`.nemo/`).
- **`nemo.syncToCopilotRepo`** — copy Shared (Git) → Repository memory.
- **`nemo.promoteToGit`** — copy Repository or User memory → Shared (Git).
- **`nemo.importContext`** — scan **AI instruction files** and **Project markdown**; import to Repository memory, Shared (Git), or both.
- Unified naming via `i18n.zones` across sidebar, import, sync, and promote flows.

### Changed

- Semver reset to **beta 0.2.0** (clean slate; no 1.x/2.x baggage).
- Configuration: only `nemo.sharedPath` (default `.nemo`).

### Removed

- Legacy v1 migration (`nemo.migrateLegacyStorage`, `~/.nemo-store/`).
- Deprecated settings `nemo.storageLocation` and `nemo.repoIdStrategy`.

## Pre-beta (archived)

<details>
<summary>Earlier releases before beta 0.2.0 naming reset</summary>

### [2.0.0] - 2026-06-18

- Native Copilot memory management; sync/promote commands; migrate legacy storage.

### [1.1.0] - 2026-06-18

- Import context wizard into `.nemo/`.

### [1.0.0] - 2026-06-18

- Rebrand to **Nemo**; settings `nemo.*`; shared folder `.nemo/`.

</details>
