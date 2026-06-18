export type MemoryFormat = 'markdown' | 'json';

export type MemoryScope =
  | 'copilotRepo'
  | 'copilotUser'
  | 'sharedGit'
  | 'external';

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

export interface MemoryManagerConfig {
  sharedPath: string;
}

export type ImportTarget = 'copilotRepo' | 'sharedGit' | 'both';
