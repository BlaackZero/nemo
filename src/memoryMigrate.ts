import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { i18n } from './i18n';
import { MemoryManager } from './memoryManager';
import { getLegacyPersonalRoot } from './memoryStorePaths';
import { MemoryScope } from './types';

export interface LegacyFileCandidate {
  id: string;
  relativePath: string;
  absolutePath: string;
  label: string;
}

export interface MigrateResult {
  moved: string[];
  skipped: Array<{ path: string; reason: string }>;
}

async function walkLegacyFiles(
  absoluteDir: string,
  parentRelative: string | undefined,
  results: LegacyFileCandidate[]
): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const relativePath = parentRelative
      ? `${parentRelative}/${entry.name}`
      : entry.name;
    const absolutePath = path.join(absoluteDir, entry.name);

    if (entry.isDirectory()) {
      await walkLegacyFiles(absolutePath, relativePath, results);
      continue;
    }

    if (
      entry.isFile() &&
      (entry.name.endsWith('.md') || entry.name.endsWith('.json'))
    ) {
      results.push({
        id: `legacy:${relativePath}`,
        relativePath,
        absolutePath,
        label: entry.name,
      });
    }
  }
}

export async function scanLegacyStorage(
  manager: MemoryManager
): Promise<LegacyFileCandidate[]> {
  const legacyRoot = getLegacyPersonalRoot(manager);
  if (!legacyRoot) {
    return [];
  }

  try {
    await fs.access(legacyRoot);
  } catch {
    return [];
  }

  const results: LegacyFileCandidate[] = [];
  await walkLegacyFiles(legacyRoot, undefined, results);
  return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

async function migrateLegacyFile(
  manager: MemoryManager,
  file: LegacyFileCandidate,
  targetScope: MemoryScope,
  removeSource: boolean
): Promise<void> {
  const targetRoot = await manager.ensureScopeDir(targetScope);
  const targetRelative = file.relativePath.replace(/\.json$/i, '.md');
  const targetAbsolute = path.join(targetRoot, targetRelative);
  await fs.mkdir(path.dirname(targetAbsolute), { recursive: true });

  if (file.absolutePath.endsWith('.json') && targetScope !== 'sharedGit') {
    const content = await fs.readFile(file.absolutePath, 'utf8');
    const mdPath = targetAbsolute.replace(/\.json$/i, '.md');
    await fs.writeFile(
      mdPath,
      `# ${file.label}\n\n\`\`\`json\n${content}\n\`\`\`\n`,
      'utf8'
    );
  } else if (removeSource) {
    await fs.rename(file.absolutePath, targetAbsolute).catch(async () => {
      await fs.copyFile(file.absolutePath, targetAbsolute);
      await fs.rm(file.absolutePath);
    });
  } else {
    await fs.copyFile(file.absolutePath, targetAbsolute);
  }

  if (targetScope === 'sharedGit') {
    const { readManifest, writeManifest } = await import('./memoryManifest');
    const manifest = await readManifest(targetRoot);
    const rel = file.relativePath.replace(/\.json$/i, '.md');
    manifest.files[rel] = {
      ...manifest.files[rel],
      importedFrom: `legacy:${file.relativePath}`,
    };
    await writeManifest(targetRoot, manifest);
  }
}

export async function runLegacyMigration(
  manager: MemoryManager,
  files: LegacyFileCandidate[],
  targetScope: MemoryScope,
  removeSource: boolean
): Promise<MigrateResult> {
  const result: MigrateResult = { moved: [], skipped: [] };

  for (const file of files) {
    try {
      await migrateLegacyFile(manager, file, targetScope, removeSource);
      result.moved.push(file.relativePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.skipped.push({ path: file.relativePath, reason: message });
    }
  }

  return result;
}

export async function migrateLegacyStorageWizard(
  manager: MemoryManager
): Promise<void> {
  const files = await scanLegacyStorage(manager);
  if (files.length === 0) {
    void vscode.window.showInformationMessage(i18n.migrate.noneFound());
    return;
  }

  const selected = await vscode.window.showQuickPick(
    files.map((file) => ({
      label: file.label,
      description: file.relativePath,
      picked: true,
      file,
    })),
    {
      canPickMany: true,
      placeHolder: i18n.migrate.pickTitle(),
    }
  );

  if (!selected || selected.length === 0) {
    return;
  }

  const targetPick = await vscode.window.showQuickPick(
    [
      {
        label: i18n.migrate.targetCopilotRepo(),
        value: 'copilotRepo' as MemoryScope,
      },
      {
        label: i18n.migrate.targetCopilotUser(),
        value: 'copilotUser' as MemoryScope,
      },
      {
        label: i18n.migrate.targetSharedGit(),
        value: 'sharedGit' as MemoryScope,
      },
    ],
    { placeHolder: i18n.migrate.targetTitle() }
  );

  if (!targetPick) {
    return;
  }

  const moveLabel = i18n.command.move();
  const copyLabel = i18n.command.copy();
  const action = await vscode.window.showWarningMessage(
    i18n.migrate.confirm(selected.length, targetPick.label),
    { modal: true },
    moveLabel,
    copyLabel
  );

  if (action !== moveLabel && action !== copyLabel) {
    return;
  }

  const removeSource = action === moveLabel;
  const result = await runLegacyMigration(
    manager,
    selected.map((item) => item.file),
    targetPick.value,
    removeSource
  );

  void vscode.window.showInformationMessage(
    i18n.migrate.done(result.moved.length, result.skipped.length)
  );
}
