import * as path from 'path';
import { i18n } from './i18n';
import { readManifest, removeManifestPaths, writeManifest } from './memoryManifest';
import {
  copyPathCrossDevice,
  MemoryManager,
  movePathCrossDevice,
} from './memoryManager';
import { isMemoryFolder, MemoryNode, MemoryScope } from './types';

const MUTABLE_SCOPES = new Set<MemoryScope>([
  'copilotRepo',
  'copilotUser',
  'sharedGit',
]);

async function copyOrMoveNode(
  manager: MemoryManager,
  node: MemoryNode,
  fromScope: MemoryScope,
  toScope: MemoryScope,
  toRelative: string,
  move: boolean,
  targetFolderRelative?: string
): Promise<MemoryNode> {
  const fromRoot = manager.getRootForScope(fromScope);
  const toRoot = await manager.ensureScopeDir(toScope);
  if (!fromRoot) {
    throw new Error(i18n.error.storageUnavailable());
  }

  const fromAbsolute = isMemoryFolder(node)
    ? node.absolutePath
    : node.filePath;
  const toAbsolute = path.join(toRoot, toRelative);
  const isFolder = isMemoryFolder(node);
  const targetFolder = manager.normalizeRelativePath(targetFolderRelative);

  if (await manager.pathExists(toAbsolute)) {
    throw new Error(i18n.error.alreadyExistsAtTarget(toRelative));
  }

  if (
    isFolder &&
    targetFolder &&
    manager.isDescendantPath(node.relativePath, targetFolder)
  ) {
    throw new Error(i18n.error.cannotMoveIntoSelf());
  }

  if (move) {
    await movePathCrossDevice(fromAbsolute, toAbsolute);
  } else {
    await copyPathCrossDevice(fromAbsolute, toAbsolute);
  }

  if (toScope === 'sharedGit') {
    const manifest = await readManifest(toRoot);
    if (isFolder) {
      manifest.folders[toRelative] = manifest.folders[toRelative] ?? {};
    } else {
      manifest.files[toRelative] = manifest.files[toRelative] ?? {};
    }
    await writeManifest(toRoot, manifest);
  }

  if (move && fromScope === 'sharedGit') {
    const fromManifestRoot = manager.getRootForScope(fromScope);
    if (fromManifestRoot) {
      const manifest = await readManifest(fromManifestRoot);
      removeManifestPaths(manifest, node.relativePath, isFolder);
      await writeManifest(fromManifestRoot, manifest);
    }
  }

  await manager.transferCopilotStyleOverlay(
    fromScope,
    toScope,
    node.relativePath,
    toRelative,
    isFolder,
    move
  );

  if (isFolder) {
    return {
      kind: 'folder',
      scope: toScope,
      name: path.posix.basename(toRelative),
      relativePath: toRelative,
      absolutePath: toAbsolute,
    };
  }

  return {
    kind: 'file',
    scope: toScope,
    name: path.posix.basename(toRelative),
    relativePath: toRelative,
    filePath: toAbsolute,
    format: node.format,
  };
}

function resolveTargetRelativePath(
  manager: MemoryManager,
  node: MemoryNode,
  targetFolderRelative?: string
): string {
  const baseName = path.posix.basename(node.relativePath);
  const targetFolder = manager.normalizeRelativePath(targetFolderRelative);
  return targetFolder ? `${targetFolder}/${baseName}` : node.relativePath;
}

export async function moveNodeToScope(
  manager: MemoryManager,
  node: MemoryNode,
  toScope: MemoryScope,
  targetFolderRelative?: string,
  move = true
): Promise<MemoryNode> {
  const fromScope = node.scope;

  if (fromScope === toScope) {
    throw new Error(i18n.error.sameSourceAndTarget());
  }

  if (
    fromScope === 'external' ||
    toScope === 'external' ||
    !MUTABLE_SCOPES.has(fromScope) ||
    !MUTABLE_SCOPES.has(toScope)
  ) {
    throw new Error(i18n.error.crossScopeMoveUnsupported());
  }

  const toRelative = resolveTargetRelativePath(
    manager,
    node,
    targetFolderRelative
  );

  return copyOrMoveNode(
    manager,
    node,
    fromScope,
    toScope,
    toRelative,
    move,
    targetFolderRelative
  );
}

export async function syncToCopilotRepo(
  manager: MemoryManager,
  node: MemoryNode,
  move = false
): Promise<MemoryNode> {
  if (node.scope !== 'sharedGit') {
    throw new Error(i18n.error.syncFromSharedGitOnly());
  }

  return copyOrMoveNode(
    manager,
    node,
    'sharedGit',
    'copilotRepo',
    node.relativePath,
    move
  );
}

export async function promoteToGit(
  manager: MemoryManager,
  node: MemoryNode,
  move = false
): Promise<MemoryNode> {
  if (node.scope !== 'copilotRepo' && node.scope !== 'copilotUser') {
    throw new Error(i18n.error.promoteFromCopilotOnly());
  }

  return copyOrMoveNode(
    manager,
    node,
    node.scope,
    'sharedGit',
    node.relativePath,
    move
  );
}

export async function copyNodeToScope(
  manager: MemoryManager,
  node: MemoryNode,
  toScope: MemoryScope
): Promise<MemoryNode> {
  if (node.scope === toScope) {
    throw new Error(i18n.error.sameSourceAndTarget());
  }

  return moveNodeToScope(manager, node, toScope, undefined, false);
}
