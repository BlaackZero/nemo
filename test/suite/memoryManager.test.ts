import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  compareByOrder,
  createEmptyManifest,
  renameManifestPaths,
  updateSiblingOrder,
} from '../../src/memoryManifest';
import {
  MemoryManager,
  sanitizeMemoryBaseName,
} from '../../src/memoryManager';
import { isMemoryFile, isMemoryFolder } from '../../src/types';

suite('memoryManifest', () => {
  test('compareByOrder respects explicit order values', () => {
    assert.ok(compareByOrder(0, 1, 'a', 'b') < 0);
    assert.ok(compareByOrder(undefined, undefined, 'a', 'b') < 0);
  });

  test('renameManifestPaths moves folder and nested file metadata', () => {
    const manifest = createEmptyManifest();
    manifest.folders.backend = { order: 0, color: 'charts.blue' };
    manifest.files['backend/rules.md'] = { order: 0 };

    renameManifestPaths(manifest, 'backend', 'api', true);

    assert.deepStrictEqual(manifest.folders.api, { order: 0, color: 'charts.blue' });
    assert.deepStrictEqual(manifest.files['api/rules.md'], { order: 0 });
    assert.strictEqual(manifest.folders.backend, undefined);
  });

  test('updateSiblingOrder writes sequential order values', () => {
    const manifest = createEmptyManifest();
    updateSiblingOrder(manifest, '', ['infra', 'backend'], 'folder');

    assert.strictEqual(manifest.folders.infra?.order, 0);
    assert.strictEqual(manifest.folders.backend?.order, 1);
  });
});

suite('memoryManager helpers', () => {
  test('sanitizeMemoryBaseName strips extension and invalid chars', () => {
    assert.strictEqual(
      sanitizeMemoryBaseName(' rules/backend.md '),
      'rules-backend'
    );
  });

  test('sanitizeMemoryBaseName falls back to memory', () => {
    assert.strictEqual(sanitizeMemoryBaseName('***'), 'memory');
  });
});

suite('memoryManager file operations', () => {
  let tempRoot = '';
  let workspaceRoot = '';
  let manager: MemoryManager;

  setup(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-memory-test-'));
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

  test('createMemory writes default markdown content without overwrite', async () => {
    const created = await manager.createMemory('personal', 'reglas', 'markdown');
    const content = await fs.readFile(created.filePath, 'utf8');

    assert.strictEqual(created.name, 'reglas.md');
    assert.strictEqual(created.relativePath, 'reglas.md');
    assert.strictEqual(created.kind, 'file');
    assert.strictEqual(created.scope, 'personal');
    assert.match(content, /^# reglas/);

    await assert.rejects(
      () => manager.createMemory('personal', 'reglas', 'markdown'),
      /EEXIST|exist/
    );
  });

  test('createFolder and nested memory are listed by listChildren', async () => {
    await manager.createFolder('personal', 'backend');
    await manager.createMemory('personal', 'reglas', 'markdown', 'backend');

    const rootChildren = await manager.listChildren('personal');
    const backendFolder = rootChildren.find(
      (node) => isMemoryFolder(node) && node.name === 'backend'
    );
    assert.ok(backendFolder && isMemoryFolder(backendFolder));

    const backendChildren = await manager.listChildren('personal', 'backend');
    assert.strictEqual(backendChildren.length, 1);
    assert.ok(isMemoryFile(backendChildren[0]));
    assert.strictEqual(backendChildren[0]?.name, 'reglas.md');
  });

  test('shared scope uses workspace folder', async () => {
    await manager.createMemory('shared', 'team-rules', 'markdown');

    const sharedPath = path.join(workspaceRoot, '.nemo', 'team-rules.md');
    await fs.access(sharedPath);

    const sharedChildren = await manager.listChildren('shared');
    assert.strictEqual(sharedChildren.length, 1);
  });

  test('listChildren ignores manifest and non-memory files', async () => {
    const dir = await manager.ensureScopeDir('personal');
    await fs.writeFile(path.join(dir, 'notes.txt'), 'ignore me');
    await manager.createMemory('personal', 'valid', 'markdown');

    const children = await manager.listChildren('personal');
    const files = children.filter(isMemoryFile);

    assert.strictEqual(files.length, 1);
    assert.strictEqual(files[0]?.name, 'valid.md');
  });

  test('moveNode moves file into folder within scope', async () => {
    await manager.createFolder('personal', 'backend');
    const created = await manager.createMemory('personal', 'reglas', 'markdown');
    const moved = await manager.moveNode(
      'personal',
      created.relativePath,
      'backend',
      false
    );

    assert.strictEqual(moved.relativePath, 'backend/reglas.md');
    await assert.rejects(() => fs.access(created.filePath));
  });

  test('renameNode renames folder metadata', async () => {
    await manager.createFolder('personal', 'backend');
    await manager.createMemory('personal', 'reglas', 'markdown', 'backend');

    const renamed = await manager.renameNode('personal', 'backend', 'api', true);
    assert.strictEqual(renamed.relativePath, 'api');

    const children = await manager.listChildren('personal');
    assert.ok(children.some((node) => isMemoryFolder(node) && node.name === 'api'));
  });

  test('formatForChat pretty prints json', () => {
    const formatted = manager.formatForChat(
      '{"title":"demo","rules":[]}',
      'json'
    );

    assert.match(formatted, /"title": "demo"/);
  });

  test('deleteMemory removes file', async () => {
    const created = await manager.createMemory('personal', 'temp', 'markdown');
    await manager.deleteMemory('personal', created.filePath, created.relativePath);

    await assert.rejects(() => fs.access(created.filePath));
  });
});
