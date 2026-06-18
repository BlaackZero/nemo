import * as path from 'path';
import { i18n } from './i18n';
import { readManifest, removeManifestPaths, writeManifest } from './memoryManifest';
import {
  copyPathCrossDevice,
  MemoryManager,
  movePathCrossDevice,
} from './memoryManager';
import { isMemoryFolder, MemoryNode, MemoryScope } from './types';

async function copyOrMoveNode(
  manager: MemoryManager,
  node: MemoryNode,
  fromScope: MemoryScope,
  toScope: MemoryScope,
  move: boolean
): Promise<MemoryNode> {
  const fromRoot = manager.getRootForScope(fromScope);
  const toRoot = await manager.ensureScopeDir(toScope);
  if (!fromRoot) {
    throw new Error(i18n.error.storageUnavailable());
  }

  const fromAbsolute = isMemoryFolder(node)
    ? node.absolutePath
    : node.filePath;
  const toAbsolute = path.join(toRoot, node.relativePath);

  if (await manager.pathExists(toAbsolute)) {
    throw new Error(i18n.error.alreadyExistsAtTarget(node.relativePath));
  }

  if (move) {
    await movePathCrossDevice(fromAbsolute, toAbsolute);
  } else {
    await copyPathCrossDevice(fromAbsolute, toAbsolute);
  }

  if (toScope === 'sharedGit') {
    const manifest = await readManifest(toRoot);
    if (isMemoryFolder(node)) {
      manifest.folders[node.relativePath] =
        manifest.folders[node.relativePath] ?? {};
    } else {
      manifest.files[node.relativePath] = manifest.files[node.relativePath] ?? {};
    }
    await writeManifest(toRoot, manifest);
  }

  if (move && fromScope === 'sharedGit') {
    const fromManifestRoot = manager.getRootForScope(fromScope);
    if (fromManifestRoot) {
      const manifest = await readManifest(fromManifestRoot);
      removeManifestPaths(manifest, node.relativePath, isMemoryFolder(node));
      await writeManifest(fromManifestRoot, manifest);
    }
  }

  if (isMemoryFolder(node)) {
    return {
      kind: 'folder',
      scope: toScope,
      name: node.name,
      relativePath: node.relativePath,
      absolutePath: toAbsolute,
    };
  }

  return {
    kind: 'file',
    scope: toScope,
    name: node.name,
    relativePath: node.relativePath,
    filePath: toAbsolute,
    format: node.format,
  };
}

export async function syncToCopilotRepo(
  manager: MemoryManager,
  node: MemoryNode,
  move = false
): Promise<MemoryNode> {
  if (node.scope !== 'sharedGit') {
    throw new Error(i18n.error.syncFromSharedGitOnly());
  }

  return copyOrMoveNode(manager, node, 'sharedGit', 'copilotRepo', move);
}

export async function promoteToGit(
  manager: MemoryManager,
  node: MemoryNode,
  move = false
): Promise<MemoryNode> {
  if (node.scope !== 'copilotRepo' && node.scope !== 'copilotUser') {
    throw new Error(i18n.error.promoteFromCopilotOnly());
  }

  return copyOrMoveNode(manager, node, node.scope, 'sharedGit', move);
}

export async function copyNodeToScope(
  manager: MemoryManager,
  node: MemoryNode,
  toScope: MemoryScope
): Promise<MemoryNode> {
  if (node.scope === toScope) {
    throw new Error(i18n.error.sameSourceAndTarget());
  }

  return copyOrMoveNode(manager, node, node.scope, toScope, false);
}
