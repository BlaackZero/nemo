import * as fs from 'fs/promises';
import * as path from 'path';

export const MANIFEST_FILENAME = '.nemo.json';

export const RESERVED_FILENAMES = new Set([MANIFEST_FILENAME, '.gitkeep']);

export const PICKER_THEME_COLORS = [
  'terminal.ansiBlue',
  'terminal.ansiGreen',
  'terminal.ansiYellow',
  'terminal.ansiRed',
  'terminal.ansiMagenta',
  'terminal.ansiCyan',
  'charts.orange',
  'charts.purple',
] as const;

/** @deprecated Legacy IDs still supported when reading manifests */
export const LEGACY_THEME_COLORS = [
  'charts.blue',
  'charts.green',
  'charts.red',
  'charts.yellow',
] as const;

export type PickerThemeColorId = (typeof PICKER_THEME_COLORS)[number];

export type ThemeColorId =
  | PickerThemeColorId
  | (typeof LEGACY_THEME_COLORS)[number];

/** @deprecated Use PICKER_THEME_COLORS in the style picker */
export const THEME_COLORS = PICKER_THEME_COLORS;

export interface ThemeColorOption {
  id: PickerThemeColorId;
  labelMessage: string;
}

export const THEME_COLOR_OPTIONS: readonly ThemeColorOption[] = [
  { id: 'terminal.ansiBlue', labelMessage: 'Blue' },
  { id: 'terminal.ansiGreen', labelMessage: 'Green' },
  { id: 'terminal.ansiYellow', labelMessage: 'Yellow' },
  { id: 'terminal.ansiRed', labelMessage: 'Red' },
  { id: 'terminal.ansiMagenta', labelMessage: 'Magenta' },
  { id: 'terminal.ansiCyan', labelMessage: 'Cyan' },
  { id: 'charts.orange', labelMessage: 'Orange' },
  { id: 'charts.purple', labelMessage: 'Purple' },
];

export const THEME_ICONS = [
  'folder',
  'server',
  'cloud',
  'database',
  'rocket',
  'shield',
  'gear',
  'book',
  'markdown',
  'json',
] as const;

export type ThemeIconId = (typeof THEME_ICONS)[number];

export interface FolderMeta {
  label?: string;
  color?: ThemeColorId;
  icon?: ThemeIconId;
  order?: number;
}

export interface FileMeta {
  color?: ThemeColorId;
  icon?: ThemeIconId;
  order?: number;
  importedFrom?: string;
}

export interface StyleOverlay {
  folders: Record<string, FolderMeta>;
  files: Record<string, FileMeta>;
}

/** @deprecated Use StyleOverlay */
export type ExternalManifestOverlay = StyleOverlay;

export interface MemoryManifest {
  version: 1;
  folders: Record<string, FolderMeta>;
  files: Record<string, FileMeta>;
  external?: StyleOverlay;
  /** @deprecated Migrated to extension workspace storage; read only for migration */
  copilotRepo?: StyleOverlay;
}

/** Style overlay manifest stored in extension storage (project or global scope). */
export interface GlobalStyleManifest {
  version: 1;
  folders: Record<string, FolderMeta>;
  files: Record<string, FileMeta>;
}

export const PROJECT_STYLE_MANIFEST_FILENAME = '.nemo-project-styles.json';
export const GLOBAL_STYLE_MANIFEST_FILENAME = '.nemo-global-styles.json';

export function createEmptyStyleOverlay(): StyleOverlay {
  return { folders: {}, files: {} };
}

export function createEmptyExternalOverlay(): StyleOverlay {
  return createEmptyStyleOverlay();
}

export function createEmptyGlobalStyleManifest(): GlobalStyleManifest {
  return { version: 1, folders: {}, files: {} };
}

export function createEmptyManifest(): MemoryManifest {
  return { version: 1, folders: {}, files: {} };
}

export function getManifestPath(repoDir: string): string {
  return path.join(repoDir, MANIFEST_FILENAME);
}

export async function readManifest(repoDir: string): Promise<MemoryManifest> {
  const manifestPath = getManifestPath(repoDir);

  try {
    const raw = await fs.readFile(manifestPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<MemoryManifest>;
    return {
      version: 1,
      folders: parsed.folders ?? {},
      files: parsed.files ?? {},
      external: parsed.external
        ? {
            folders: parsed.external.folders ?? {},
            files: parsed.external.files ?? {},
          }
        : undefined,
      copilotRepo: parsed.copilotRepo
        ? {
            folders: parsed.copilotRepo.folders ?? {},
            files: parsed.copilotRepo.files ?? {},
          }
        : undefined,
    };
  } catch {
    return createEmptyManifest();
  }
}

export async function writeManifest(
  repoDir: string,
  manifest: MemoryManifest
): Promise<void> {
  await fs.mkdir(repoDir, { recursive: true });
  const manifestPath = getManifestPath(repoDir);
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

export async function ensureManifest(repoDir: string): Promise<MemoryManifest> {
  await fs.mkdir(repoDir, { recursive: true });
  const manifestPath = getManifestPath(repoDir);

  try {
    await fs.access(manifestPath);
  } catch {
    const empty = createEmptyManifest();
    await writeManifest(repoDir, empty);
    return empty;
  }

  return readManifest(repoDir);
}

export function getFolderMeta(
  manifest: MemoryManifest,
  relativePath: string
): FolderMeta {
  return manifest.folders[relativePath] ?? {};
}

export function getFileMeta(
  manifest: MemoryManifest,
  relativePath: string
): FileMeta {
  return manifest.files[relativePath] ?? {};
}

export function getExternalFolderMeta(
  manifest: MemoryManifest,
  relativePath: string
): FolderMeta {
  return manifest.external?.folders[relativePath] ?? {};
}

export function getExternalFileMeta(
  manifest: MemoryManifest,
  relativePath: string
): FileMeta {
  return manifest.external?.files[relativePath] ?? {};
}

export function ensureExternalOverlay(manifest: MemoryManifest): StyleOverlay {
  if (!manifest.external) {
    manifest.external = createEmptyStyleOverlay();
  }
  return manifest.external;
}

export function getScopeStyleFolderMeta(
  manifest: GlobalStyleManifest,
  relativePath: string
): FolderMeta {
  return manifest.folders[relativePath] ?? {};
}

export function getScopeStyleFileMeta(
  manifest: GlobalStyleManifest,
  relativePath: string
): FileMeta {
  return manifest.files[relativePath] ?? {};
}

export function getScopeStyleManifestPath(
  storageDir: string,
  filename: string
): string {
  return path.join(storageDir, filename);
}

export async function readScopeStyleManifest(
  storageDir: string,
  filename: string
): Promise<GlobalStyleManifest> {
  const manifestPath = getScopeStyleManifestPath(storageDir, filename);

  try {
    const raw = await fs.readFile(manifestPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<GlobalStyleManifest>;
    return {
      version: 1,
      folders: parsed.folders ?? {},
      files: parsed.files ?? {},
    };
  } catch {
    return createEmptyGlobalStyleManifest();
  }
}

export async function writeScopeStyleManifest(
  storageDir: string,
  filename: string,
  manifest: GlobalStyleManifest
): Promise<void> {
  await fs.mkdir(storageDir, { recursive: true });
  const manifestPath = getScopeStyleManifestPath(storageDir, filename);
  await fs.writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );
}

export async function ensureScopeStyleManifest(
  storageDir: string,
  filename: string
): Promise<GlobalStyleManifest> {
  await fs.mkdir(storageDir, { recursive: true });
  const manifestPath = getScopeStyleManifestPath(storageDir, filename);

  try {
    await fs.access(manifestPath);
  } catch {
    const empty = createEmptyGlobalStyleManifest();
    await writeScopeStyleManifest(storageDir, filename, empty);
    return empty;
  }

  return readScopeStyleManifest(storageDir, filename);
}

export function getProjectStyleManifestPath(storageDir: string): string {
  return getScopeStyleManifestPath(storageDir, PROJECT_STYLE_MANIFEST_FILENAME);
}

export async function readProjectStyleManifest(
  storageDir: string
): Promise<GlobalStyleManifest> {
  return readScopeStyleManifest(storageDir, PROJECT_STYLE_MANIFEST_FILENAME);
}

export async function writeProjectStyleManifest(
  storageDir: string,
  manifest: GlobalStyleManifest
): Promise<void> {
  await writeScopeStyleManifest(storageDir, PROJECT_STYLE_MANIFEST_FILENAME, manifest);
}

export async function ensureProjectStyleManifest(
  storageDir: string
): Promise<GlobalStyleManifest> {
  return ensureScopeStyleManifest(storageDir, PROJECT_STYLE_MANIFEST_FILENAME);
}

export async function readGlobalStyleManifest(
  globalStorageDir: string
): Promise<GlobalStyleManifest> {
  return readScopeStyleManifest(globalStorageDir, GLOBAL_STYLE_MANIFEST_FILENAME);
}

export async function writeGlobalStyleManifest(
  globalStorageDir: string,
  manifest: GlobalStyleManifest
): Promise<void> {
  await writeScopeStyleManifest(
    globalStorageDir,
    GLOBAL_STYLE_MANIFEST_FILENAME,
    manifest
  );
}

export async function ensureGlobalStyleManifest(
  globalStorageDir: string
): Promise<GlobalStyleManifest> {
  return ensureScopeStyleManifest(globalStorageDir, GLOBAL_STYLE_MANIFEST_FILENAME);
}

/** @deprecated Use getScopeStyleFolderMeta */
export function getCopilotUserFolderMeta(
  manifest: GlobalStyleManifest,
  relativePath: string
): FolderMeta {
  return getScopeStyleFolderMeta(manifest, relativePath);
}

/** @deprecated Use getScopeStyleFileMeta */
export function getCopilotUserFileMeta(
  manifest: GlobalStyleManifest,
  relativePath: string
): FileMeta {
  return getScopeStyleFileMeta(manifest, relativePath);
}

export function renameOverlayPaths(
  overlay: StyleOverlay,
  fromRelative: string,
  toRelative: string,
  isFolder: boolean
): void {
  if (isFolder) {
    const folderMeta = overlay.folders[fromRelative];
    if (folderMeta) {
      delete overlay.folders[fromRelative];
      overlay.folders[toRelative] = folderMeta;
    }

    for (const key of Object.keys(overlay.folders)) {
      if (key.startsWith(`${fromRelative}/`)) {
        const suffix = key.slice(fromRelative.length);
        overlay.folders[`${toRelative}${suffix}`] = overlay.folders[key];
        delete overlay.folders[key];
      }
    }

    for (const key of Object.keys(overlay.files)) {
      if (key === fromRelative || key.startsWith(`${fromRelative}/`)) {
        const suffix = key.slice(fromRelative.length);
        overlay.files[`${toRelative}${suffix}`] = overlay.files[key];
        delete overlay.files[key];
      }
    }

    return;
  }

  const fileMeta = overlay.files[fromRelative];
  if (fileMeta) {
    delete overlay.files[fromRelative];
    overlay.files[toRelative] = fileMeta;
  }
}

export function removeOverlayPaths(
  overlay: StyleOverlay,
  relativePath: string,
  isFolder: boolean
): void {
  if (isFolder) {
    delete overlay.folders[relativePath];
    for (const key of Object.keys(overlay.folders)) {
      if (key.startsWith(`${relativePath}/`)) {
        delete overlay.folders[key];
      }
    }
    for (const key of Object.keys(overlay.files)) {
      if (key.startsWith(`${relativePath}/`)) {
        delete overlay.files[key];
      }
    }
    return;
  }

  delete overlay.files[relativePath];
}

function mergeMeta<T extends FolderMeta | FileMeta>(
  existing: T,
  update: Partial<T>
): T {
  const next: T = { ...existing };
  for (const key of Object.keys(update) as Array<keyof T>) {
    const value = update[key];
    if (value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
  }
  return next;
}

export function mergeFolderMeta(
  existing: FolderMeta,
  update: Partial<FolderMeta>
): FolderMeta {
  return mergeMeta(existing, update);
}

export function mergeFileMeta(
  existing: FileMeta,
  update: Partial<FileMeta>
): FileMeta {
  return mergeMeta(existing, update);
}

export function compareByOrder(
  orderA: number | undefined,
  orderB: number | undefined,
  nameA: string,
  nameB: string
): number {
  const a = orderA ?? Number.MAX_SAFE_INTEGER;
  const b = orderB ?? Number.MAX_SAFE_INTEGER;

  if (a !== b) {
    return a - b;
  }

  return nameA.localeCompare(nameB);
}

export function renameManifestPaths(
  manifest: MemoryManifest,
  fromRelative: string,
  toRelative: string,
  isFolder: boolean
): void {
  if (isFolder) {
    const folderMeta = manifest.folders[fromRelative];
    if (folderMeta) {
      delete manifest.folders[fromRelative];
      manifest.folders[toRelative] = folderMeta;
    }

    for (const key of Object.keys(manifest.folders)) {
      if (key.startsWith(`${fromRelative}/`)) {
        const suffix = key.slice(fromRelative.length);
        manifest.folders[`${toRelative}${suffix}`] = manifest.folders[key];
        delete manifest.folders[key];
      }
    }

    for (const key of Object.keys(manifest.files)) {
      if (key === fromRelative || key.startsWith(`${fromRelative}/`)) {
        const suffix = key.slice(fromRelative.length);
        manifest.files[`${toRelative}${suffix}`] = manifest.files[key];
        delete manifest.files[key];
      }
    }

    return;
  }

  const fileMeta = manifest.files[fromRelative];
  if (fileMeta) {
    delete manifest.files[fromRelative];
    manifest.files[toRelative] = fileMeta;
  }
}

export function removeManifestPaths(
  manifest: MemoryManifest,
  relativePath: string,
  isFolder: boolean
): void {
  if (isFolder) {
    delete manifest.folders[relativePath];
    for (const key of Object.keys(manifest.folders)) {
      if (key.startsWith(`${relativePath}/`)) {
        delete manifest.folders[key];
      }
    }
    for (const key of Object.keys(manifest.files)) {
      if (key.startsWith(`${relativePath}/`)) {
        delete manifest.files[key];
      }
    }
    return;
  }

  delete manifest.files[relativePath];
}

export function updateSiblingOrder(
  manifest: MemoryManifest,
  parentRelativePath: string,
  orderedRelativePaths: string[],
  kind: 'folder' | 'file'
): void {
  orderedRelativePaths.forEach((relativePath, index) => {
    if (kind === 'folder') {
      manifest.folders[relativePath] = {
        ...manifest.folders[relativePath],
        order: index,
      };
      return;
    }

    manifest.files[relativePath] = {
      ...manifest.files[relativePath],
      order: index,
    };
  });

  if (parentRelativePath) {
    manifest.folders[parentRelativePath] = {
      ...manifest.folders[parentRelativePath],
    };
  }
}

export function transferManifestPaths(
  sourceManifest: MemoryManifest,
  targetManifest: MemoryManifest,
  relativePath: string,
  isFolder: boolean
): void {
  if (isFolder) {
    if (sourceManifest.folders[relativePath]) {
      targetManifest.folders[relativePath] = {
        ...sourceManifest.folders[relativePath],
      };
      delete sourceManifest.folders[relativePath];
    }

    for (const key of Object.keys(sourceManifest.folders)) {
      if (key.startsWith(`${relativePath}/`)) {
        targetManifest.folders[key] = { ...sourceManifest.folders[key] };
        delete sourceManifest.folders[key];
      }
    }

    for (const key of Object.keys(sourceManifest.files)) {
      if (key === relativePath || key.startsWith(`${relativePath}/`)) {
        targetManifest.files[key] = { ...sourceManifest.files[key] };
        delete sourceManifest.files[key];
      }
    }

    return;
  }

  if (sourceManifest.files[relativePath]) {
    targetManifest.files[relativePath] = {
      ...sourceManifest.files[relativePath],
    };
    delete sourceManifest.files[relativePath];
  }
}
