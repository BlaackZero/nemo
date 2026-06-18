# Nemo

*Native Copilot memory manager for VS Code*

[![Beta 0.3.1](https://img.shields.io/badge/beta-0.3.1-orange)](CHANGELOG.md)
[![VS Code 1.90+](https://img.shields.io/badge/VS%20Code-1.90%2B-blue)](https://code.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![i18n EN / ES](https://img.shields.io/badge/i18n-EN%20%7C%20ES-lightgrey)](#languages)
[![Copilot Chat](https://img.shields.io/badge/Copilot-Chat-purple)](#copilot-injection)

---

**Nemo beta 0.3.1** manages Copilot native memories plus team-shared Git context and a read-only view of project markdown you can attach to chat without moving files.

## How it works

Four zones in one sidebar:

| Section | Copilot virtual path | On disk | Git | Editable |
|---------|---------------------|---------|-----|----------|
| **Project Memory** | `/memories/repo/` | `workspaceStorage/.../GitHub.copilot-chat/.../repo/` | No | Yes |
| **Global Memory** | `/memories/` | `globalStorage/.../GitHub.copilot-chat/.../` | No | Yes |
| **Shared (Git)** | — | `{workspace}/.nemo/` + `.nemo.json` | Yes | Yes |
| **External** | — | Project markdown in place (AI files + repo `.md`) | Yes (source files) | Read-only |

Nemo reads and writes Copilot's native paths directly. Copilot Chat continues to use those files through its [memory tool](https://code.visualstudio.com/docs/copilot/agents/memory).

**Inject into Chat** attaches any memory or external markdown file via `github.copilot.chat.attachFile` with clipboard fallbacks.

## When to use each zone

| You want… | Use… |
|-----------|------|
| Context for **this project only** (local Copilot agent) | **Project Memory** |
| Preferences that apply in **all your projects** | **Global Memory** |
| Team canon **committed to Git** | **Shared (Git)** → commit `.nemo/` |
| Browse project markdown and **attach without importing** | **External** |
| Move scattered docs into managed memory | **Import to memory** (from toolbar or External item menu) |

Project and Global memories stay on your machine (not in Git). Shared (Git) and External source files live in the repository.

## Quick start

1. Install **GitHub Copilot Chat** (required for Project/Global memory paths).
2. Open a workspace and the **Nemo** panel.
3. Create memories under **Project Memory** — they appear in Copilot as `/memories/repo/...`.
4. Use **External** to open or inject `AGENTS.md`, Cursor rules, and other project markdown in place.
5. Use **Copy to Shared (Git)** when team canon should live in the repo.
6. Use **Copy to Project memory** to pull `.nemo/` content into your local agent context.

### Import to memory

**Import to memory** scans **AI instruction files** and **Project markdown** and copies them into Project Memory, Shared (Git), or both. External shows the same sources read-only; use **Import to memory** on an External file to copy it.

## Customization

Right-click any folder or file in **Project Memory**, **Global Memory**, **Shared (Git)**, or **External** → **Color and icon**:

| Feature | Project Memory | Global Memory | Shared (Git) | External |
|---------|----------------|---------------|--------------|----------|
| Folder color & icon | `.nemo.json` → `copilotRepo.folders` | Extension globalStorage → `.nemo-global-styles.json` | `.nemo.json` → `folders` | `.nemo.json` → `external.folders` |
| Folder display name | `copilotRepo.folders.*.label` | `folders.*.label` (global file) | `folders.*.label` | `external.folders.*.label` |
| File color & icon | `copilotRepo.files` | `files` (global file) | `files` | `external.files` |
| Drag-and-drop reorder | Shared folders/files only | — | Yes | Planned |

Pick **No color** or **Default icon** to reset custom styles. After color/icon, folders prompt for an optional display name.

Styles are overlays only — Copilot memory files on disk are unchanged.

### Roadmap

- Pinned favorites in External
- Manual sort order for External tree
- More icon and color choices
- Hide sections via settings

## Copilot injection

| Step | Behavior |
|------|----------|
| 1 | Attach memory file via Copilot's native attach command |
| 2 | Insert a short prompt asking Copilot to use the attachment |
| 3 | Fallback: paste full content or copy to clipboard |

## Commands

| Command | What it does |
|---------|--------------|
| **New memory / folder** | Create under Project, Global, or Shared (Git) |
| **Edit memory** | Open the file in the editor |
| **Inject into Chat** | Attach context in Copilot Chat |
| **Copy to Project memory** | Copy Shared (Git) → `/memories/repo/` |
| **Copy to Shared (Git)** | Copy Project or Global memory → `.nemo/` |
| **Import to memory** | Scan and import scattered markdown |
| **Color and icon** | All tree items (style overlays) |
| **Refresh** | Reload the tree |

## Compatibility

| Feature | VS Code + Copilot Chat | Cursor + Copilot Chat | Cursor without Copilot |
|---------|------------------------|------------------------|-------------------------|
| Shared (Git) | Yes | Yes | Yes |
| External + import | Yes | Yes | Yes |
| Project / Global memory | Yes | Yes* | Limited |
| Inject into Chat | Yes | Yes* | Clipboard fallback |

Install via **Extensions: Install from VSIX…** (`nemo-context-0.3.1.vsix`).

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `nemo.sharedPath` | `.nemo` | Workspace folder for Shared (Git) memories |

## Development

```bash
npm install
npm run compile
npm run lint
npm test
npm run package
```

## License

[MIT](LICENSE)
