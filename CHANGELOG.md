# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2026-06-18

### Added

- **Color and icon** for **Project Memory** and **Global Memory** via style overlays (Copilot files unchanged).
- Project Memory styles stored in `.nemo.json` under `copilotRepo`.
- Global Memory styles stored in extension globalStorage (`.nemo-global-styles.json`).

### Changed

- Style picker now available for all four tree sections (Project, Global, Shared, External).
- Folder rename/delete/move in Copilot scopes keeps style overlay paths in sync.

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
