import * as vscode from 'vscode';

function t(message: string, ...args: Array<string | number | boolean>): string {
  return vscode.l10n.t(message, ...args);
}

export const i18n = {
  tree: {
    noWorkspace: () => t('Open a workspace folder'),
    copilotRepoSection: () => t('Repository memory'),
    copilotUserSection: () => t('User memory'),
    sharedGitSection: () => t('Shared (Git)'),
    emptyCopilotRepo: () => t('No repository memories — click +'),
    emptyCopilotUser: () => t('No user memories — click +'),
    emptySharedGit: () => t('No shared memories — click +'),
    copilotNotInstalled: () => t('Install GitHub Copilot Chat'),
    copilotInstallHint: () =>
      t('Native memories require the GitHub.copilot-chat extension.'),
    editMemoryTitle: () => t('Edit memory'),
  },
  command: {
    move: () => t('Move'),
    copy: () => t('Copy'),
    delete: () => t('Delete'),
    noColor: () => t('No color'),
    formatMarkdown: () => t('Markdown (.md)'),
    formatJson: () => t('JSON (.json)'),
  },
  style: {
    keepCurrentColor: () => t('Keep current color'),
    keepCurrentIcon: () => t('Keep current icon'),
    colorLabel: (name: string) => t(name),
    iconLabel: (iconId: string) => {
      switch (iconId) {
        case 'folder':
          return t('Folder');
        case 'server':
          return t('Server');
        case 'cloud':
          return t('Cloud');
        case 'database':
          return t('Database');
        case 'rocket':
          return t('Rocket');
        case 'shield':
          return t('Shield');
        case 'gear':
          return t('Gear');
        case 'book':
          return t('Book');
        case 'markdown':
          return t('Markdown');
        case 'json':
          return t('JSON');
        default:
          return iconId;
      }
    },
  },
  prompt: {
    folderName: () => t('Folder name'),
    folderNamePlaceholder: () => t('backend'),
    memoryName: () => t('Memory name (without extension)'),
    memoryNamePlaceholder: () => t('backend-rules'),
    fileFormat: () => t('File format'),
    newName: () => t('New name'),
    iconColor: () => t('Icon color'),
    icon: () => t('Icon'),
    nameRequired: () => t('Name cannot be empty'),
  },
  warning: {
    noWorkspace: () => t('No workspace folder is open.'),
    selectSharedGitToSync: () =>
      t('Select a Shared (Git) memory or folder to sync.'),
    selectCopilotToPromote: () =>
      t('Select a Copilot memory or folder to promote to Git.'),
    confirmSyncToCopilot: (path: string) =>
      t('Copy "{0}" to Copilot repository memory (/memories/repo/)?', path),
    confirmPromoteToGit: (path: string) =>
      t('Copy "{0}" to Shared (Git) for your team?', path),
    confirmDeleteMemory: (name: string) => t('Delete "{0}"?', name),
    confirmDeleteFolder: (name: string) =>
      t('Delete folder "{0}" and all its contents?', name),
  },
  info: {
    syncedToCopilot: () =>
      t('Memory copied to Copilot repository memory (/memories/repo/).'),
    promotedToGit: () =>
      t('Memory copied to Shared (Git). Commit .nemo/ for your team.'),
    attachedToChat: () =>
      t('Memory attached in Copilot Chat. Edit and send when ready.'),
    contentInserted: () =>
      t('Content inserted in Copilot Chat. Edit and send when ready.'),
    copiedToClipboard: () =>
      t('Copilot Chat unavailable. Content copied to clipboard.'),
  },
  error: {
    actionFailed: (action: string, message: string) =>
      t('Could not {0}: {1}', action, message),
    createFolder: () => t('create folder'),
    createMemory: () => t('create memory'),
    syncToCopilotRepo: () => t('sync to Copilot repository memory'),
    promoteToGit: () => t('promote to Shared (Git)'),
    deleteMemory: () => t('delete memory'),
    deleteFolder: () => t('delete folder'),
    rename: () => t('rename'),
    setStyle: () => t('apply style'),
    importContext: () => t('import context'),
    migrateLegacy: () => t('migrate legacy storage'),
    noWorkspace: () => t('No workspace folder is open.'),
    invalidSharedPath: () =>
      t('Shared path must be relative to the workspace and cannot contain "..".'),
    cannotMoveIntoSelf: () => t('Cannot move a folder into itself.'),
    sameSourceAndTarget: () => t('Destination is the same as the source.'),
    syncFromSharedGitOnly: () =>
      t('Only Shared (Git) memories can be synced to Copilot repository memory.'),
    promoteFromCopilotOnly: () =>
      t('Only Copilot memories can be promoted to Shared (Git).'),
    storageUnavailable: () => t('Storage is not available.'),
    stylesSharedGitOnly: () =>
      t('Colors and icons are only available for Shared (Git) memories.'),
    alreadyExistsAtTarget: (path: string) =>
      t('"{0}" already exists at the destination.', path),
  },
  chat: {
    shortPrompt: () =>
      t('Use the attached memory as repository context.'),
    injectionIntro: () =>
      t('Use the following repository context as reference:'),
    injectionStart: (fileName: string) => t('--- Nemo: {0} ---', fileName),
    injectionEnd: () => t('--- End Nemo ---'),
    injectionOutro: () =>
      t('Answer my question using that context.'),
  },
  import: {
    scanning: () => t('Scanning markdown sources…'),
    sourceLegacyPersonal: () => t('Legacy personal store'),
    sourceAi: () => t('Copilot / Cursor / AGENTS'),
    sourceRepo: () => t('Repository markdown'),
    pickTitle: () => t('Select files to import'),
    targetTitle: () => t('Import destination'),
    targetCopilotRepo: () => t('Copilot repository memory (/memories/repo/)'),
    targetSharedGit: () => t('Shared (Git) only'),
    targetBoth: () => t('Copilot repo + Shared (Git)'),
    confirmMove: (count: number, target: string) =>
      t(
        'Import {0} item(s) to {1}? Originals will be deleted unless copying to both destinations.',
        count,
        target
      ),
    noneFound: () => t('No importable markdown sources found.'),
    nothingSelected: () => t('No items selected.'),
    done: (moved: number, skipped: number) =>
      t('Import complete: {0} moved, {1} skipped.', moved, skipped),
    conflictSuffix: () => t('(already exists)'),
  },
  migrate: {
    pickTitle: () => t('Select legacy personal memories to migrate'),
    targetTitle: () => t('Migration destination'),
    targetCopilotRepo: () => t('Copilot repository memory'),
    targetCopilotUser: () => t('Copilot user memory'),
    targetSharedGit: () => t('Shared (Git)'),
    confirm: (count: number, target: string) =>
      t('Migrate {0} legacy item(s) to {1}?', count, target),
    noneFound: () => t('No legacy personal memories found in ~/.nemo-store/.'),
    done: (moved: number, skipped: number) =>
      t('Migration complete: {0} moved, {1} skipped.', moved, skipped),
  },
};
