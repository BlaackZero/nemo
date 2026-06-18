import * as crypto from 'crypto';
import * as path from 'path';
import { RepoIdStrategy, RepoIdentity, WorkspaceInfo } from './types';

const MAX_REPO_ID_LENGTH = 120;
const PATH_HASH_LENGTH = 12;
const INVALID_REPO_CHARS = /[<>:"/\\|?*]/;

export function replaceInvalidFileNameChars(value: string): string {
  let result = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    result += code < 32 || INVALID_REPO_CHARS.test(char) ? '-' : char;
  }
  return result;
}

export function sanitizeRepoId(name: string): string {
  return (
    replaceInvalidFileNameChars(name)
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, MAX_REPO_ID_LENGTH) || 'unnamed-repo'
  );
}

export function normalizeWorkspacePath(folderPath: string): string {
  return path.normalize(folderPath).replace(/\\/g, '/').toLowerCase();
}

export function hashWorkspacePath(folderPath: string): string {
  const normalized = normalizeWorkspacePath(folderPath);
  return crypto
    .createHash('sha256')
    .update(normalized)
    .digest('hex')
    .slice(0, PATH_HASH_LENGTH);
}

export function resolveWorkspaceName(info: WorkspaceInfo): string {
  const rawName = info.workspaceName?.trim() || path.basename(info.folderPath);
  return sanitizeRepoId(rawName);
}

export function resolveRepoIdentity(
  info: WorkspaceInfo,
  strategy: RepoIdStrategy
): RepoIdentity {
  const displayName = resolveWorkspaceName(info);

  if (strategy === 'pathHash') {
    const hash = hashWorkspacePath(info.folderPath);
    return {
      repoId: `${displayName}-${hash}`,
      displayName,
      workspacePath: info.folderPath,
    };
  }

  return {
    repoId: displayName,
    displayName,
    workspacePath: info.folderPath,
  };
}
