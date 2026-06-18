# Nemo

*Native Copilot memory manager for VS Code*

[![VS Code 1.90+](https://img.shields.io/badge/VS%20Code-1.90%2B-blue)](https://code.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![i18n EN / ES](https://img.shields.io/badge/i18n-EN%20%7C%20ES-lightgrey)](#languages)
[![Copilot Chat](https://img.shields.io/badge/Copilot-Chat-purple)](#copilot-injection)

---

**Nemo v2** is a sidebar to view and manage the same memory files Copilot Chat already uses — plus an optional **Shared (Git)** layer for team context in your repository.

## How it works

Three layers in one sidebar:

| Section | Copilot virtual path | On disk | Git |
|---------|---------------------|---------|-----|
| **Repository memory** | `/memories/repo/` | `workspaceStorage/.../GitHub.copilot-chat/memory-tool/memories/repo/` | No |
| **User memory** | `/memories/` | `globalStorage/GitHub.copilot-chat/memory-tool/memories/` | No |
| **Shared (Git)** | — | `{workspace}/.nemo/` + `.nemo.json` | Yes |

Nemo reads and writes Copilot's native paths directly. Copilot Chat continues to use those files through its [memory tool](https://code.visualstudio.com/docs/copilot/agents/memory).

**Inject into Chat** attaches any memory file via `github.copilot.chat.attachFile` with clipboard fallbacks.

## Quick start

1. Install **GitHub Copilot Chat** (required for native memory paths).
2. Open a workspace and the **Nemo** panel.
3. Create or edit memories under **Repository memory** — they appear in Copilot as `/memories/repo/...`.
4. Use **Promote to Shared (Git)** when team canon should live in the repo.
5. Use **Sync to Copilot repo memory** to pull `.nemo/` content into your local agent context.

### Import context

**Import context** scans AI convention files (`AGENTS.md`, `.github/copilot-instructions.md`, Cursor rules), repo markdown, and legacy `~/.nemo-store/` files. Default destination: **Copilot repository memory**; optional **Shared (Git)** or both.

### Migrate legacy storage

If you used Nemo v1 (`~/.nemo-store/`), run **Migrate legacy storage** once to move files into Copilot user/repo memory or Shared (Git).

## Copilot injection

| Step | Behavior |
|------|----------|
| 1 | Attach memory file via Copilot's native attach command |
| 2 | Insert a short prompt asking Copilot to use the attachment |
| 3 | Fallback: paste full content or copy to clipboard |

## Organize memories

- **Repository / User memory:** plain `.md` files — no Nemo manifest (Copilot-native).
- **Shared (Git):** folders, colors, icons, order in `.nemo.json`.
- Drag-and-drop: Shared (Git) → Repository memory (sync), Copilot → Shared (Git) (promote).

## Commands

| Command | What it does |
|---------|--------------|
| **New memory / folder** | Create under the selected section |
| **Edit memory** | Open the file in the editor |
| **Inject into Chat** | Attach memory context in Copilot Chat |
| **Sync to Copilot repo memory** | Copy Shared (Git) → `/memories/repo/` |
| **Promote to Shared (Git)** | Copy Copilot memory → `.nemo/` for the team |
| **Import context** | Scan and import scattered markdown |
| **Migrate legacy storage** | Move v1 `~/.nemo-store/` into v2 scopes |
| **Open shared folder** | Reveal `.nemo/` in the explorer |
| **Color and icon** | Shared (Git) only |
| **Refresh** | Reload the tree |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `nemo.sharedPath` | `.nemo` | Workspace folder for Shared (Git) memories |
| `nemo.storageLocation` | `home` | *Deprecated v1* — migration only |
| `nemo.repoIdStrategy` | `workspaceName` | *Deprecated v1* — migration only |

## FAQ

**How is this different from Copilot Memory (GitHub-hosted)?**
Nemo manages the **local memory tool** files on disk. [Copilot Memory](https://docs.github.com/copilot/how-tos/use-copilot-agents/copilot-memory) is a separate, opt-in GitHub-hosted feature.

**Do I still commit `.nemo/`?**
Yes, when you want team-shared canon in Git. Repository/User Copilot memories stay local per machine.

**What happened to Personal (`~/.nemo-store/`)?**
Removed in v2. Use **User memory** or **Migrate legacy storage**.

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
