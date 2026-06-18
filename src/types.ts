export type MemoryFormat = 'markdown' | 'json';

export type StorageLocation = 'home' | 'globalStorage';

export type RepoIdStrategy = 'workspaceName' | 'pathHash';

export type MemoryScope = 'personal' | 'shared';

export interface MemoryFolder {
  kind: 'folder';
  scope: MemoryScope;
  name: string;
  relativePath: string;
  absolutePath: string;
}

export interface MemoryFile {
  kind: 'file';
  scope: MemoryScope;
  name: string;
  relativePath: string;
  filePath: string;
  format: MemoryFormat;
}

export type MemoryNode = MemoryFolder | MemoryFile;

export function isMemoryFile(node: MemoryNode): node is MemoryFile {
  return node.kind === 'file';
}

export function isMemoryFolder(node: MemoryNode): node is MemoryFolder {
  return node.kind === 'folder';
}

export interface RepoIdentity {
  repoId: string;
  displayName: string;
  workspacePath: string;
}

export interface MemoryManagerConfig {
  storageLocation: StorageLocation;
  repoIdStrategy: RepoIdStrategy;
  sharedPath: string;
}

export interface WorkspaceInfo {
  workspaceName?: string;
  folderPath: string;
}
