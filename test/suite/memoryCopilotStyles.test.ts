import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  GLOBAL_STYLE_MANIFEST_FILENAME,
  renameOverlayPaths,
  StyleOverlay,
} from '../../src/memoryManifest';
import { MemoryManager } from '../../src/memoryManager';
import { MemoryScope } from '../../src/types';

suite('memoryCopilotStyles', () => {
  let tempRoot = '';
  let workspaceRoot = '';
  let globalStorageDir = '';
  let manager: MemoryManager;

  setup(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nemo-copilot-styles-'));
    workspaceRoot = path.join(tempRoot, 'workspace');
    globalStorageDir = path.join(tempRoot, 'global-storage');
    await fs.mkdir(workspaceRoot, { recursive: true });

    manager = new MemoryManager({
      globalStorageUri: { fsPath: globalStorageDir },
    } as never);

    Object.defineProperty(manager, 'getConfig', {
      value: () => ({
        sharedPath: '.nemo',
      }),
    });

    Object.defineProperty(manager, 'getExtensionGlobalStoragePath', {
      value: () => globalStorageDir,
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

  test('setFolderStyle writes copilotUser overlay to global manifest file', async () => {
    await manager.createFolder('copilotUser', 'prefs');

    await manager.setFolderStyle('copilotUser', 'prefs', {
      color: 'terminal.ansiCyan',
      icon: 'gear',
      label: 'Preferences',
    });

    const manifestPath = path.join(globalStorageDir, GLOBAL_STYLE_MANIFEST_FILENAME);
    await fs.access(manifestPath);

    const manifest = await manager.getManifest('copilotUser');
    assert.ok(manifest);
    assert.strictEqual(manifest.folders.prefs?.icon, 'gear');
    assert.strictEqual(manifest.folders.prefs?.label, 'Preferences');
  });

  test('setFileStyle persists copilotUser file overlay across reads', async () => {
    await manager.setFileStyle('copilotUser', 'notes.md', {
      icon: 'book',
      color: 'terminal.ansiBlue',
    });

    const manifest = await manager.getManifest('copilotUser');
    assert.strictEqual(manifest?.files['notes.md']?.icon, 'book');
    assert.strictEqual(manifest?.files['notes.md']?.color, 'terminal.ansiBlue');
  });

  test('renameNode moves copilotUser style overlay paths', async () => {
    await manager.createFolder('copilotUser', 'prefs');
    await manager.setFolderStyle('copilotUser', 'prefs', { icon: 'gear' });

    await manager.renameNode('copilotUser', 'prefs', 'settings', true);

    const manifest = await manager.getManifest('copilotUser');
    assert.strictEqual(manifest?.folders.settings?.icon, 'gear');
    assert.strictEqual(manifest?.folders.prefs, undefined);
  });

  test('renameOverlayPaths moves nested copilot overlay metadata', () => {
    const overlay: StyleOverlay = {
      folders: { backend: { icon: 'server' } },
      files: { 'backend/rules.md': { icon: 'book' } },
    };

    renameOverlayPaths(overlay, 'backend', 'api', true);

    assert.strictEqual(overlay.folders['api']?.icon, 'server');
    assert.strictEqual(overlay.files['api/rules.md']?.icon, 'book');
    assert.strictEqual(overlay.folders['backend'], undefined);
  });
});
