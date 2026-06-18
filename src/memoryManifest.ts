import * as fs from 'fs/promises';
import * as path from 'path';

export const MANIFEST_FILENAME = '.nemo.json';

export const RESERVED_FILENAMES = new Set([MANIFEST_FILENAME, '.gitkeep']);

export const THEME_COLORS = [
  'charts.blue',
  'charts.orange',
  'charts.green',
  'charts.red',
  'charts.purple',
  'charts.yellow',
] as const;

export type ThemeColorId = (typeof THEME_COLORS)[number];

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
}

export interface MemoryManifest {
  version: 1;
  folders: Record<string, FolderMeta>;
  files: Record<string, FileMeta>;
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
