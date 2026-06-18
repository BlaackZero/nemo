import * as vscode from 'vscode';

function t(message: string, ...args: Array<string | number | boolean>): string {
  return vscode.l10n.t(message, ...args);
}

export const i18n = {
  tree: {
    noWorkspace: () => t('Open a workspace folder'),
    sharedSection: () => t('Shared (Git)'),
    personalSection: () => t('Personal'),
    emptyShared: () => t('No shared memories'),
    emptyPersonal: () => t('No personal memories — click +'),
    editMemoryTitle: () => t('Edit memory'),
  },
  command: {
    move: () => t('Move'),
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
    selectPersonalToShare: () =>
      t('Select a personal memory or folder to share.'),
    selectSharedToUnshare: () =>
      t('Select a shared memory or folder.'),
    confirmShare: (path: string) =>
      t('Move "{0}" to the repository (shared via Git)?', path),
    confirmUnshare: (path: string) =>
      t('Move "{0}" to personal memories?', path),
    confirmDeleteMemory: (name: string) => t('Delete "{0}"?', name),
    confirmDeleteFolder: (name: string) =>
      t('Delete folder "{0}" and all its contents?', name),
  },
  info: {
    sharedMoved: () =>
      t('Memory moved to shared. Commit .nemo/ for your team.'),
    personalMoved: () =>
      t('Memory moved to personal (it will no longer be in Git).'),
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
    shareToRepo: () => t('share with repository'),
    unshareFromRepo: () => t('move to personal'),
    deleteMemory: () => t('delete memory'),
    deleteFolder: () => t('delete folder'),
    rename: () => t('rename'),
    setStyle: () => t('apply style'),
    noWorkspace: () => t('No workspace folder is open.'),
    invalidSharedPath: () =>
      t('Shared path must be relative to the workspace and cannot contain "..".'),
    cannotMoveIntoSelf: () => t('Cannot move a folder into itself.'),
    sameSourceAndTarget: () => t('Destination is the same as the source.'),
    sharePersonalOnly: () => t('Only personal memories can be shared.'),
    unshareSharedOnly: () =>
      t('Only shared memories can be moved to personal storage.'),
    personalStorageUnavailable: () =>
      t('Personal storage is not available.'),
    sharedStorageUnavailable: () => t('Shared storage is not available.'),
    alreadyExistsShared: (path: string) =>
      t('"{0}" already exists in shared memories.', path),
    alreadyExistsPersonal: (path: string) =>
      t('"{0}" already exists in personal memories.', path),
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
};
