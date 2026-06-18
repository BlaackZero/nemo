import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  getCopilotRepoMemoryDir,
  getCopilotUserMemoryDir,
} from './copilotMemoryPaths';
import { i18n } from './i18n';
import { resolveRepoIdentity } from './repoIdResolver';
import { MemoryManagerConfig, MemoryScope, RepoIdentity } from './types';

export interface StorePathContext {
  getConfig(): MemoryManagerConfig;
  getCurrentRepoIdentity(): RepoIdentity | undefined;
  getExtensionGlobalStoragePath(): string;
  getExtensionContext(): vscode.ExtensionContext;
}

export function normalizeSharedPath(sharedPath: string): string {
  const normalized = sharedPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized || normalized === '.' || normalized.includes('..')) {
    throw new Error(i18n.error.invalidSharedPath());
  }
  return normalized;
}

export function getWorkspaceFolderPath(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/** Legacy v1 personal store root (~/.nemo-store or extension globalStorage). */
export function getLegacyPersonalStorageRoot(context: StorePathContext): string {
  const { storageLocation } = context.getConfig();

  if (storageLocation === 'globalStorage') {
    return path.join(context.getExtensionGlobalStoragePath(), 'repos');
  }

  return path.join(os.homedir(), '.nemo-store');
}

/** Legacy v1 personal store for the current workspace repo id. */
export function getLegacyPersonalRoot(context: StorePathContext): string | undefined {
  const identity = context.getCurrentRepoIdentity();
  if (!identity) {
    return undefined;
  }

  return path.join(getLegacyPersonalStorageRoot(context), identity.repoId);
}

export function getSharedGitRoot(context: StorePathContext): string | undefined {
  const workspacePath = getWorkspaceFolderPath();
  if (!workspacePath) {
    return undefined;
  }

  const sharedPath = normalizeSharedPath(context.getConfig().sharedPath);
  return path.join(workspacePath, sharedPath);
}

/** @deprecated Use getSharedGitRoot */
export function getSharedRoot(context: StorePathContext): string | undefined {
  return getSharedGitRoot(context);
}

/** @deprecated Use getLegacyPersonalRoot */
export function getPersonalRoot(context: StorePathContext): string | undefined {
  return getLegacyPersonalRoot(context);
}

export function getRootForScope(
  context: StorePathContext,
  scope: MemoryScope
): string | undefined {
  switch (scope) {
    case 'copilotRepo':
      return getCopilotRepoMemoryDir(context.getExtensionContext());
    case 'copilotUser':
      return getCopilotUserMemoryDir(context.getExtensionContext());
    case 'sharedGit':
      return getSharedGitRoot(context);
  }
}

export function createDefaultConfig(): MemoryManagerConfig {
  return {
    storageLocation: 'home',
    repoIdStrategy: 'workspaceName',
    sharedPath: '.nemo',
  };
}

export function readConfigFromWorkspace(): MemoryManagerConfig {
  const config = vscode.workspace.getConfiguration('nemo');
  return {
    storageLocation: config.get<'home' | 'globalStorage'>(
      'storageLocation',
      'home'
    ),
    repoIdStrategy: config.get<'workspaceName' | 'pathHash'>(
      'repoIdStrategy',
      'workspaceName'
    ),
    sharedPath: config.get<string>('sharedPath', '.nemo'),
  };
}

export function resolveRepoIdentityFromWorkspace(
  repoIdStrategy: MemoryManagerConfig['repoIdStrategy']
): RepoIdentity | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return undefined;
  }

  return resolveRepoIdentity(
    {
      workspaceName: vscode.workspace.name,
      folderPath: folder.uri.fsPath,
    },
    repoIdStrategy
  );
}
