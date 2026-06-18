import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  compareByOrder,
  createEmptyManifest,
  ensureManifest,
  readManifest,
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

  test('mergeFolderMeta clears undefined style keys', async () => {
    const { mergeFolderMeta } = await import('../../src/memoryManifest');
    const merged = mergeFolderMeta(
      { color: 'terminal.ansiBlue', icon: 'server', label: 'API' },
      { color: undefined, icon: undefined, label: undefined }
    );
    assert.deepStrictEqual(merged, {});
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
        sharedPath: '.nemo',
      }),
    });

    Object.defineProperty(manager, 'getExtensionGlobalStoragePath', {
      value: () => path.join(tempRoot, 'global-storage'),
    });

    Object.defineProperty(manager, 'getExtensionWorkspaceStoragePath', {
      value: () => path.join(tempRoot, 'ws-storage', 'nemo-context'),
    });

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

  test('read-only tree paths do not create workspace .nemo store', async () => {
    const nemoDir = path.join(workspaceRoot, '.nemo');
    const nemoManifest = path.join(nemoDir, '.nemo.json');

    await manager.createMemory('copilotRepo', 'rules', 'markdown');
    await manager.listChildren('copilotRepo');
    await manager.getManifest('copilotRepo');
    await manager.listChildren('sharedGit');
    await manager.listChildren('external');
    await manager.getManifest('external');

    await assert.rejects(() => fs.access(nemoDir));
    await assert.rejects(() => fs.access(nemoManifest));
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

  test('setFolderStyle persists color icon and label for sharedGit folders', async () => {
    await manager.createFolder('sharedGit', 'backend');

    await manager.setFolderStyle('sharedGit', 'backend', {
      color: 'terminal.ansiGreen',
      icon: 'server',
      label: 'API Backend',
    });

    const manifest = await manager.getManifest('sharedGit');
    assert.ok(manifest);
    assert.strictEqual(manifest.folders.backend?.color, 'terminal.ansiGreen');
    assert.strictEqual(manifest.folders.backend?.icon, 'server');
    assert.strictEqual(manifest.folders.backend?.label, 'API Backend');
  });

  test('setFolderStyle clears custom folder styles when reset', async () => {
    await manager.createFolder('sharedGit', 'backend');
    await manager.setFolderStyle('sharedGit', 'backend', {
      color: 'terminal.ansiGreen',
      icon: 'server',
      label: 'API Backend',
    });

    await manager.setFolderStyle('sharedGit', 'backend', {
      color: undefined,
      icon: undefined,
      label: undefined,
    });

    const manifest = await manager.getManifest('sharedGit');
    assert.deepStrictEqual(manifest?.folders.backend, {});
  });

  test('setFolderStyle persists copilotRepo overlay in extension workspace storage', async () => {
    const workspaceStorage = path.join(tempRoot, 'ws-storage', 'nemo-context');

    await manager.createFolder('copilotRepo', 'backend');

    await manager.setFolderStyle('copilotRepo', 'backend', {
      color: 'terminal.ansiBlue',
      icon: 'server',
      label: 'API Backend',
    });

    const manifest = await manager.getManifest('copilotRepo');
    assert.ok(manifest);
    assert.strictEqual(manifest.folders.backend?.icon, 'server');
    assert.strictEqual(manifest.folders.backend?.label, 'API Backend');

    const workspaceManifest = await readManifest(path.join(workspaceRoot, '.nemo'));
    assert.strictEqual(workspaceManifest.copilotRepo, undefined);

    await fs.access(
      path.join(workspaceStorage, '.nemo-project-styles.json')
    );
  });

  test('renameNode moves copilotRepo style overlay paths', async () => {
    await manager.createFolder('copilotRepo', 'backend');
    await manager.setFolderStyle('copilotRepo', 'backend', { icon: 'server' });

    await manager.renameNode('copilotRepo', 'backend', 'api', true);

    const manifest = await manager.getManifest('copilotRepo');
    assert.strictEqual(manifest?.folders.api?.icon, 'server');
    assert.strictEqual(manifest?.folders.backend, undefined);
  });

  test('deleteMemory removes copilotRepo file style overlay', async () => {
    const created = await manager.createMemory('copilotRepo', 'temp', 'markdown');
    await manager.setFileStyle('copilotRepo', created.relativePath, {
      icon: 'book',
      color: 'terminal.ansiCyan',
    });

    await manager.deleteMemory('copilotRepo', created.filePath, created.relativePath);

    const manifest = await manager.getManifest('copilotRepo');
    assert.strictEqual(manifest?.files[created.relativePath], undefined);
  });

  test('migrates legacy copilotRepo styles from workspace manifest', async () => {
    const sharedDir = path.join(workspaceRoot, '.nemo');
    await fs.mkdir(sharedDir, { recursive: true });
    await fs.writeFile(
      path.join(sharedDir, '.nemo.json'),
      `${JSON.stringify(
        {
          version: 1,
          folders: {},
          files: {},
          copilotRepo: {
            folders: { legacy: { icon: 'book', label: 'Old API' } },
            files: {},
          },
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const freshManager = new MemoryManager({
      globalStorageUri: { fsPath: path.join(tempRoot, 'global-storage') },
    } as never);

    Object.defineProperty(freshManager, 'getConfig', {
      value: () => ({ sharedPath: '.nemo' }),
    });
    Object.defineProperty(freshManager, 'getExtensionGlobalStoragePath', {
      value: () => path.join(tempRoot, 'global-storage'),
    });
    Object.defineProperty(freshManager, 'getExtensionWorkspaceStoragePath', {
      value: () => path.join(tempRoot, 'ws-storage', 'nemo-context'),
    });
    Object.defineProperty(freshManager, 'getRootForScope', {
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

    const manifest = await freshManager.getManifest('copilotRepo');
    assert.strictEqual(manifest?.folders.legacy?.icon, 'book');

    const workspaceManifest = await readManifest(sharedDir);
    assert.strictEqual(workspaceManifest.copilotRepo, undefined);
  });
});
