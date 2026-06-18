import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { i18n } from './i18n';
import { resolveRepoIdentity } from './repoIdResolver';
import { MemoryManagerConfig, MemoryScope, RepoIdentity } from './types';

export interface StorePathContext {
  getConfig(): MemoryManagerConfig;
  getCurrentRepoIdentity(): RepoIdentity | undefined;
  getExtensionGlobalStoragePath(): string;
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

export function getPersonalStorageRoot(context: StorePathContext): string {
  const { storageLocation } = context.getConfig();

  if (storageLocation === 'globalStorage') {
    return path.join(context.getExtensionGlobalStoragePath(), 'repos');
  }

  return path.join(os.homedir(), '.nemo-store');
}

export function getPersonalRoot(context: StorePathContext): string | undefined {
  const identity = context.getCurrentRepoIdentity();
  if (!identity) {
    return undefined;
  }

  return path.join(getPersonalStorageRoot(context), identity.repoId);
}

export function getSharedRoot(context: StorePathContext): string | undefined {
  const workspacePath = getWorkspaceFolderPath();
  if (!workspacePath) {
    return undefined;
  }

  const sharedPath = normalizeSharedPath(context.getConfig().sharedPath);
  return path.join(workspacePath, sharedPath);
}

export function getRootForScope(
  context: StorePathContext,
  scope: MemoryScope
): string | undefined {
  return scope === 'shared'
    ? getSharedRoot(context)
    : getPersonalRoot(context);
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
