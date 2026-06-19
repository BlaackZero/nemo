import * as vscode from 'vscode';

function t(message: string, ...args: Array<string | number | boolean>): string {
  return vscode.l10n.t(message, ...args);
}

export const i18n = {
  zones: {
    copilotRepo: () => t('Project Memory'),
    copilotUser: () => t('Global Memory'),
    sharedGit: () => t('Shared (Git)'),
    external: () => t('External'),
    copilotRepoPath: () => t('/memories/repo/'),
    copilotUserPath: () => t('/memories/'),
    bothTargets: () => t('Project Memory + Shared (Git)'),
  },
  tree: {
    noWorkspace: () => t('Open a workspace folder'),
    emptyCopilotRepo: () => t('No project memories — click +'),
    emptyCopilotUser: () => t('No global memories — click +'),
    emptySharedGit: () => t('No shared memories — click +'),
    emptyExternal: () => t('No markdown sources found in this project'),
    copilotNotInstalled: () => t('Install GitHub Copilot Chat'),
    copilotInstallHint: () =>
      t('Native memories require the GitHub.copilot-chat extension.'),
    editMemoryTitle: () => t('Edit memory'),
    alreadyInProjectMemory: () => t('(in Project Memory)'),
  },
  command: {
    move: () => t('Move'),
    copy: () => t('Copy'),
    delete: () => t('Delete'),
    noColor: () => t('No color'),
    formatMarkdown: () => t('Markdown (.md)'),
    formatJson: () => t('JSON (.json)'),
    importExternalFile: () => t('Import to memory'),
  },
  style: {
    keepCurrentColor: () => t('Keep current color'),
    keepCurrentIcon: () => t('Keep current icon'),
    defaultIcon: () => t('Default icon'),
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
    folderDisplayLabel: () => t('Folder display name (leave empty to reset)'),
    memoryName: () => t('Memory name (without extension)'),
    memoryNamePlaceholder: () => t('backend-rules'),
    sharedWorkspaceFolder: () => t('Select the workspace folder for Shared (Git)'),
    fileFormat: () => t('File format'),
    newName: () => t('New name'),
    iconColor: () => t('Icon color'),
    icon: () => t('Icon'),
    nameRequired: () => t('Name cannot be empty'),
  },
  warning: {
    noWorkspace: () => t('No workspace folder is open.'),
    selectSharedGitToSync: () =>
      t('Select a Shared (Git) memory or folder to copy.'),
    selectCopilotToPromote: () =>
      t('Select a Project or Global memory to copy to Shared (Git).'),
    confirmSyncToCopilot: (path: string) =>
      t('Copy "{0}" to Project memory?', path),
    confirmPromoteToGit: (path: string) =>
      t('Copy "{0}" to Shared (Git)?', path),
    confirmDeleteMemory: (name: string) => t('Delete "{0}"?', name),
    confirmDeleteFolder: (name: string) =>
      t('Delete folder "{0}" and all its contents?', name),
    selectTreeItem: () => t('Select a memory item in the Nemo tree.'),
    emptyFolderInject: () => t('This folder has no memory files to inject.'),
  },
  info: {
    syncedToCopilot: () => t('Memory copied to Project memory.'),
    promotedToGit: () =>
      t('Memory copied to Shared (Git). Commit .nemo/ for your team.'),
    currentTarget: () => t('Current target'),
    attachedToChat: () =>
      t('Memory attached in Copilot Chat. Edit and send when ready.'),
    contentInserted: () =>
      t('Content inserted in Copilot Chat. Edit and send when ready.'),
    copiedToClipboard: () =>
      t('Copilot Chat unavailable. Content copied to clipboard.'),
    folderAttachedToChat: () =>
      t('Folder attached in Copilot Chat. Edit and send when ready.'),
    folderContentInserted: () =>
      t('Folder content inserted in Copilot Chat. Edit and send when ready.'),
  },
  error: {
    actionFailed: (action: string, message: string) =>
      t('Could not {0}: {1}', action, message),
    createFolder: () => t('create folder'),
    createMemory: () => t('create memory'),
    syncToCopilotRepo: () => t('copy to Project memory'),
    promoteToGit: () => t('copy to Shared (Git)'),
    deleteMemory: () => t('delete memory'),
    deleteFolder: () => t('delete folder'),
    rename: () => t('rename'),
    setStyle: () => t('apply style'),
    importContext: () => t('import to memory'),
    injectMemory: () => t('inject into Chat'),
    injectFolder: () => t('inject folder into Chat'),
    noWorkspace: () => t('No workspace folder is open.'),
    invalidSharedPath: () =>
      t('Shared path must be relative to the workspace and cannot contain "..".'),
    cannotMoveIntoSelf: () => t('Cannot move a folder into itself.'),
    sameSourceAndTarget: () => t('Destination is the same as the source.'),
    syncFromSharedGitOnly: () =>
      t('Only Shared (Git) memories can be copied to Project memory.'),
    promoteFromCopilotOnly: () =>
      t('Only Project or Global memories can be copied to Shared (Git).'),
    storageUnavailable: () => t('Storage is not available.'),
    stylesUnsupportedScope: () =>
      t('Colors and icons are not available for this item.'),
    externalReadOnly: () =>
      t('External files are read-only. Use Import to memory to copy them.'),
    alreadyExistsAtTarget: (path: string) =>
      t('"{0}" already exists at the destination.', path),
    crossScopeMoveUnsupported: () =>
      t('This item cannot be moved to that destination.'),
  },
  chat: {
    shortPrompt: () => t('Use the attached memory as project context.'),
    injectionIntro: () =>
      t('Use the following project context as reference:'),
    injectionStart: (fileName: string) => t('--- Nemo: {0} ---', fileName),
    injectionEnd: () => t('--- End Nemo ---'),
    injectionOutro: () => t('Answer my question using that context.'),
    folderInjectionOutro: (folderName: string) =>
      t('Answer my question using the "{0}" folder context.', folderName),
  },
  import: {
    scanning: () => t('Scanning markdown sources…'),
    sourceAi: () => t('AI instruction files'),
    sourceProject: () => t('Project markdown'),
    pickTitle: () => t('Select files to import'),
    targetTitle: () => t('Import destination'),
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
};

