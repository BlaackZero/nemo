import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { MemoryManager } from '../../src/memoryManager';
import { shareToRepo, unshareFromRepo } from '../../src/memorySync';
import { isMemoryFile, isMemoryFolder } from '../../src/types';

suite('memorySync', () => {
  let tempRoot = '';
  let workspaceRoot = '';
  let manager: MemoryManager;

  setup(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-memory-sync-'));
    workspaceRoot = path.join(tempRoot, 'workspace');
    await fs.mkdir(workspaceRoot, { recursive: true });

    manager = new MemoryManager({
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

    Object.defineProperty(manager, 'getExtensionGlobalStoragePath', {
      value: () => path.join(tempRoot, 'global-storage'),
    });

    Object.defineProperty(manager, 'getPersonalMemoryDir', {
      value: () => path.join(tempRoot, 'store', 'test-repo'),
    });

    Object.defineProperty(manager, 'getSharedMemoryDir', {
      value: () => path.join(workspaceRoot, '.nemo'),
    });

    Object.defineProperty(manager, 'getRootForScope', {
      value: (scope: 'personal' | 'shared') =>
        scope === 'shared'
          ? path.join(workspaceRoot, '.nemo')
          : path.join(tempRoot, 'store', 'test-repo'),
    });
  });

  teardown(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  test('shareToRepo moves personal file into shared store', async () => {
    const created = await manager.createMemory('personal', 'personal', 'markdown');
    assert.strictEqual(created.scope, 'personal');

    const shared = await shareToRepo(manager, created);
    assert.strictEqual(shared.scope, 'shared');
    assert.strictEqual(shared.relativePath, 'personal.md');

    await assert.rejects(() => fs.access(created.filePath));
    if (!isMemoryFile(shared)) {
      assert.fail('Expected shared memory file');
    }
    await fs.access(shared.filePath);

    const personalChildren = await manager.listChildren('personal');
    assert.strictEqual(personalChildren.length, 0);

    const sharedChildren = await manager.listChildren('shared');
    assert.strictEqual(sharedChildren.length, 1);
  });

  test('shareToRepo fails when destination already exists', async () => {
    const personal = await manager.createMemory('personal', 'dup', 'markdown');
    await manager.createMemory('shared', 'dup', 'markdown');

    await assert.rejects(
      () => shareToRepo(manager, personal),
      /already exists in shared memories/
    );
  });

  test('unshareFromRepo moves shared folder back to personal', async () => {
    await manager.createFolder('shared', 'backend');
    const sharedFile = await manager.createMemory(
      'shared',
      'rules',
      'markdown',
      'backend'
    );

    const folderNode = (await manager.listChildren('shared')).find(isMemoryFolder);
    assert.ok(folderNode);

    const movedFolder = await unshareFromRepo(manager, folderNode);
    assert.strictEqual(movedFolder.scope, 'personal');
    assert.strictEqual(movedFolder.relativePath, 'backend');

    const personalChildren = await manager.listChildren('personal');
    assert.ok(personalChildren.some((node) => isMemoryFolder(node) && node.name === 'backend'));

    await fs.access(path.join(manager.getRootForScope('personal') ?? '', 'backend', 'rules.md'));
    await assert.rejects(() => fs.access(sharedFile.filePath));
  });
});
