import * as fs from 'fs/promises';
import * as path from 'path';
import { i18n } from './i18n';
import { movePathCrossDevice, MemoryManager } from './memoryManager';
import { isMemoryFolder, MemoryNode } from './types';

export async function shareToRepo(
  manager: MemoryManager,
  node: MemoryNode
): Promise<MemoryNode> {
  if (node.scope !== 'personal') {
    throw new Error(i18n.error.sharePersonalOnly());
  }

  const personalRoot = manager.getRootForScope('personal');
  const sharedRoot = await manager.ensureScopeDir('shared');
  if (!personalRoot) {
    throw new Error(i18n.error.personalStorageUnavailable());
  }

  const fromAbsolute = isMemoryFolder(node)
    ? node.absolutePath
    : node.filePath;
  const toAbsolute = path.join(sharedRoot, node.relativePath);

  if (await manager.pathExists(toAbsolute)) {
    throw new Error(i18n.error.alreadyExistsShared(node.relativePath));
  }

  await movePathCrossDevice(fromAbsolute, toAbsolute);

  await manager.transferManifestEntry(
    'personal',
    'shared',
    node.relativePath,
    isMemoryFolder(node)
  );

  if (isMemoryFolder(node)) {
    return {
      kind: 'folder',
      scope: 'shared',
      name: node.name,
      relativePath: node.relativePath,
      absolutePath: toAbsolute,
    };
  }

  return {
    kind: 'file',
    scope: 'shared',
    name: node.name,
    relativePath: node.relativePath,
    filePath: toAbsolute,
    format: node.format,
  };
}

export async function unshareFromRepo(
  manager: MemoryManager,
  node: MemoryNode
): Promise<MemoryNode> {
  if (node.scope !== 'shared') {
    throw new Error(i18n.error.unshareSharedOnly());
  }

  const personalRoot = await manager.ensureScopeDir('personal');
  const sharedRoot = manager.getRootForScope('shared');
  if (!sharedRoot) {
    throw new Error(i18n.error.sharedStorageUnavailable());
  }

  const fromAbsolute = isMemoryFolder(node)
    ? node.absolutePath
    : node.filePath;
  const toAbsolute = path.join(personalRoot, node.relativePath);

  if (await manager.pathExists(toAbsolute)) {
    throw new Error(i18n.error.alreadyExistsPersonal(node.relativePath));
  }

  await fsMkdirParent(toAbsolute);
  await movePathCrossDevice(fromAbsolute, toAbsolute);

  await manager.transferManifestEntry(
    'shared',
    'personal',
    node.relativePath,
    isMemoryFolder(node)
  );

  if (isMemoryFolder(node)) {
    return {
      kind: 'folder',
      scope: 'personal',
      name: node.name,
      relativePath: node.relativePath,
      absolutePath: toAbsolute,
    };
  }

  return {
    kind: 'file',
    scope: 'personal',
    name: node.name,
    relativePath: node.relativePath,
    filePath: toAbsolute,
    format: node.format,
  };
}

async function fsMkdirParent(fileOrFolderPath: string): Promise<void> {
  await fs.mkdir(path.dirname(fileOrFolderPath), { recursive: true });
}
