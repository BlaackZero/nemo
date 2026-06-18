import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { MemoryManager } from '../../src/memoryManager';
import { moveNodeToScope, promoteToGit, syncToCopilotRepo } from '../../src/memorySync';
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

  test('moveNodeToScope moves copilotRepo file into copilotUser', async () => {
    const created = await manager.createMemory('copilotRepo', 'team-rules', 'markdown');

    const moved = await moveNodeToScope(manager, created, 'copilotUser');
    assert.strictEqual(moved.scope, 'copilotUser');
    assert.strictEqual(moved.relativePath, 'team-rules.md');

    await assert.rejects(() => fs.access(created.filePath));
    if (!isMemoryFile(moved)) {
      assert.fail('Expected global memory file');
    }
    await fs.access(moved.filePath);

    const projectChildren = await manager.listChildren('copilotRepo');
    assert.strictEqual(projectChildren.length, 0);

    const globalChildren = await manager.listChildren('copilotUser');
    assert.strictEqual(globalChildren.length, 1);
  });

  test('moveNodeToScope moves into target folder', async () => {
    await manager.createFolder('copilotUser', 'personal');
    const created = await manager.createMemory('copilotRepo', 'notes', 'markdown');

    const moved = await moveNodeToScope(
      manager,
      created,
      'copilotUser',
      'personal'
    );

    assert.strictEqual(moved.relativePath, 'personal/notes.md');
    await assert.rejects(() => fs.access(created.filePath));
    if (!isMemoryFile(moved)) {
      assert.fail('Expected global memory file');
    }
    await fs.access(moved.filePath);
  });

  test('moveNodeToScope moves sharedGit into copilotRepo and removes source', async () => {
    const created = await manager.createMemory('sharedGit', 'team-rules', 'markdown');

    const moved = await moveNodeToScope(manager, created, 'copilotRepo', undefined, true);
    assert.strictEqual(moved.scope, 'copilotRepo');

    await assert.rejects(() => fs.access(created.filePath));
    if (!isMemoryFile(moved)) {
      assert.fail('Expected project memory file');
    }
    await fs.access(moved.filePath);

    const sharedChildren = await manager.listChildren('sharedGit');
    assert.strictEqual(sharedChildren.length, 0);
  });

  test('moveNodeToScope rejects external scope', async () => {
    const created = await manager.createMemory('copilotRepo', 'rules', 'markdown');

    await assert.rejects(
      () => moveNodeToScope(manager, created, 'external'),
      /cannot be moved/
    );
  });
});
