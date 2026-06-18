import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  MemoryManager,
  sanitizeMemoryBaseName,
} from '../../src/memoryManager';

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
  let manager: MemoryManager;

  setup(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-memory-test-'));
    manager = new MemoryManager({
      globalStorageUri: { fsPath: path.join(tempRoot, 'global-storage') },
    } as never);

    Object.defineProperty(manager, 'getConfig', {
      value: () => ({
        storageLocation: 'home' as const,
        repoIdStrategy: 'workspaceName' as const,
      }),
    });

    Object.defineProperty(manager, 'getCurrentRepoIdentity', {
      value: () => ({
        repoId: 'test-repo',
        displayName: 'test-repo',
        workspacePath: tempRoot,
      }),
    });

    Object.defineProperty(manager, 'getStorageRoot', {
      value: () => path.join(tempRoot, 'store'),
    });

    Object.defineProperty(manager, 'getRepoMemoryDir', {
      value: () => path.join(tempRoot, 'store', 'test-repo'),
    });
  });

  teardown(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  test('createMemory writes default markdown content without overwrite', async () => {
    const created = await manager.createMemory('reglas', 'markdown');
    const content = await fs.readFile(created.filePath, 'utf8');

    assert.strictEqual(created.name, 'reglas.md');
    assert.match(content, /^# reglas/);

    await assert.rejects(
      () => manager.createMemory('reglas', 'markdown'),
      /EEXIST|exist/
    );
  });

  test('createMemory writes default json content', async () => {
    const created = await manager.createMemory('config', 'json');
    const content = await fs.readFile(created.filePath, 'utf8');
    const parsed = JSON.parse(content) as { title: string };

    assert.strictEqual(created.name, 'config.json');
    assert.strictEqual(parsed.title, 'config');
  });

  test('listMemories ignores non memory files', async () => {
    const dir = await manager.ensureRepoDir();
    await fs.writeFile(path.join(dir, 'notes.txt'), 'ignore me');
    await manager.createMemory('valid', 'markdown');

    const memories = await manager.listMemories();

    assert.strictEqual(memories.length, 1);
    assert.strictEqual(memories[0]?.name, 'valid.md');
  });

  test('formatForChat pretty prints json', () => {
    const formatted = manager.formatForChat(
      '{"title":"demo","rules":[]}',
      'json'
    );

    assert.match(formatted, /"title": "demo"/);
  });

  test('deleteMemory removes file', async () => {
    const created = await manager.createMemory('temp', 'markdown');
    await manager.deleteMemory(created.filePath);

    await assert.rejects(() => fs.access(created.filePath));
  });
});
