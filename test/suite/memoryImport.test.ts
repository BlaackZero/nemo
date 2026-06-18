import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { readManifest } from '../../src/memoryManifest';
import { importCandidates } from '../../src/memoryImport';
import {
  isExcludedPath,
  scanAiConventionPaths,
  toTargetRelative,
} from '../../src/memoryImportScan';
import { MemoryManager } from '../../src/memoryManager';
import { MemoryScope } from '../../src/types';

function mockScopeRoots(
  manager: MemoryManager,
  workspaceRoot: string,
  tempRoot: string
): void {
  Object.defineProperty(manager, 'getRootForScope', {
    value: (scope: MemoryScope) => {
      const roots: Record<MemoryScope, string> = {
        copilotRepo: path.join(tempRoot, 'copilot-repo'),
        copilotUser: path.join(tempRoot, 'copilot-user'),
        sharedGit: path.join(workspaceRoot, '.nemo'),
      };
      return roots[scope];
    },
  });
}

suite('memoryImport helpers', () => {
  test('toTargetRelative strips leading dot segments and converts .mdc', () => {
    assert.strictEqual(
      toTargetRelative('.github/copilot-instructions.md'),
      'github/copilot-instructions.md'
    );
    assert.strictEqual(
      toTargetRelative('.cursor/rules/backend.mdc'),
      'cursor/rules/backend.md'
    );
    assert.strictEqual(toTargetRelative('docs/api-rules.md'), 'docs/api-rules.md');
  });

  test('isExcludedPath excludes root README, shared folder, and build dirs', () => {
    assert.strictEqual(isExcludedPath('README.md', '.nemo'), true);
    assert.strictEqual(isExcludedPath('.nemo/rules.md', '.nemo'), true);
    assert.strictEqual(isExcludedPath('node_modules/pkg/readme.md', '.nemo'), true);
    assert.strictEqual(isExcludedPath('docs/guide.md', '.nemo'), false);
  });
});

suite('memoryImport scan', () => {
  let tempRoot = '';

  setup(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nemo-import-scan-'));
  });

  teardown(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  test('scanAiConventionPaths detects Copilot and AGENTS files', async () => {
    await fs.mkdir(path.join(tempRoot, '.github'), { recursive: true });
    await fs.writeFile(
      path.join(tempRoot, '.github/copilot-instructions.md'),
      '# copilot',
      'utf8'
    );
    await fs.writeFile(path.join(tempRoot, 'AGENTS.md'), '# agents', 'utf8');

    const paths = await scanAiConventionPaths(tempRoot);

    assert.ok(paths.includes('.github/copilot-instructions.md'));
    assert.ok(paths.includes('AGENTS.md'));
  });
});

suite('memoryImport execute', () => {
  let tempRoot = '';
  let workspaceRoot = '';
  let manager: MemoryManager;

  setup(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nemo-import-exec-'));
    workspaceRoot = path.join(tempRoot, 'workspace');
    await fs.mkdir(workspaceRoot, { recursive: true });

    manager = new MemoryManager({
      storageUri: { fsPath: path.join(tempRoot, 'ws-storage', 'nemo-context') },
      globalStorageUri: { fsPath: path.join(tempRoot, 'global-storage') },
    } as never);

    Object.defineProperty(manager, 'getConfig', {
      value: () => ({
        storageLocation: 'home' as const,
        repoIdStrategy: 'workspaceName' as const,
        sharedPath: '.nemo',
      }),
    });

    Object.defineProperty(manager, 'getCurrentRepoIdentity', {
      value: () => ({
        repoId: 'test-repo',
        displayName: 'test-repo',
        workspacePath: workspaceRoot,
      }),
    });

    mockScopeRoots(manager, workspaceRoot, tempRoot);
  });

  teardown(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  test('importCandidates moves repo markdown into copilotRepo and deletes source', async () => {
    const sourceRelative = 'docs/api-rules.md';
    const sourceAbsolute = path.join(workspaceRoot, sourceRelative);
    await fs.mkdir(path.dirname(sourceAbsolute), { recursive: true });
    await fs.writeFile(sourceAbsolute, '# rules', 'utf8');

    const result = await importCandidates(
      manager,
      [
        {
          id: `repoMarkdown:${sourceRelative}`,
          kind: 'repoMarkdown',
          sourcePath: sourceAbsolute,
          workspaceRelative: sourceRelative,
          targetRelative: toTargetRelative(sourceRelative),
          label: 'api-rules.md',
          description: 'Repository markdown',
          conflict: false,
        },
      ],
      'copilotRepo'
    );

    assert.deepStrictEqual(result.moved, [sourceRelative]);
    assert.strictEqual(result.skipped.length, 0);
    await assert.rejects(() => fs.access(sourceAbsolute));

    const targetAbsolute = path.join(
      tempRoot,
      'copilot-repo',
      toTargetRelative(sourceRelative)
    );
    await fs.access(targetAbsolute);
  });

  test('importCandidates copies repo markdown into sharedGit when targeted', async () => {
    const sourceRelative = 'docs/team-rules.md';
    const sourceAbsolute = path.join(workspaceRoot, sourceRelative);
    await fs.mkdir(path.dirname(sourceAbsolute), { recursive: true });
    await fs.writeFile(sourceAbsolute, '# rules', 'utf8');

    const result = await importCandidates(
      manager,
      [
        {
          id: `repoMarkdown:${sourceRelative}`,
          kind: 'repoMarkdown',
          sourcePath: sourceAbsolute,
          workspaceRelative: sourceRelative,
          targetRelative: toTargetRelative(sourceRelative),
          label: 'team-rules.md',
          description: 'Repository markdown',
          conflict: false,
        },
      ],
      'sharedGit'
    );

    assert.deepStrictEqual(result.moved, [sourceRelative]);
    const targetAbsolute = path.join(
      workspaceRoot,
      '.nemo',
      toTargetRelative(sourceRelative)
    );
    await fs.access(targetAbsolute);

    const manifest = await readManifest(path.join(workspaceRoot, '.nemo'));
    assert.strictEqual(
      manifest.files[toTargetRelative(sourceRelative)]?.importedFrom,
      sourceRelative
    );
  });

  test('importCandidates skips conflicting candidates', async () => {
    const copilotRoot = path.join(tempRoot, 'copilot-repo');
    await fs.mkdir(copilotRoot, { recursive: true });
    await fs.writeFile(path.join(copilotRoot, 'rules.md'), '# existing', 'utf8');

    const sourceAbsolute = path.join(workspaceRoot, 'rules.md');
    await fs.writeFile(sourceAbsolute, '# new', 'utf8');

    const result = await importCandidates(
      manager,
      [
        {
          id: 'repoMarkdown:rules.md',
          kind: 'repoMarkdown',
          sourcePath: sourceAbsolute,
          workspaceRelative: 'rules.md',
          targetRelative: 'rules.md',
          label: 'rules.md',
          description: 'Repository markdown',
          conflict: true,
        },
      ],
      'copilotRepo'
    );

    assert.strictEqual(result.moved.length, 0);
    assert.strictEqual(result.skipped.length, 1);
    assert.strictEqual(result.skipped[0]?.reason, 'conflict');
    await fs.access(sourceAbsolute);
  });
});
