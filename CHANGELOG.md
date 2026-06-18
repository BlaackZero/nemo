# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-06-18

### Added

- **Native Copilot memory management** — sidebar sections for **Repository memory** (`/memories/repo/`) and **User memory** (`/memories/`), reading/writing `GitHub.copilot-chat/memory-tool` paths on disk.
- **`nemo.syncToCopilotRepo`** — copy Shared (Git) → Copilot repository memory.
- **`nemo.promoteToGit`** — copy Copilot memory → Shared (Git).
- **`nemo.migrateLegacyStorage`** — one-time migration from v1 `~/.nemo-store/`.
- Module [`copilotMemoryPaths.ts`](src/copilotMemoryPaths.ts) centralizing Copilot storage resolution.

### Changed (breaking)

- `MemoryScope`: `personal` / `shared` → `copilotRepo` / `copilotUser` / `sharedGit`.
- Import wizard default destination: **Copilot repository memory** (optional Shared Git or both).
- Colors/icons manifest (`.nemo.json`) applies to **Shared (Git)** only.
- Removed `nemo.shareToRepo` / `nemo.unshareFromRepo` (replaced by sync/promote commands).

## [1.1.0] - 2026-06-18

### Added

- **Import context to Nemo** wizard (`nemo.importContext`): scans personal memories, AI convention paths (Copilot, Cursor rules, `AGENTS.md`), and repo markdown; multi‑select QuickPick; **move** into `.nemo/` with confirmation.
- Optional `importedFrom` field on shared manifest entries for audit trail.

## [1.0.0] - 2026-06-18

### Added

- Rebrand to **Nemo** — *Context memories for Copilot*.
- English README with install, commands, FAQ, and storage docs.

### Changed (breaking)

- Extension ID: `repo-memory` → `nemo-context`
- Settings: `repoMemory.*` → `nemo.*`
- Shared folder default: `.repo-memory` → `.nemo`
- Manifest: `.repo-memory.json` → `.nemo.json`
- Personal store: `~/.repo-memory-store` → `~/.nemo-store`
- Copilot prompt markers: `Repo Memory` → `Nemo`

No automatic data migration. Rename folders manually or set `nemo.sharedPath` to your old path.

## [0.3.1] - 2026-06-18

### Added

- Localización (i18n) de la UI en **inglés** y **español** vía VS Code `l10n`.
- Strings del manifest (`package.nls.json` / `package.nls.es.json`) y runtime (`l10n/bundle.l10n*.json`).

### Changed

- Mensajes, diálogos, sidebar y prompts de Copilot usan `vscode.l10n.t()`; el idioma sigue la configuración de VS Code.

## [0.3.0] - 2026-06-18

### Added

- Dos zonas en el sidebar: **Compartidas (Git)** y **Personales**.
- Memorias compartidas en `{workspace}/.repo-memory/` (setting `repoMemory.sharedPath`).
- Comandos **Compartir con el repo** (move personal → shared) y **Mover a personales**.
- Comando **Abrir carpeta compartida** en el explorador.
- Drag-and-drop entre zonas para compartir/retirar memorias.
- Manifest `.repo-memory.json` independiente por zona.

### Changed

- `MemoryManager` parametrizado por `MemoryScope` (`personal` | `shared`).
- Menús y context values actualizados por tipo de memoria.

## [0.2.0] - 2026-06-18

### Added

- Inyección en Copilot Chat via `github.copilot.chat.attachFile` con fallbacks.
- Carpetas anidadas para organizar memorias por área (backend, infra, etc.).
- Colores e iconos configurables por carpeta y memoria.
- Renombrar, mover y reordenar items con drag-and-drop.
- Manifest `.repo-memory.json` para estilos y orden persistente.
- Comandos: `createFolder`, `renameNode`, `deleteFolder`, `setNodeStyle`.

### Changed

- TreeView jerárquico con soporte `enableDragAndDrop`.
- `MemoryFile` y `MemoryFolder` unificados como `MemoryNode`.

## [0.1.0] - 2026-06-18

### Added

- Sidebar **Repo Memory** con listado de memorias por repositorio.
- Creación, edición y eliminación de memorias `.md` y `.json`.
- Almacenamiento externo en `~/.repo-memory-store` o `globalStorage`.
- Identificación configurable del repo (`workspaceName` o `pathHash`).
- Inyección de contexto en Copilot Chat con fallback a portapapeles.
- Tests unitarios e integración con `@vscode/test-electron`.
- CI con GitHub Actions.
