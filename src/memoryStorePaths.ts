import * as path from 'path';
import * as vscode from 'vscode';
import {
  getCopilotRepoMemoryDir,
  getCopilotUserMemoryDir,
} from './copilotMemoryPaths';
import { i18n } from './i18n';
import { MemoryManagerConfig, MemoryScope } from './types';

export interface StorePathContext {
  getConfig(): MemoryManagerConfig;
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
    case 'external':
      return getWorkspaceFolderPath();
  }
}

export function createDefaultConfig(): MemoryManagerConfig {
  return {
    sharedPath: '.nemo',
  };
}

export function readConfigFromWorkspace(): MemoryManagerConfig {
  const config = vscode.workspace.getConfiguration('nemo');
  return {
    sharedPath: config.get<string>('sharedPath', '.nemo'),
  };
}
