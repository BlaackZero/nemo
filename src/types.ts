export type MemoryFormat = 'markdown' | 'json';

export type StorageLocation = 'home' | 'globalStorage';

export type RepoIdStrategy = 'workspaceName' | 'pathHash';

export interface MemoryFile {
  name: string;
  filePath: string;
  format: MemoryFormat;
}

export interface RepoIdentity {
  repoId: string;
  displayName: string;
  workspacePath: string;
}

export interface MemoryManagerConfig {
  storageLocation: StorageLocation;
  repoIdStrategy: RepoIdStrategy;
}

export interface WorkspaceInfo {
  workspaceName?: string;
  folderPath: string;
}
