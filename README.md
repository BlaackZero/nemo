# Nemo

*Context memories for Copilot*

[![VS Code 1.90+](https://img.shields.io/badge/VS%20Code-1.90%2B-blue)](https://code.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![i18n EN / ES](https://img.shields.io/badge/i18n-EN%20%7C%20ES-lightgrey)](#languages)
[![Copilot Chat](https://img.shields.io/badge/Copilot-Chat-purple)](#copilot-injection)

---

Every Copilot session starts from zero. You paste the same backend rules, the same API conventions, the same "please use TypeScript strict" note — again and again.

**Nemo** keeps that context in files, scoped to your repository. Shared memories live in Git for your team; personal ones stay on your machine.

## Before / after

**Without Nemo:** you open Chat, paste a wall of markdown, hope Copilot remembers it this turn, and repeat tomorrow.

**With Nemo:** open the **Nemo** sidebar, pick a memory, click **Inject into Chat**. Copilot gets a native file attachment plus a short prompt. Done.

```markdown
<!-- nemo: team-rules.md lives in .nemo/ and syncs via git pull -->
```

## How it works

Two zones, one sidebar:

```
Shared (Git)     →  {workspace}/.nemo/          commit & push for the team
Personal         →  ~/.nemo-store/{repo-id}/    never leaves your machine
```

**Inject into Chat** tries, in order:

1. `github.copilot.chat.attachFile` (native chip in Copilot Chat)
2. Full context pasted into the chat input
3. Clipboard fallback if Chat is unavailable

Styles and sort order persist in `.nemo.json` (one manifest per zone).

## Install

### VS Code Marketplace

```bash
code --install-extension blaackzero.nemo-context
```

Or search **Nemo** in the Extensions view.

### From source

```bash
git clone https://github.com/BlaackZero/MemoryManager.git
cd MemoryManager
npm install
npm run package
code --install-extension nemo-context-1.0.0.vsix
```

Press **F5** in VS Code to run the extension in a development host.

## Quick start

1. Open a workspace folder in VS Code.
2. Open the **Nemo** panel in the activity bar.
3. Under **Shared (Git)**, create memories your team will see after `git pull`.
4. Under **Personal**, keep private notes outside the repo.
5. Use **Share with repository** to move a personal memory into `.nemo/`.
6. Use **Inject into Chat** to attach context in Copilot.

## Storage

| Zone | Path |
|------|------|
| Shared | `{workspace}/.nemo/` (configurable) |
| Personal | `~/.nemo-store/{repo-id}/` |

**Commit `.nemo/`** to share team context. Do not add it to `.gitignore` if you want others to receive updates.

Teammates without the extension can still read the `.md` and `.json` files directly.

Setting `nemo.sharedPath` (default `.nemo`) changes the shared folder name.

## Copilot injection

| Step | Behavior |
|------|----------|
| 1 | Attach memory file via Copilot's native attach command |
| 2 | Insert a short prompt asking Copilot to use the attachment |
| 3 | Fallback: paste full content or copy to clipboard |

Injection markers in prompts look like:

```
--- Nemo: rules.md ---
…content…
--- End Nemo ---
```

## Organize memories

- Nested folders (`backend/`, `infra/`, …)
- Colors and icons per folder and memory (two-step picker with live preview)
- Rename, move, and drag-and-drop (including cross-zone share/unshare)
- Order stored in `.nemo.json`

Icon color tints the sidebar **icon only** (VS Code API). Label text keeps the default theme color.

## Commands

| Command | What it does |
|---------|--------------|
| **New memory** | Create a `.md` or `.json` memory in the selected zone |
| **New folder** | Create a folder to group memories |
| **Edit memory** | Open the memory file in the editor |
| **Inject into Chat** | Attach memory context in Copilot Chat |
| **Share with repository** | Move a personal memory/folder into `.nemo/` (Git) |
| **Move to personal** | Move a shared memory/folder to your private store |
| **Open shared folder** | Reveal `.nemo/` in the file explorer |
| **Rename** | Rename a memory or folder |
| **Color and icon** | Set sidebar appearance for an item |
| **Delete memory / folder** | Remove an item (folder deletes all contents) |
| **Refresh** | Reload the tree |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `nemo.sharedPath` | `.nemo` | Workspace-relative folder for shared memories |
| `nemo.storageLocation` | `home` | Personal store: `~/.nemo-store` or extension `globalStorage` |
| `nemo.repoIdStrategy` | `workspaceName` | How personal memories are keyed per repo |

## Languages

The UI follows VS Code's display language (`Configure Display Language`). Built-in translations:

- **English** (default)
- **Español**

Commands, sidebar, dialogs, and Copilot prompts localize automatically.

## FAQ

**Does it need a config file?**
No. Defaults work out of the box. Optional settings live under **Nemo** in VS Code Settings.

**Do I have to commit `.nemo/`?**
Only if you want shared team context via Git. Personal memories never touch the repo.

**What if my teammate doesn't install Nemo?**
They can read `.nemo/*.md` and `.json` like any other project docs.

**Why doesn't the whole row change color?**
VS Code tree items only support coloring the icon glyph, not the label. Nemo applies your chosen color to the icon via `ThemeIcon`.

**Why "Nemo"?**
Short, memorable, and it stays out of your way — like context that remembers the repo for you.

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
