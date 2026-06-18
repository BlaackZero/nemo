import * as fs from 'fs/promises';
import * as path from 'path';
import { readManifest, writeManifest } from './memoryManifest';
import { movePathCrossDevice, MemoryManager } from './memoryManager';
import { ImportCandidate } from './memoryImportScan';
import { ImportTarget } from './types';

export interface ImportResult {
  moved: string[];
  skipped: Array<{ path: string; reason: string }>;
}

async function writeMarkdownTarget(
  sourcePath: string,
  targetAbsolute: string,
  removeSource: boolean
): Promise<void> {
  await fs.mkdir(path.dirname(targetAbsolute), { recursive: true });

  if (sourcePath.endsWith('.mdc')) {
    const content = await fs.readFile(sourcePath, 'utf8');
    await fs.writeFile(targetAbsolute, content, 'utf8');
    if (removeSource) {
      await fs.rm(sourcePath);
    }
    return;
  }

  if (sourcePath.endsWith('.json')) {
    const content = await fs.readFile(sourcePath, 'utf8');
    await fs.writeFile(targetAbsolute, `# Imported JSON memory\n\n\`\`\`json\n${content}\n\`\`\`\n`, 'utf8');
    if (removeSource) {
      await fs.rm(sourcePath);
    }
    return;
  }

  if (removeSource) {
    await movePathCrossDevice(sourcePath, targetAbsolute);
  } else {
    await fs.copyFile(sourcePath, targetAbsolute);
  }
}

async function importToScope(
  manager: MemoryManager,
  candidate: ImportCandidate,
  scope: 'copilotRepo' | 'sharedGit',
  removeSource: boolean
): Promise<void> {
  const root = await manager.ensureScopeDir(scope);
  const targetAbsolute = path.join(root, candidate.targetRelative);
  await writeMarkdownTarget(candidate.sourcePath, targetAbsolute, removeSource);

  if (scope === 'sharedGit') {
    const manifest = await readManifest(root);
    manifest.files[candidate.targetRelative] = {
      ...manifest.files[candidate.targetRelative],
      importedFrom: candidate.workspaceRelative,
    };
    await writeManifest(root, manifest);
  }
}

export async function importCandidates(
  manager: MemoryManager,
  candidates: ImportCandidate[],
  target: ImportTarget
): Promise<ImportResult> {
  const result: ImportResult = { moved: [], skipped: [] };

  for (const candidate of candidates) {
    if (candidate.conflict) {
      result.skipped.push({
        path: candidate.workspaceRelative,
        reason: 'conflict',
      });
      continue;
    }

    try {
      if (target === 'both') {
        await importToScope(manager, candidate, 'copilotRepo', false);
        await importToScope(manager, candidate, 'sharedGit', true);
      } else if (target === 'copilotRepo') {
        await importToScope(manager, candidate, 'copilotRepo', true);
      } else {
        await importToScope(manager, candidate, 'sharedGit', true);
      }

      result.moved.push(candidate.workspaceRelative);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.skipped.push({
        path: candidate.workspaceRelative,
        reason: message,
      });
    }
  }

  return result;
}
