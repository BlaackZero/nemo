import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { getExternalFileMeta, MemoryManifest } from '../../src/memoryManifest';
import { MemoryManager } from '../../src/memoryManager';
import { scanExternalMarkdownPaths } from '../../src/memoryImportScan';
import { isMemoryFolder, MemoryScope } from '../../src/types';

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
        external: workspaceRoot,
      };
      return roots[scope];
    },
  });
}

suite('memoryExternal', () => {
  let tempRoot = '';
  let workspaceRoot = '';
  let manager: MemoryManager;

  setup(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nemo-external-'));
    workspaceRoot = path.join(tempRoot, 'workspace');
    await fs.mkdir(workspaceRoot, { recursive: true });

    manager = new MemoryManager({
      storageUri: { fsPath: path.join(tempRoot, 'ws-storage', 'nemo-context') },
      globalStorageUri: { fsPath: path.join(tempRoot, 'global-storage') },
    } as never);

    Object.defineProperty(manager, 'getConfig', {
      value: () => ({ sharedPath: '.nemo' }),
    });

    mockScopeRoots(manager, workspaceRoot, tempRoot);
  });

  teardown(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  test('scanExternalMarkdownPaths finds AI instruction files on disk', async () => {
    await fs.writeFile(path.join(workspaceRoot, 'AGENTS.md'), '# agents', 'utf8');
    await fs.mkdir(path.join(workspaceRoot, '.cursor', 'rules'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(workspaceRoot, '.cursor', 'rules', 'backend.mdc'),
      '# rules',
      'utf8'
    );

    manager.invalidateExternalCache();
    const paths = await scanExternalMarkdownPaths(manager);

    assert.ok(paths.includes('AGENTS.md'));
    assert.ok(paths.includes('.cursor/rules/backend.mdc'));
  });

  test('listChildren external builds virtual folder tree', async () => {
    await fs.mkdir(path.join(workspaceRoot, '.cursor', 'rules'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(workspaceRoot, '.cursor', 'rules', 'backend.mdc'),
      '# rules',
      'utf8'
    );

    manager.invalidateExternalCache();
    const rootChildren = await manager.listChildren('external');

    assert.ok(
      rootChildren.some(
        (n) => isMemoryFolder(n) && n.relativePath === '.cursor'
      )
    );

    const cursorFolder = rootChildren.find(
      (n) => isMemoryFolder(n) && n.relativePath === '.cursor'
    );
    assert.ok(cursorFolder);

    const rulesChildren = await manager.listChildren('external', '.cursor');
    assert.ok(
      rulesChildren.some(
        (n) => isMemoryFolder(n) && n.relativePath === '.cursor/rules'
      )
    );

    const leafChildren = await manager.listChildren('external', '.cursor/rules');
    assert.strictEqual(leafChildren.length, 1);
    assert.strictEqual(leafChildren[0]?.scope, 'external');
    assert.strictEqual(leafChildren[0]?.relativePath, '.cursor/rules/backend.mdc');
  });

  test('createMemory rejects external scope', async () => {
    await assert.rejects(
      () => manager.createMemory('external', 'test', 'markdown'),
      /read-only/i
    );
  });

  test('setFileStyle writes external overlay in manifest', async () => {
    await fs.mkdir(path.join(workspaceRoot, '.nemo'), { recursive: true });
    await fs.writeFile(path.join(workspaceRoot, 'AGENTS.md'), '# agents', 'utf8');

    await manager.setFileStyle('external', 'AGENTS.md', {
      color: 'terminal.ansiBlue',
      icon: 'book',
    });

    const manifest = (await manager.getManifest('external')) as MemoryManifest;
    assert.ok(manifest);
    assert.strictEqual(
      getExternalFileMeta(manifest, 'AGENTS.md').icon,
      'book'
    );
  });

  test('setFolderStyle writes external folder overlay in manifest', async () => {
    await fs.mkdir(path.join(workspaceRoot, '.nemo'), { recursive: true });

    await manager.setFolderStyle('external', 'docs', {
      color: 'terminal.ansiCyan',
      icon: 'book',
      label: 'Documentation',
    });

    const manifest = (await manager.getManifest('external')) as MemoryManifest;
    assert.ok(manifest);
    assert.strictEqual(manifest.external?.folders.docs?.icon, 'book');
    assert.strictEqual(manifest.external?.folders.docs?.label, 'Documentation');
  });
});
