import * as path from 'path';
import * as vscode from 'vscode';
import { MemoryScope } from './types';

/** Matches vscode-copilot-chat memoryTool.tsx */
export const COPILOT_EXTENSION_ID = 'GitHub.copilot-chat';
export const MEMORY_BASE = 'memory-tool/memories';

/** Subdirs under user memory root that belong to other scopes. */
export const COPILOT_USER_RESERVED_DIRS = new Set(['repo', 'session']);

export function isCopilotChatInstalled(): boolean {
  return vscode.extensions.getExtension(COPILOT_EXTENSION_ID) !== undefined;
}

export function isCopilotScope(scope: MemoryScope): boolean {
  return scope === 'copilotRepo' || scope === 'copilotUser';
}

export function scopeUsesManifest(scope: MemoryScope): boolean {
  return scope === 'sharedGit';
}

export function getCopilotRepoMemoryDir(
  context: vscode.ExtensionContext
): string | undefined {
  if (!context.storageUri) {
    return undefined;
  }

  return path.join(
    path.dirname(context.storageUri.fsPath),
    COPILOT_EXTENSION_ID,
    MEMORY_BASE,
    'repo'
  );
}

export function getCopilotUserMemoryDir(
  context: vscode.ExtensionContext
): string | undefined {
  if (!context.globalStorageUri) {
    return undefined;
  }

  return path.join(
    path.dirname(context.globalStorageUri.fsPath),
    COPILOT_EXTENSION_ID,
    MEMORY_BASE
  );
}

export function virtualPathForScope(
  scope: MemoryScope,
  relativePath: string
): string {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (scope === 'copilotRepo') {
    return normalized ? `/memories/repo/${normalized}` : '/memories/repo/';
  }
  if (scope === 'copilotUser') {
    return normalized ? `/memories/${normalized}` : '/memories/';
  }
  return normalized;
}

export function isReservedCopilotUserEntry(name: string, isDirectory: boolean): boolean {
  return isDirectory && COPILOT_USER_RESERVED_DIRS.has(name);
}
