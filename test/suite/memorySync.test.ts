import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { MemoryManager } from '../../src/memoryManager';
import { promoteToGit, syncToCopilotRepo } from '../../src/memorySync';
import { MemoryScope, isMemoryFile, isMemoryFolder } from '../../src/types';

function mockScopeRoots(
  manager: MemoryManager,
  workspaceRoot: string,
  tempRoot: string
): Record<MemoryScope, string> {
  const roots: Record<MemoryScope, string> = {
    copilotRepo: path.join(tempRoot, 'copilot-repo'),
    copilotUser: path.join(tempRoot, 'copilot-user'),
    sharedGit: path.join(workspaceRoot, '.nemo'),
    external: workspaceRoot,
  };

  Object.defineProperty(manager, 'getRootForScope', {
    value: (scope: MemoryScope) => roots[scope],
  });

  return roots;
}

suite('memorySync', () => {
  let tempRoot = '';
  let workspaceRoot = '';
  let manager: MemoryManager;

  setup(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nemo-sync-'));
    workspaceRoot = path.join(tempRoot, 'workspace');
    await fs.mkdir(workspaceRoot, { recursive: true });

    manager = new MemoryManager({
      storageUri: { fsPath: path.join(tempRoot, 'ws-storage', 'nemo-context') },
      globalStorageUri: { fsPath: path.join(tempRoot, 'global-storage') },
    } as never);

    Object.defineProperty(manager, 'getConfig', {
      value: () => ({
        sharedPath: '.nemo',
      }),
    });

    mockScopeRoots(manager, workspaceRoot, tempRoot);
  });

  teardown(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  test('syncToCopilotRepo copies sharedGit file into copilotRepo', async () => {
    const created = await manager.createMemory('sharedGit', 'team-rules', 'markdown');
    assert.strictEqual(created.scope, 'sharedGit');

    const synced = await syncToCopilotRepo(manager, created, false);
    assert.strictEqual(synced.scope, 'copilotRepo');
    assert.strictEqual(synced.relativePath, 'team-rules.md');

    await fs.access(created.filePath);
    if (!isMemoryFile(synced)) {
      assert.fail('Expected copilot repo memory file');
    }
    await fs.access(synced.filePath);

    const sharedChildren = await manager.listChildren('sharedGit');
    assert.strictEqual(sharedChildren.length, 1);

    const copilotChildren = await manager.listChildren('copilotRepo');
    assert.strictEqual(copilotChildren.length, 1);
  });

  test('syncToCopilotRepo fails when destination already exists', async () => {
    const shared = await manager.createMemory('sharedGit', 'dup', 'markdown');
    await manager.createMemory('copilotRepo', 'dup', 'markdown');

    await assert.rejects(
      () => syncToCopilotRepo(manager, shared, false),
      /already exists at the destination/
    );
  });

  test('promoteToGit copies copilotRepo folder into sharedGit', async () => {
    await manager.createFolder('copilotRepo', 'backend');
    const repoFile = await manager.createMemory(
      'copilotRepo',
      'rules',
      'markdown',
      'backend'
    );

    const folderNode = (await manager.listChildren('copilotRepo')).find(isMemoryFolder);
    assert.ok(folderNode);

    const promoted = await promoteToGit(manager, folderNode, false);
    assert.strictEqual(promoted.scope, 'sharedGit');
    assert.strictEqual(promoted.relativePath, 'backend');

    const sharedChildren = await manager.listChildren('sharedGit');
    assert.ok(sharedChildren.some((node) => isMemoryFolder(node) && node.name === 'backend'));

    await fs.access(
      path.join(manager.getRootForScope('sharedGit') ?? '', 'backend', 'rules.md')
    );
    await fs.access(repoFile.filePath);
  });
});
