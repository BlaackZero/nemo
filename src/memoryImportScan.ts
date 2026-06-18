import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { getCopilotRepoMemoryDir } from './copilotMemoryPaths';
import { i18n } from './i18n';
import { MemoryManager } from './memoryManager';
import { getWorkspaceFolderPath } from './memoryStorePaths';
import { ImportTarget } from './types';

export type ImportSourceKind = 'aiConvention' | 'repoMarkdown';

export interface ImportCandidate {
  id: string;
  kind: ImportSourceKind;
  sourcePath: string;
  workspaceRelative: string;
  targetRelative: string;
  label: string;
  description: string;
  conflict: boolean;
}

const EXCLUDED_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'out',
  'dist',
  'build',
  '.vscode-test',
]);

const AI_FILES = ['.github/copilot-instructions.md', 'AGENTS.md'] as const;

const AI_DIRECTORIES = ['.cursor/rules', '.clinerules', '.windsurf/rules'] as const;

export function normalizeWorkspaceRelative(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

export function toTargetRelative(workspaceRelative: string): string {
  const normalized = normalizeWorkspaceRelative(workspaceRelative);
  const segments = normalized.split('/').filter(Boolean);

  if (segments.length === 0) {
    return normalized;
  }

  if (segments[0]?.startsWith('.')) {
    segments[0] = segments[0].slice(1);
  }

  const fileName = segments[segments.length - 1] ?? '';
  if (fileName.endsWith('.mdc')) {
    segments[segments.length - 1] = `${fileName.slice(0, -4)}.md`;
  }

  return segments.join('/');
}

export function toCopilotRepoRelative(workspaceRelative: string): string {
  return toTargetRelative(workspaceRelative);
}

export function isExcludedPath(
  workspaceRelative: string,
  sharedPath: string
): boolean {
  const rel = normalizeWorkspaceRelative(workspaceRelative).toLowerCase();
  const normalizedShared = normalizeWorkspaceRelative(sharedPath).toLowerCase();

  if (rel === 'readme.md') {
    return true;
  }

  if (rel === normalizedShared || rel.startsWith(`${normalizedShared}/`)) {
    return true;
  }

  const parts = normalizeWorkspaceRelative(workspaceRelative).split('/');
  return parts.some((part) => EXCLUDED_DIR_NAMES.has(part));
}

function kindDescription(kind: ImportSourceKind): string {
  switch (kind) {
    case 'aiConvention':
      return i18n.import.sourceAi();
    case 'repoMarkdown':
      return i18n.import.sourceProject();
  }
}

async function fileExists(absolutePath: string): Promise<boolean> {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function collectMarkdownInDirectory(
  absoluteDir: string,
  workspaceRoot: string,
  results: string[]
): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry.name);

    if (entry.isDirectory()) {
      await collectMarkdownInDirectory(absolutePath, workspaceRoot, results);
      continue;
    }

    if (
      entry.isFile() &&
      (entry.name.endsWith('.md') || entry.name.endsWith('.mdc'))
    ) {
      results.push(
        normalizeWorkspaceRelative(path.relative(workspaceRoot, absolutePath))
      );
    }
  }
}

export async function scanAiConventionPaths(
  workspaceRoot: string
): Promise<string[]> {
  const results: string[] = [];

  for (const relativeFile of AI_FILES) {
    const absolutePath = path.join(workspaceRoot, ...relativeFile.split('/'));
    if (await fileExists(absolutePath)) {
      results.push(normalizeWorkspaceRelative(relativeFile));
    }
  }

  for (const relativeDir of AI_DIRECTORIES) {
    await collectMarkdownInDirectory(
      path.join(workspaceRoot, ...relativeDir.split('/')),
      workspaceRoot,
      results
    );
  }

  return results;
}

async function scanCopilotRepoExisting(
  manager: MemoryManager
): Promise<Set<string>> {
  const repoDir = getCopilotRepoMemoryDir(manager.getExtensionContext());
  if (!repoDir) {
    return new Set();
  }

  const results = new Set<string>();
  await collectRelativeMarkdown(repoDir, repoDir, results);
  return results;
}

async function collectRelativeMarkdown(
  absoluteDir: string,
  rootDir: string,
  results: Set<string>
): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      await collectRelativeMarkdown(absolutePath, rootDir, results);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      results.add(
        normalizeWorkspaceRelative(path.relative(rootDir, absolutePath))
      );
    }
  }
}

async function scanRepoMarkdown(
  sharedPath: string,
  aiPaths: Set<string>
): Promise<string[]> {
  const sharedSegment = normalizeWorkspaceRelative(sharedPath);
  const exclude = `{${[
    'node_modules',
    '.git',
    'out',
    'dist',
    'build',
    '.vscode-test',
    sharedSegment,
  ].join(',')}}`;
  const pattern = '**/*.{md,mdc}';
  const uris = await vscode.workspace.findFiles(pattern, `**/${exclude}/**`);

  const workspaceRoot = getWorkspaceFolderPath();
  if (!workspaceRoot) {
    return [];
  }

  const results: string[] = [];
  for (const uri of uris) {
    const workspaceRelative = normalizeWorkspaceRelative(
      path.relative(workspaceRoot, uri.fsPath)
    );

    if (isExcludedPath(workspaceRelative, sharedPath)) {
      continue;
    }

    if (aiPaths.has(workspaceRelative)) {
      continue;
    }

    results.push(workspaceRelative);
  }

  return results;
}

function buildRepoCandidate(
  workspaceRelative: string,
  workspaceRoot: string,
  kind: ImportSourceKind
): ImportCandidate {
  const sourcePath = path.join(workspaceRoot, ...workspaceRelative.split('/'));
  const targetRelative = toCopilotRepoRelative(workspaceRelative);

  return {
    id: `${kind}:${workspaceRelative}`,
    kind,
    sourcePath,
    workspaceRelative,
    targetRelative,
    label: path.posix.basename(targetRelative),
    description: kindDescription(kind),
    conflict: false,
  };
}

async function attachConflictFlag(
  candidate: ImportCandidate,
  targetRoot: string,
  manager: MemoryManager
): Promise<ImportCandidate> {
  const targetAbsolute = path.join(targetRoot, candidate.targetRelative);
  return {
    ...candidate,
    conflict: await manager.pathExists(targetAbsolute),
  };
}

function conflictRootForTarget(
  manager: MemoryManager,
  target: ImportTarget
): string | undefined {
  if (target === 'sharedGit') {
    return manager.getSharedGitDir();
  }
  return getCopilotRepoMemoryDir(manager.getExtensionContext());
}

export async function scanImportCandidates(
  manager: MemoryManager,
  target: ImportTarget = 'copilotRepo'
): Promise<ImportCandidate[]> {
  const workspaceRoot = getWorkspaceFolderPath();
  if (!workspaceRoot) {
    return [];
  }

  const sharedPath = manager.getConfig().sharedPath;
  const targetRoot = conflictRootForTarget(manager, target);
  if (!targetRoot) {
    return [];
  }

  if (target === 'sharedGit') {
    await manager.ensureScopeDir('sharedGit');
  }

  const candidates: ImportCandidate[] = [];
  const seenIds = new Set<string>();

  const addCandidate = async (candidate: ImportCandidate): Promise<void> => {
    if (seenIds.has(candidate.id)) {
      return;
    }
    seenIds.add(candidate.id);
    candidates.push(await attachConflictFlag(candidate, targetRoot, manager));
  };

  const aiPaths = await scanAiConventionPaths(workspaceRoot);
  const aiPathSet = new Set(aiPaths);
  const copilotExisting = await scanCopilotRepoExisting(manager);

  for (const workspaceRelative of aiPaths) {
    if (isExcludedPath(workspaceRelative, sharedPath)) {
      continue;
    }
    const candidate = buildRepoCandidate(
      workspaceRelative,
      workspaceRoot,
      'aiConvention'
    );
    if (copilotExisting.has(candidate.targetRelative)) {
      continue;
    }
    await addCandidate(candidate);
  }

  const repoPaths = await scanRepoMarkdown(sharedPath, aiPathSet);
  for (const workspaceRelative of repoPaths) {
    const candidate = buildRepoCandidate(
      workspaceRelative,
      workspaceRoot,
      'repoMarkdown'
    );
    if (copilotExisting.has(candidate.targetRelative)) {
      continue;
    }
    await addCandidate(candidate);
  }

  candidates.sort((a, b) => {
    const byKind = a.kind.localeCompare(b.kind);
    if (byKind !== 0) {
      return byKind;
    }
    return a.workspaceRelative.localeCompare(b.workspaceRelative);
  });

  return candidates;
}

export async function scanExternalMarkdownPaths(
  manager: MemoryManager
): Promise<string[]> {
  const workspaceRoot = manager.getRootForScope('external');
  if (!workspaceRoot) {
    return [];
  }

  const sharedPath = manager.getConfig().sharedPath;
  const aiPaths = await scanAiConventionPaths(workspaceRoot);
  const aiPathSet = new Set(aiPaths);
  const repoPaths = await scanRepoMarkdown(sharedPath, aiPathSet);
  const combined = [...aiPaths, ...repoPaths];
  combined.sort((a, b) => a.localeCompare(b));
  return combined;
}

export async function buildImportCandidateForPath(
  manager: MemoryManager,
  workspaceRelative: string
): Promise<ImportCandidate | undefined> {
  const workspaceRoot = getWorkspaceFolderPath();
  if (!workspaceRoot) {
    return undefined;
  }

  const aiPaths = await scanAiConventionPaths(workspaceRoot);
  const kind: ImportSourceKind = aiPaths.includes(workspaceRelative)
    ? 'aiConvention'
    : 'repoMarkdown';

  return buildRepoCandidate(workspaceRelative, workspaceRoot, kind);
}

export async function isPathInProjectMemory(
  manager: MemoryManager,
  workspaceRelative: string
): Promise<boolean> {
  const copilotExisting = await scanCopilotRepoExisting(manager);
  return copilotExisting.has(toCopilotRepoRelative(workspaceRelative));
}
