import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  isReservedCopilotUserEntry,
  scopeSupportsStyles,
  scopeUsesManifest,
  virtualPathForScope,
} from './copilotMemoryPaths';
import { i18n } from './i18n';
import {
  compareByOrder,
  createEmptyManifest,
  ensureExternalOverlay,
  ensureGlobalStyleManifest,
  ensureManifest,
  ensureProjectStyleManifest,
  FileMeta,
  FolderMeta,
  getExternalFileMeta,
  getExternalFolderMeta,
  getFileMeta,
  getFolderMeta,
  getScopeStyleFileMeta,
  getScopeStyleFolderMeta,
  GlobalStyleManifest,
  manifestExists,
  MemoryManifest,
  mergeFileMeta,
  mergeFolderMeta,
  readGlobalStyleManifest,
  readManifest,
  removeManifestPaths,
  removeOverlayPaths,
  renameManifestPaths,
  renameOverlayPaths,
  RESERVED_FILENAMES,
  StyleOverlay,
  transferManifestPaths,
  transferOverlayPaths,
  updateSiblingOrder,
  writeGlobalStyleManifest,
  writeManifest,
  writeProjectStyleManifest,
} from './memoryManifest';
import { scanExternalMarkdownPaths } from './memoryImportScan';
import { moveNodeToScope as moveNodeToScopeSync } from './memorySync';
import {
  getRootForScope,
  getSharedGitRoot,
  getWorkspaceFolderPath,
  readConfigFromWorkspace,
} from './memoryStorePaths';
import { replaceInvalidFileNameChars } from './repoIdResolver';
import { buildDefaultMemoryContent } from './memoryTemplates';
import {
  isMemoryFile,
  MemoryFile,
  MemoryFolder,
  MemoryFormat,
  MemoryManagerConfig,
  MemoryNode,
  MemoryScope,
} from './types';

export type StyleManifest = MemoryManifest | GlobalStyleManifest;

export class MemoryManager {
  private externalPathsCache: string[] | null = null;
  private projectStylesMigrated = false;

  constructor(private readonly context: vscode.ExtensionContext) {}

  getExtensionContext(): vscode.ExtensionContext {
    return this.context;
  }

  getConfig(): MemoryManagerConfig {
    return readConfigFromWorkspace();
  }

  getExtensionGlobalStoragePath(): string {
    return this.context.globalStorageUri.fsPath;
  }

  getExtensionWorkspaceStoragePath(): string | undefined {
    return this.context.storageUri?.fsPath;
  }

  getSharedMemoryDir(): string | undefined {
    return getSharedGitRoot(this);
  }

  getSharedGitDir(): string | undefined {
    return getSharedGitRoot(this);
  }

  invalidateExternalCache(): void {
    this.externalPathsCache = null;
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
    if (scope === 'external') {
      const workspaceRoot = getWorkspaceFolderPath();
      if (!workspaceRoot) {
        throw new Error(i18n.error.noWorkspace());
      }
      return workspaceRoot;
    }

    const dir = this.getRootForScope(scope);
    if (!dir) {
      throw new Error(i18n.error.noWorkspace());
    }

    await fs.mkdir(dir, { recursive: true });
    if (scopeUsesManifest(scope)) {
      await ensureManifest(dir);
    }
    return dir;
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

  async getManifest(scope: MemoryScope): Promise<StyleManifest | undefined> {
    if (scope === 'copilotUser') {
      return ensureGlobalStyleManifest(this.getExtensionGlobalStoragePath());
    }

    if (scope === 'copilotRepo') {
      return this.ensureProjectStyleManifestWithMigration();
    }

    if (!scopeUsesManifest(scope)) {
      return undefined;
    }

    const rootDir =
      scope === 'external'
        ? this.getRootForScope('sharedGit')
        : this.getRootForScope(scope);
    if (!rootDir) {
      return undefined;
    }

    return readManifest(rootDir);
  }

  async saveManifest(
    scope: MemoryScope,
    manifest: StyleManifest
  ): Promise<void> {
    if (scope === 'copilotUser') {
      await writeGlobalStyleManifest(
        this.getExtensionGlobalStoragePath(),
        manifest as GlobalStyleManifest
      );
      return;
    }

    if (scope === 'copilotRepo') {
      const workspaceStorage = this.getExtensionWorkspaceStoragePath();
      if (!workspaceStorage) {
        return;
      }
      await writeProjectStyleManifest(
        workspaceStorage,
        manifest as GlobalStyleManifest
      );
      return;
    }

    if (scopeUsesManifest(scope)) {
      const rootDir = await this.ensureScopeDir(
        scope === 'external' ? 'sharedGit' : scope
      );
      await writeManifest(rootDir, manifest as MemoryManifest);
    }
  }

  getFolderMetaForNode(
    relativePath: string,
    manifest: StyleManifest,
    scope: MemoryScope
  ): FolderMeta {
    if (scope === 'copilotUser' || scope === 'copilotRepo') {
      return getScopeStyleFolderMeta(manifest as GlobalStyleManifest, relativePath);
    }
    if (scope === 'external') {
      return getExternalFolderMeta(manifest as MemoryManifest, relativePath);
    }
    return getFolderMeta(manifest as MemoryManifest, relativePath);
  }

  getFileMetaForNode(
    relativePath: string,
    manifest: StyleManifest,
    scope: MemoryScope
  ): FileMeta {
    if (scope === 'copilotUser' || scope === 'copilotRepo') {
      return getScopeStyleFileMeta(manifest as GlobalStyleManifest, relativePath);
    }
    if (scope === 'external') {
      return getExternalFileMeta(manifest as MemoryManifest, relativePath);
    }
    return getFileMeta(manifest as MemoryManifest, relativePath);
  }

  async listChildren(
    scope: MemoryScope,
    parentRelativePath?: string
  ): Promise<MemoryNode[]> {
    if (scope === 'external') {
      return this.listExternalChildren(parentRelativePath);
    }

    const absoluteDir = this.resolveAbsolutePath(scope, parentRelativePath);
    const rootDir = this.getRootForScope(scope);
    if (!absoluteDir || !rootDir) {
      return [];
    }

    const parentRelative = this.normalizeRelativePath(parentRelativePath);
    const manifest = scopeUsesManifest(scope)
      ? await readManifest(rootDir)
      : createEmptyManifest();

    try {
      const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
      const folders: MemoryFolder[] = [];
      const files: MemoryFile[] = [];

      for (const entry of entries) {
        if (
          scope === 'copilotUser' &&
          !parentRelative &&
          isReservedCopilotUserEntry(entry.name, entry.isDirectory())
        ) {
          continue;
        }

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
          if (scope !== 'sharedGit' && entry.name.endsWith('.json')) {
            continue;
          }

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

      if (scopeUsesManifest(scope)) {
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
      } else {
        folders.sort((a, b) => a.name.localeCompare(b.name));
        files.sort((a, b) => a.name.localeCompare(b.name));
      }

      return [...folders, ...files];
    } catch {
      return [];
    }
  }

  private async getExternalPaths(): Promise<string[]> {
    if (this.externalPathsCache === null) {
      this.externalPathsCache = await scanExternalMarkdownPaths(this);
    }
    return this.externalPathsCache;
  }

  private async listExternalChildren(
    parentRelativePath?: string
  ): Promise<MemoryNode[]> {
    const workspaceRoot = this.getRootForScope('external');
    if (!workspaceRoot) {
      return [];
    }

    const parentRelative = this.normalizeRelativePath(parentRelativePath);
    const paths = await this.getExternalPaths();
    const sharedRoot = this.getSharedGitDir();
    const manifest = sharedRoot
      ? await readManifest(sharedRoot)
      : createEmptyManifest();

    const folderNames = new Set<string>();
    const files: MemoryFile[] = [];

    for (const workspaceRelative of paths) {
      if (parentRelative) {
        if (
          workspaceRelative !== parentRelative &&
          !workspaceRelative.startsWith(`${parentRelative}/`)
        ) {
          continue;
        }

        const remainder =
          workspaceRelative === parentRelative
            ? ''
            : workspaceRelative.slice(parentRelative.length + 1);
        if (!remainder) {
          continue;
        }

        const slashIndex = remainder.indexOf('/');
        if (slashIndex === -1) {
          const filePath = path.join(workspaceRoot, workspaceRelative);
          files.push({
            kind: 'file',
            scope: 'external',
            name: remainder,
            relativePath: workspaceRelative,
            filePath,
            format: this.getFormatFromFileName(remainder),
          });
        } else {
          folderNames.add(remainder.slice(0, slashIndex));
        }
        continue;
      }

      const slashIndex = workspaceRelative.indexOf('/');
      if (slashIndex === -1) {
        const filePath = path.join(workspaceRoot, workspaceRelative);
        files.push({
          kind: 'file',
          scope: 'external',
          name: workspaceRelative,
          relativePath: workspaceRelative,
          filePath,
          format: this.getFormatFromFileName(workspaceRelative),
        });
      } else {
        folderNames.add(workspaceRelative.slice(0, slashIndex));
      }
    }

    const folders: MemoryFolder[] = [...folderNames].map((name) => {
      const relativePath = parentRelative
        ? `${parentRelative}/${name}`
        : name;
      return {
        kind: 'folder',
        scope: 'external',
        name,
        relativePath,
        absolutePath: path.join(workspaceRoot, relativePath),
      };
    });

    if (scopeUsesManifest('external')) {
      folders.sort((a, b) => {
        const metaA = getExternalFolderMeta(manifest, a.relativePath);
        const metaB = getExternalFolderMeta(manifest, b.relativePath);
        return compareByOrder(metaA.order, metaB.order, a.name, b.name);
      });

      files.sort((a, b) => {
        const metaA = getExternalFileMeta(manifest, a.relativePath);
        const metaB = getExternalFileMeta(manifest, b.relativePath);
        return compareByOrder(metaA.order, metaB.order, a.name, b.name);
      });
    } else {
      folders.sort((a, b) => a.name.localeCompare(b.name));
      files.sort((a, b) => a.name.localeCompare(b.name));
    }

    return [...folders, ...files];
  }

  getVirtualPath(scope: MemoryScope, relativePath: string): string {
    return virtualPathForScope(scope, relativePath);
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
    assertMutableScope(scope);
    const rootDir = await this.ensureScopeDir(scope);
    const safeName = sanitizeMemoryBaseName(folderName);
    const parentRelative = this.normalizeRelativePath(parentRelativePath);
    const relativePath = parentRelative
      ? `${parentRelative}/${safeName}`
      : safeName;
    const absolutePath = path.join(rootDir, relativePath);

    await fs.mkdir(absolutePath, { recursive: false });

    if (scopeUsesManifest(scope)) {
      const manifest = await readManifest(rootDir);
      manifest.folders[relativePath] = {
        ...manifest.folders[relativePath],
        label: folderName.trim(),
      };
      await writeManifest(rootDir, manifest);
    }

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
    assertMutableScope(scope);
    const effectiveFormat =
      scope === 'sharedGit' ? format : ('markdown' as MemoryFormat);
    const rootDir = await this.ensureScopeDir(scope);
    const parentRelative = this.normalizeRelativePath(parentRelativePath);
    const targetDir = parentRelative
      ? path.join(rootDir, parentRelative)
      : rootDir;

    await fs.mkdir(targetDir, { recursive: true });

    const ext = effectiveFormat === 'json' ? '.json' : '.md';
    const safeName = sanitizeMemoryBaseName(baseName);
    const fileName = `${safeName}${ext}`;
    const filePath = path.join(targetDir, fileName);
    const relativePath = parentRelative
      ? `${parentRelative}/${fileName}`
      : fileName;
    const content = this.buildDefaultContent(baseName.trim(), effectiveFormat);

    await fs.writeFile(filePath, content, { flag: 'wx' });

    if (scopeUsesManifest(scope)) {
      const manifest = await readManifest(rootDir);
      manifest.files[relativePath] = manifest.files[relativePath] ?? {};
      await writeManifest(rootDir, manifest);
    }

    return {
      kind: 'file',
      scope,
      name: fileName,
      relativePath,
      filePath,
      format: effectiveFormat,
    };
  }

  async deleteMemory(
    scope: MemoryScope,
    filePath: string,
    relativePath?: string
  ): Promise<void> {
    assertMutableScope(scope);
    const rootDir = this.getRootForScope(scope);
    await fs.unlink(filePath);

    if (rootDir && relativePath && scopeUsesManifest(scope)) {
      const manifest = await readManifest(rootDir);
      removeManifestPaths(manifest, relativePath, false);
      await writeManifest(rootDir, manifest);
    } else if (relativePath) {
      await this.syncCopilotStyleOnRemove(scope, relativePath, false);
    }
  }

  async deleteFolder(scope: MemoryScope, relativePath: string): Promise<void> {
    assertMutableScope(scope);
    const rootDir = await this.ensureScopeDir(scope);
    const normalized = this.normalizeRelativePath(relativePath);
    const absolutePath = path.join(rootDir, normalized);

    await fs.rm(absolutePath, { recursive: true, force: true });

    if (scopeUsesManifest(scope)) {
      const manifest = await readManifest(rootDir);
      removeManifestPaths(manifest, normalized, true);
      await writeManifest(rootDir, manifest);
    } else {
      await this.syncCopilotStyleOnRemove(scope, normalized, true);
    }
  }

  async renameNode(
    scope: MemoryScope,
    fromRelative: string,
    newName: string,
    isFolder: boolean
  ): Promise<MemoryNode> {
    assertMutableScope(scope);
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

    if (scopeUsesManifest(scope)) {
      const manifest = await readManifest(rootDir);
      renameManifestPaths(manifest, from, toRelative, isFolder);
      await writeManifest(rootDir, manifest);
    } else {
      await this.syncCopilotStyleOnRename(scope, from, toRelative, isFolder);
    }

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
    assertMutableScope(scope);
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

    if (scopeUsesManifest(scope)) {
      const manifest = await readManifest(rootDir);
      renameManifestPaths(manifest, from, toRelative, isFolder);
      await writeManifest(rootDir, manifest);
    } else {
      await this.syncCopilotStyleOnRename(scope, from, toRelative, isFolder);
    }

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
    if (!scopeUsesManifest(scope)) {
      return;
    }

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
    if (!scopeSupportsStyles(scope)) {
      throw new Error(i18n.error.stylesUnsupportedScope());
    }

    if (scope === 'copilotUser') {
      const globalDir = this.getExtensionGlobalStoragePath();
      const manifest = await ensureGlobalStyleManifest(globalDir);
      manifest.folders[relativePath] = mergeFolderMeta(
        manifest.folders[relativePath] ?? {},
        style
      );
      await writeGlobalStyleManifest(globalDir, manifest);
      return;
    }

    if (scope === 'copilotRepo') {
      const manifest = await this.ensureProjectStyleManifestWithMigration();
      manifest.folders[relativePath] = mergeFolderMeta(
        manifest.folders[relativePath] ?? {},
        style
      );
      await this.writeProjectStyleManifest(manifest);
      return;
    }

    const rootDir = await this.ensureScopeDir(
      scope === 'external' ? 'sharedGit' : scope
    );
    const manifest = await readManifest(rootDir);

    if (scope === 'external') {
      const external = ensureExternalOverlay(manifest);
      external.folders[relativePath] = mergeFolderMeta(
        external.folders[relativePath] ?? {},
        style
      );
    } else {
      manifest.folders[relativePath] = mergeFolderMeta(
        manifest.folders[relativePath] ?? {},
        style
      );
    }

    await writeManifest(rootDir, manifest);
  }

  async setFileStyle(
    scope: MemoryScope,
    relativePath: string,
    style: Partial<FileMeta>
  ): Promise<void> {
    if (!scopeSupportsStyles(scope)) {
      throw new Error(i18n.error.stylesUnsupportedScope());
    }

    if (scope === 'copilotUser') {
      const globalDir = this.getExtensionGlobalStoragePath();
      const manifest = await ensureGlobalStyleManifest(globalDir);
      manifest.files[relativePath] = mergeFileMeta(
        manifest.files[relativePath] ?? {},
        style
      );
      await writeGlobalStyleManifest(globalDir, manifest);
      return;
    }

    if (scope === 'copilotRepo') {
      const manifest = await this.ensureProjectStyleManifestWithMigration();
      manifest.files[relativePath] = mergeFileMeta(
        manifest.files[relativePath] ?? {},
        style
      );
      await this.writeProjectStyleManifest(manifest);
      return;
    }

    const rootDir = await this.ensureScopeDir(
      scope === 'external' ? 'sharedGit' : scope
    );
    const manifest = await readManifest(rootDir);

    if (scope === 'external') {
      const external = ensureExternalOverlay(manifest);
      external.files[relativePath] = mergeFileMeta(
        external.files[relativePath] ?? {},
        style
      );
    } else {
      manifest.files[relativePath] = mergeFileMeta(
        manifest.files[relativePath] ?? {},
        style
      );
    }

    await writeManifest(rootDir, manifest);
  }

  async collectDescendantMemoryFiles(
    scope: MemoryScope,
    folderRelativePath: string
  ): Promise<MemoryFile[]> {
    const files: MemoryFile[] = [];
    const children = await this.listChildren(scope, folderRelativePath);

    for (const child of children) {
      if (isMemoryFile(child)) {
        files.push(child);
        continue;
      }

      const nested = await this.collectDescendantMemoryFiles(
        scope,
        child.relativePath
      );
      files.push(...nested);
    }

    return files;
  }

  async pathExists(absolutePath: string): Promise<boolean> {
    try {
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  async moveNodeToScope(
    node: MemoryNode,
    toScope: MemoryScope,
    targetFolderRelative?: string,
    move = true
  ): Promise<MemoryNode> {
    return moveNodeToScopeSync(this, node, toScope, targetFolderRelative, move);
  }

  async transferManifestEntry(
    fromScope: MemoryScope,
    toScope: MemoryScope,
    relativePath: string,
    isFolder: boolean
  ): Promise<void> {
    if (!scopeUsesManifest(fromScope) || !scopeUsesManifest(toScope)) {
      return;
    }

    const fromRoot = await this.ensureScopeDir(fromScope);
    const toRoot = await this.ensureScopeDir(toScope);
    const fromManifest = await readManifest(fromRoot);
    const toManifest = await readManifest(toRoot);

    transferManifestPaths(fromManifest, toManifest, relativePath, isFolder);

    await writeManifest(fromRoot, fromManifest);
    await writeManifest(toRoot, toManifest);
  }

  async transferCopilotStyleOverlay(
    fromScope: MemoryScope,
    toScope: MemoryScope,
    fromRelative: string,
    toRelative: string,
    isFolder: boolean,
    move: boolean
  ): Promise<void> {
    const fromIsCopilot =
      fromScope === 'copilotRepo' || fromScope === 'copilotUser';
    const toIsCopilot = toScope === 'copilotRepo' || toScope === 'copilotUser';

    if (!fromIsCopilot && !toIsCopilot) {
      return;
    }

    let sourceOverlay: StyleOverlay | undefined;
    let targetOverlay: StyleOverlay | undefined;
    let sourceManifest: GlobalStyleManifest | undefined;
    let targetManifest: GlobalStyleManifest | undefined;

    if (fromScope === 'copilotRepo') {
      sourceManifest = await this.ensureProjectStyleManifestWithMigration();
      sourceOverlay = {
        folders: sourceManifest.folders,
        files: sourceManifest.files,
      };
    } else if (fromScope === 'copilotUser') {
      const globalDir = this.getExtensionGlobalStoragePath();
      sourceManifest = await readGlobalStyleManifest(globalDir);
      sourceOverlay = {
        folders: sourceManifest.folders,
        files: sourceManifest.files,
      };
    }

    if (toScope === 'copilotRepo') {
      targetManifest = await this.ensureProjectStyleManifestWithMigration();
      targetOverlay = {
        folders: targetManifest.folders,
        files: targetManifest.files,
      };
    } else if (toScope === 'copilotUser') {
      const globalDir = this.getExtensionGlobalStoragePath();
      targetManifest = await readGlobalStyleManifest(globalDir);
      targetOverlay = {
        folders: targetManifest.folders,
        files: targetManifest.files,
      };
    }

    if (sourceOverlay && targetOverlay && sourceOverlay !== targetOverlay) {
      transferOverlayPaths(
        sourceOverlay,
        targetOverlay,
        fromRelative,
        toRelative,
        isFolder,
        move
      );
    } else if (sourceOverlay && move) {
      removeOverlayPaths(sourceOverlay, fromRelative, isFolder);
    }

    if (sourceManifest && fromScope === 'copilotRepo') {
      await this.writeProjectStyleManifest(sourceManifest);
    } else if (sourceManifest && fromScope === 'copilotUser') {
      await writeGlobalStyleManifest(
        this.getExtensionGlobalStoragePath(),
        sourceManifest
      );
    }

    if (
      targetManifest &&
      toScope !== fromScope &&
      (toScope === 'copilotRepo' || toScope === 'copilotUser')
    ) {
      if (toScope === 'copilotRepo') {
        await this.writeProjectStyleManifest(targetManifest);
      } else {
        await writeGlobalStyleManifest(
          this.getExtensionGlobalStoragePath(),
          targetManifest
        );
      }
    }
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

  private async syncCopilotStyleOnRemove(
    scope: MemoryScope,
    relativePath: string,
    isFolder: boolean
  ): Promise<void> {
    if (scope === 'copilotRepo') {
      const manifest = await this.ensureProjectStyleManifestWithMigration();
      removeOverlayPaths(
        { folders: manifest.folders, files: manifest.files },
        relativePath,
        isFolder
      );
      await this.writeProjectStyleManifest(manifest);
      return;
    }

    if (scope === 'copilotUser') {
      const globalDir = this.getExtensionGlobalStoragePath();
      const manifest = await readGlobalStyleManifest(globalDir);
      removeOverlayPaths(
        { folders: manifest.folders, files: manifest.files },
        relativePath,
        isFolder
      );
      await writeGlobalStyleManifest(globalDir, manifest);
    }
  }

  private async syncCopilotStyleOnRename(
    scope: MemoryScope,
    fromRelative: string,
    toRelative: string,
    isFolder: boolean
  ): Promise<void> {
    if (scope === 'copilotRepo') {
      const manifest = await this.ensureProjectStyleManifestWithMigration();
      renameOverlayPaths(
        { folders: manifest.folders, files: manifest.files },
        fromRelative,
        toRelative,
        isFolder
      );
      await this.writeProjectStyleManifest(manifest);
      return;
    }

    if (scope === 'copilotUser') {
      const globalDir = this.getExtensionGlobalStoragePath();
      const manifest = await readGlobalStyleManifest(globalDir);
      renameOverlayPaths(
        { folders: manifest.folders, files: manifest.files },
        fromRelative,
        toRelative,
        isFolder
      );
      await writeGlobalStyleManifest(globalDir, manifest);
    }
  }

  private async ensureProjectStyleManifestWithMigration(): Promise<GlobalStyleManifest> {
    const workspaceStorage = this.getExtensionWorkspaceStoragePath();
    if (!workspaceStorage) {
      throw new Error(i18n.error.storageUnavailable());
    }

    const manifest = await ensureProjectStyleManifest(workspaceStorage);

    if (!this.projectStylesMigrated) {
      await this.migrateProjectStylesFromWorkspaceManifest(manifest);
      this.projectStylesMigrated = true;
    }

    return manifest;
  }

  private async writeProjectStyleManifest(
    manifest: GlobalStyleManifest
  ): Promise<void> {
    const workspaceStorage = this.getExtensionWorkspaceStoragePath();
    if (!workspaceStorage) {
      throw new Error(i18n.error.storageUnavailable());
    }

    await writeProjectStyleManifest(workspaceStorage, manifest);
  }

  private async migrateProjectStylesFromWorkspaceManifest(
    target: GlobalStyleManifest
  ): Promise<void> {
    const sharedRoot = this.getRootForScope('sharedGit');
    if (!sharedRoot || !(await manifestExists(sharedRoot))) {
      return;
    }

    const workspaceManifest = await readManifest(sharedRoot);
    const legacyOverlay = workspaceManifest.copilotRepo;
    if (!legacyOverlay) {
      return;
    }

    const hasLegacyStyles =
      Object.keys(legacyOverlay.folders).length > 0 ||
      Object.keys(legacyOverlay.files).length > 0;
    if (!hasLegacyStyles) {
      delete workspaceManifest.copilotRepo;
      await writeManifest(sharedRoot, workspaceManifest);
      return;
    }

    for (const [key, meta] of Object.entries(legacyOverlay.folders)) {
      target.folders[key] = { ...target.folders[key], ...meta };
    }
    for (const [key, meta] of Object.entries(legacyOverlay.files)) {
      target.files[key] = { ...target.files[key], ...meta };
    }

    delete workspaceManifest.copilotRepo;
    await writeManifest(sharedRoot, workspaceManifest);
    await this.writeProjectStyleManifest(target);
  }
}

function assertMutableScope(scope: MemoryScope): void {
  if (scope === 'external') {
    throw new Error(i18n.error.externalReadOnly());
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

export async function copyPathCrossDevice(
  sourceAbsolute: string,
  destinationAbsolute: string
): Promise<void> {
  await fs.mkdir(path.dirname(destinationAbsolute), { recursive: true });
  await fs.cp(sourceAbsolute, destinationAbsolute, { recursive: true });
}
