import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  compareByOrder,
  createEmptyManifest,
  ensureManifest,
  renameManifestPaths,
  updateSiblingOrder,
} from '../../src/memoryManifest';
import {
  MemoryManager,
  sanitizeMemoryBaseName,
} from '../../src/memoryManager';
import { isMemoryFile, isMemoryFolder, MemoryScope } from '../../src/types';

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

  test('ensureManifest creates store directory and manifest when missing', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nemo-manifest-'));
    const storeDir = path.join(tempRoot, '.nemo');

    await ensureManifest(storeDir);

    await fs.access(storeDir);
    await fs.access(path.join(storeDir, '.nemo.json'));
    await fs.rm(tempRoot, { recursive: true, force: true });
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
      value: (scope: MemoryScope) => {
        const roots: Record<MemoryScope, string> = {
          copilotRepo: path.join(tempRoot, 'copilot-repo'),
          copilotUser: path.join(tempRoot, 'copilot-user'),
          sharedGit: path.join(workspaceRoot, '.nemo'),
        };
        return roots[scope];
      },
    });
  });

  teardown(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  test('createMemory writes default markdown content without overwrite', async () => {
    const created = await manager.createMemory('copilotRepo', 'backend-basics', 'markdown');
    const content = await fs.readFile(created.filePath, 'utf8');

    assert.strictEqual(created.name, 'backend-basics.md');
    assert.strictEqual(created.relativePath, 'backend-basics.md');
    assert.strictEqual(created.kind, 'file');
    assert.strictEqual(created.scope, 'copilotRepo');
    assert.match(content, /^# Backend Basics/);
    assert.match(content, /## Overview/);
    assert.doesNotMatch(content, /Contexto|Reglas/);

    await assert.rejects(
      () => manager.createMemory('copilotRepo', 'backend-basics', 'markdown'),
      /EEXIST|exist/
    );
  });

  test('createFolder and nested memory are listed by listChildren', async () => {
    await manager.createFolder('copilotRepo', 'backend');
    await manager.createMemory('copilotRepo', 'reglas', 'markdown', 'backend');

    const rootChildren = await manager.listChildren('copilotRepo');
    const backendFolder = rootChildren.find(
      (node) => isMemoryFolder(node) && node.name === 'backend'
    );
    assert.ok(backendFolder && isMemoryFolder(backendFolder));

    const backendChildren = await manager.listChildren('copilotRepo', 'backend');
    assert.strictEqual(backendChildren.length, 1);
    assert.ok(isMemoryFile(backendChildren[0]));
    assert.strictEqual(backendChildren[0]?.name, 'reglas.md');
  });

  test('sharedGit scope uses workspace folder', async () => {
    await manager.createMemory('sharedGit', 'team-rules', 'markdown');

    const sharedPath = path.join(workspaceRoot, '.nemo', 'team-rules.md');
    await fs.access(sharedPath);

    const sharedChildren = await manager.listChildren('sharedGit');
    assert.strictEqual(sharedChildren.length, 1);
  });

  test('listChildren ignores manifest and non-memory files', async () => {
    const dir = await manager.ensureScopeDir('copilotRepo');
    await fs.writeFile(path.join(dir, 'notes.txt'), 'ignore me');
    await manager.createMemory('copilotRepo', 'valid', 'markdown');

    const children = await manager.listChildren('copilotRepo');
    const files = children.filter(isMemoryFile);

    assert.strictEqual(files.length, 1);
    assert.strictEqual(files[0]?.name, 'valid.md');
  });

  test('moveNode moves file into folder within scope', async () => {
    await manager.createFolder('copilotRepo', 'backend');
    const created = await manager.createMemory('copilotRepo', 'reglas', 'markdown');
    const moved = await manager.moveNode(
      'copilotRepo',
      created.relativePath,
      'backend',
      false
    );

    assert.strictEqual(moved.relativePath, 'backend/reglas.md');
    await assert.rejects(() => fs.access(created.filePath));
  });

  test('renameNode renames folder metadata', async () => {
    await manager.createFolder('copilotRepo', 'backend');
    await manager.createMemory('copilotRepo', 'reglas', 'markdown', 'backend');

    const renamed = await manager.renameNode('copilotRepo', 'backend', 'api', true);
    assert.strictEqual(renamed.relativePath, 'api');

    const children = await manager.listChildren('copilotRepo');
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
    const created = await manager.createMemory('copilotRepo', 'temp', 'markdown');
    await manager.deleteMemory('copilotRepo', created.filePath, created.relativePath);

    await assert.rejects(() => fs.access(created.filePath));
  });
});
