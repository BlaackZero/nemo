import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { i18n } from './i18n';
import {
  compareByOrder,
  ensureManifest,
  FileMeta,
  FolderMeta,
  getFileMeta,
  getFolderMeta,
  MemoryManifest,
  readManifest,
  removeManifestPaths,
  renameManifestPaths,
  RESERVED_FILENAMES,
  transferManifestPaths,
  updateSiblingOrder,
  writeManifest,
} from './memoryManifest';
import {
  getPersonalRoot,
  getRootForScope,
  getSharedRoot,
  readConfigFromWorkspace,
  resolveRepoIdentityFromWorkspace,
} from './memoryStorePaths';
import { replaceInvalidFileNameChars } from './repoIdResolver';
import { buildDefaultMemoryContent } from './memoryTemplates';
import {
  MemoryFile,
  MemoryFolder,
  MemoryFormat,
  MemoryManagerConfig,
  MemoryNode,
  MemoryScope,
  RepoIdentity,
} from './types';

export class MemoryManager {
  constructor(private readonly context: vscode.ExtensionContext) {}

  getConfig(): MemoryManagerConfig {
    return readConfigFromWorkspace();
  }

  getExtensionGlobalStoragePath(): string {
    return this.context.globalStorageUri.fsPath;
  }

  getCurrentRepoIdentity(): RepoIdentity | undefined {
    return resolveRepoIdentityFromWorkspace(this.getConfig().repoIdStrategy);
  }

  getPersonalMemoryDir(): string | undefined {
    return getPersonalRoot(this);
  }

  getSharedMemoryDir(): string | undefined {
    return getSharedRoot(this);
  }

  /** @deprecated Use getPersonalMemoryDir or getRootForScope */
  getRepoMemoryDir(): string | undefined {
    return this.getPersonalMemoryDir();
  }

  getRootForScope(scope: MemoryScope): string | undefined {
    return getRootForScope(this, scope);
  }

  normalizeRelativePath(relativePath?: string): string {
    if (!relativePath) {
      return '';
    }

    return relativePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  }

  resolveAbsolutePath(
    scope: MemoryScope,
    relativePath?: string
  ): string | undefined {
    const rootDir = this.getRootForScope(scope);
    if (!rootDir) {
      return undefined;
    }

    const normalized = this.normalizeRelativePath(relativePath);
    if (!normalized) {
      return rootDir;
    }

    return path.join(rootDir, normalized);
  }

  async ensureScopeDir(scope: MemoryScope): Promise<string> {
    const dir = this.getRootForScope(scope);
    if (!dir) {
      throw new Error(i18n.error.noWorkspace());
    }

    await fs.mkdir(dir, { recursive: true });
    await ensureManifest(dir);
    return dir;
  }

  /** @deprecated Use ensureScopeDir('personal') */
  async ensureRepoDir(): Promise<string> {
    return this.ensureScopeDir('personal');
  }

  isMemoryFileName(name: string): boolean {
    return name.endsWith('.md') || name.endsWith('.json');
  }

  isReservedFile(name: string): boolean {
    return RESERVED_FILENAMES.has(name);
  }

  getFormatFromFileName(name: string): MemoryFormat {
    return name.endsWith('.json') ? 'json' : 'markdown';
  }

  async getManifest(scope: MemoryScope): Promise<MemoryManifest | undefined> {
    const rootDir = this.getRootForScope(scope);
    if (!rootDir) {
      return undefined;
    }

    return ensureManifest(rootDir);
  }

  async saveManifest(
    scope: MemoryScope,
    manifest: MemoryManifest
  ): Promise<void> {
    const rootDir = await this.ensureScopeDir(scope);
    await writeManifest(rootDir, manifest);
  }

  async listChildren(
    scope: MemoryScope,
    parentRelativePath?: string
  ): Promise<MemoryNode[]> {
    const absoluteDir = this.resolveAbsolutePath(scope, parentRelativePath);
    const rootDir = this.getRootForScope(scope);
    if (!absoluteDir || !rootDir) {
      return [];
    }

    const parentRelative = this.normalizeRelativePath(parentRelativePath);
    const manifest = await ensureManifest(rootDir);

    try {
      const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
      const folders: MemoryFolder[] = [];
      const files: MemoryFile[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const relativePath = parentRelative
            ? `${parentRelative}/${entry.name}`
            : entry.name;
          folders.push({
            kind: 'folder',
            scope,
            name: entry.name,
            relativePath,
            absolutePath: path.join(absoluteDir, entry.name),
          });
          continue;
        }

        if (
          entry.isFile() &&
          this.isMemoryFileName(entry.name) &&
          !this.isReservedFile(entry.name)
        ) {
          const relativePath = parentRelative
            ? `${parentRelative}/${entry.name}`
            : entry.name;
          files.push({
            kind: 'file',
            scope,
            name: entry.name,
            relativePath,
            filePath: path.join(absoluteDir, entry.name),
            format: this.getFormatFromFileName(entry.name),
          });
        }
      }

      folders.sort((a, b) => {
        const metaA = getFolderMeta(manifest, a.relativePath);
        const metaB = getFolderMeta(manifest, b.relativePath);
        return compareByOrder(metaA.order, metaB.order, a.name, b.name);
      });

      files.sort((a, b) => {
        const metaA = getFileMeta(manifest, a.relativePath);
        const metaB = getFileMeta(manifest, b.relativePath);
        return compareByOrder(metaA.order, metaB.order, a.name, b.name);
      });

      return [...folders, ...files];
    } catch {
      return [];
    }
  }

  getFolderMetaForNode(relativePath: string, manifest: MemoryManifest): FolderMeta {
    return getFolderMeta(manifest, relativePath);
  }

  getFileMetaForNode(relativePath: string, manifest: MemoryManifest): FileMeta {
    return getFileMeta(manifest, relativePath);
  }

  async readMemory(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf8');
  }

  buildDefaultContent(baseName: string, format: MemoryFormat): string {
    return buildDefaultMemoryContent(baseName, format);
  }

  async createFolder(
    scope: MemoryScope,
    folderName: string,
    parentRelativePath?: string
  ): Promise<MemoryFolder> {
    const rootDir = await this.ensureScopeDir(scope);
    const safeName = sanitizeMemoryBaseName(folderName);
    const parentRelative = this.normalizeRelativePath(parentRelativePath);
    const relativePath = parentRelative
      ? `${parentRelative}/${safeName}`
      : safeName;
    const absolutePath = path.join(rootDir, relativePath);

    await fs.mkdir(absolutePath, { recursive: false });

    const manifest = await readManifest(rootDir);
    manifest.folders[relativePath] = {
      ...manifest.folders[relativePath],
      label: folderName.trim(),
    };
    await writeManifest(rootDir, manifest);

    return {
      kind: 'folder',
      scope,
      name: safeName,
      relativePath,
      absolutePath,
    };
  }

  async createMemory(
    scope: MemoryScope,
    baseName: string,
    format: MemoryFormat,
    parentRelativePath?: string
  ): Promise<MemoryFile> {
    const rootDir = await this.ensureScopeDir(scope);
    const parentRelative = this.normalizeRelativePath(parentRelativePath);
    const targetDir = parentRelative
      ? path.join(rootDir, parentRelative)
      : rootDir;

    await fs.mkdir(targetDir, { recursive: true });

    const ext = format === 'json' ? '.json' : '.md';
    const safeName = sanitizeMemoryBaseName(baseName);
    const fileName = `${safeName}${ext}`;
    const filePath = path.join(targetDir, fileName);
    const relativePath = parentRelative
      ? `${parentRelative}/${fileName}`
      : fileName;
    const content = this.buildDefaultContent(baseName.trim(), format);

    await fs.writeFile(filePath, content, { flag: 'wx' });

    const manifest = await readManifest(rootDir);
    manifest.files[relativePath] = manifest.files[relativePath] ?? {};
    await writeManifest(rootDir, manifest);

    return {
      kind: 'file',
      scope,
      name: fileName,
      relativePath,
      filePath,
      format,
    };
  }

  async deleteMemory(
    scope: MemoryScope,
    filePath: string,
    relativePath?: string
  ): Promise<void> {
    const rootDir = this.getRootForScope(scope);
    await fs.unlink(filePath);

    if (rootDir && relativePath) {
      const manifest = await readManifest(rootDir);
      removeManifestPaths(manifest, relativePath, false);
      await writeManifest(rootDir, manifest);
    }
  }

  async deleteFolder(scope: MemoryScope, relativePath: string): Promise<void> {
    const rootDir = await this.ensureScopeDir(scope);
    const normalized = this.normalizeRelativePath(relativePath);
    const absolutePath = path.join(rootDir, normalized);

    await fs.rm(absolutePath, { recursive: true, force: true });

    const manifest = await readManifest(rootDir);
    removeManifestPaths(manifest, normalized, true);
    await writeManifest(rootDir, manifest);
  }

  async renameNode(
    scope: MemoryScope,
    fromRelative: string,
    newName: string,
    isFolder: boolean
  ): Promise<MemoryNode> {
    const rootDir = await this.ensureScopeDir(scope);
    const from = this.normalizeRelativePath(fromRelative);
    const safeName = sanitizeMemoryBaseName(newName);
    const parentRelative = path.posix.dirname(from);
    const toRelative =
      parentRelative === '.'
        ? isFolder
          ? safeName
          : `${safeName}${path.extname(from)}`
        : isFolder
          ? `${parentRelative}/${safeName}`
          : `${parentRelative}/${safeName}${path.extname(from)}`;

    const fromAbsolute = path.join(rootDir, from);
    const toAbsolute = path.join(rootDir, toRelative);

    await fs.rename(fromAbsolute, toAbsolute);

    const manifest = await readManifest(rootDir);
    renameManifestPaths(manifest, from, toRelative, isFolder);
    await writeManifest(rootDir, manifest);

    if (isFolder) {
      return {
        kind: 'folder',
        scope,
        name: safeName,
        relativePath: toRelative,
        absolutePath: toAbsolute,
      };
    }

    return {
      kind: 'file',
      scope,
      name: path.basename(toRelative),
      relativePath: toRelative,
      filePath: toAbsolute,
      format: this.getFormatFromFileName(toRelative),
    };
  }

  isDescendantPath(parentPath: string, childPath: string): boolean {
    const parent = this.normalizeRelativePath(parentPath);
    const child = this.normalizeRelativePath(childPath);
    return child === parent || child.startsWith(`${parent}/`);
  }

  async moveNode(
    scope: MemoryScope,
    fromRelative: string,
    targetFolderRelative: string | undefined,
    isFolder: boolean
  ): Promise<MemoryNode> {
    const rootDir = await this.ensureScopeDir(scope);
    const from = this.normalizeRelativePath(fromRelative);
    const targetFolder = this.normalizeRelativePath(targetFolderRelative);
    const baseName = path.posix.basename(from);

    if (isFolder && targetFolder && this.isDescendantPath(from, targetFolder)) {
      throw new Error(i18n.error.cannotMoveIntoSelf());
    }

    const toRelative = targetFolder ? `${targetFolder}/${baseName}` : baseName;
    const fromAbsolute = path.join(rootDir, from);
    const toAbsolute = path.join(rootDir, toRelative);

    if (from === toRelative) {
      throw new Error(i18n.error.sameSourceAndTarget());
    }

    await fs.mkdir(path.dirname(toAbsolute), { recursive: true });
    await fs.rename(fromAbsolute, toAbsolute);

    const manifest = await readManifest(rootDir);
    renameManifestPaths(manifest, from, toRelative, isFolder);
    await writeManifest(rootDir, manifest);

    if (isFolder) {
      return {
        kind: 'folder',
        scope,
        name: baseName,
        relativePath: toRelative,
        absolutePath: toAbsolute,
      };
    }

    return {
      kind: 'file',
      scope,
      name: baseName,
      relativePath: toRelative,
      filePath: toAbsolute,
      format: this.getFormatFromFileName(toRelative),
    };
  }

  async reorderSiblings(
    scope: MemoryScope,
    parentRelativePath: string | undefined,
    orderedRelativePaths: string[],
    kind: 'folder' | 'file'
  ): Promise<void> {
    const rootDir = await this.ensureScopeDir(scope);
    const manifest = await readManifest(rootDir);
    updateSiblingOrder(
      manifest,
      this.normalizeRelativePath(parentRelativePath),
      orderedRelativePaths,
      kind
    );
    await writeManifest(rootDir, manifest);
  }

  async setFolderStyle(
    scope: MemoryScope,
    relativePath: string,
    style: Partial<FolderMeta>
  ): Promise<void> {
    const rootDir = await this.ensureScopeDir(scope);
    const manifest = await readManifest(rootDir);
    manifest.folders[relativePath] = {
      ...manifest.folders[relativePath],
      ...style,
    };
    await writeManifest(rootDir, manifest);
  }

  async setFileStyle(
    scope: MemoryScope,
    relativePath: string,
    style: Partial<FileMeta>
  ): Promise<void> {
    const rootDir = await this.ensureScopeDir(scope);
    const manifest = await readManifest(rootDir);
    manifest.files[relativePath] = {
      ...manifest.files[relativePath],
      ...style,
    };
    await writeManifest(rootDir, manifest);
  }

  async pathExists(absolutePath: string): Promise<boolean> {
    try {
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  async transferManifestEntry(
    fromScope: MemoryScope,
    toScope: MemoryScope,
    relativePath: string,
    isFolder: boolean
  ): Promise<void> {
    const fromRoot = await this.ensureScopeDir(fromScope);
    const toRoot = await this.ensureScopeDir(toScope);
    const fromManifest = await readManifest(fromRoot);
    const toManifest = await readManifest(toRoot);

    transferManifestPaths(fromManifest, toManifest, relativePath, isFolder);

    await writeManifest(fromRoot, fromManifest);
    await writeManifest(toRoot, toManifest);
  }

  formatForChat(raw: string, format: MemoryFormat): string {
    if (format !== 'json') {
      return raw;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === 'string'
        ? parsed
        : JSON.stringify(parsed, null, 2);
    } catch {
      return raw;
    }
  }
}

export function sanitizeMemoryBaseName(name: string): string {
  const trimmed = name.trim();
  const withoutExt = trimmed.replace(/\.(md|json)$/i, '');
  return (
    replaceInvalidFileNameChars(withoutExt)
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 120) || 'memory'
  );
}

export function getParentRelativePath(relativePath: string): string | undefined {
  const normalized = relativePath.replace(/\\/g, '/');
  const parent = path.posix.dirname(normalized);
  return parent === '.' ? undefined : parent;
}

export async function movePathCrossDevice(
  sourceAbsolute: string,
  destinationAbsolute: string
): Promise<void> {
  try {
    await fs.rename(sourceAbsolute, destinationAbsolute);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== 'EXDEV') {
      throw error;
    }

    await fs.cp(sourceAbsolute, destinationAbsolute, { recursive: true });
    await fs.rm(sourceAbsolute, { recursive: true, force: true });
  }
}
