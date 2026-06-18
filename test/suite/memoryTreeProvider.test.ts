import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { MemoryTreeProvider } from '../../src/memoryTreeProvider';
import { MemoryManager } from '../../src/memoryManager';
import {
  buildDefaultMemoryContent,
  formatMemoryTitle,
} from '../../src/memoryTemplates';
import { isMemoryFolder, MemoryScope } from '../../src/types';

suite('memoryTemplates', () => {
  test('formatMemoryTitle capitalizes hyphenated names', () => {
    assert.strictEqual(formatMemoryTitle('backend-basics'), 'Backend Basics');
  });

  test('buildDefaultMemoryContent markdown includes English sections', () => {
    const content = buildDefaultMemoryContent('backend-basics', 'markdown');

    assert.match(content, /^# Backend Basics/);
    assert.match(content, /> Nemo memory — repository context for Copilot/);
    assert.match(content, /## Overview/);
    assert.match(content, /## Context/);
    assert.match(content, /## Rules/);
    assert.match(content, /## Prompts/);
    assert.match(content, /## Examples/);
    assert.doesNotMatch(content, /Contexto|Reglas/);
  });

  test('buildDefaultMemoryContent json includes structured rules', () => {
    const content = buildDefaultMemoryContent('backend-basics', 'json');
    const parsed = JSON.parse(content) as {
      title: string;
      rules: { do: unknown[]; dont: unknown[] };
      prompts: unknown[];
      examples: unknown[];
    };

    assert.strictEqual(parsed.title, 'Backend Basics');
    assert.ok(Array.isArray(parsed.rules.do));
    assert.ok(Array.isArray(parsed.rules.dont));
    assert.ok(Array.isArray(parsed.prompts));
    assert.ok(Array.isArray(parsed.examples));
  });
});

suite('memoryTreeProvider', () => {
  let tempRoot = '';
  let workspaceRoot = '';
  let manager: MemoryManager;

  setup(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nemo-tree-'));
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

  test('getChildren at root returns four section headers', async () => {
    const provider = new MemoryTreeProvider(manager);

    const root = await provider.getChildren();

    assert.strictEqual(root.length, 4);
    assert.strictEqual(root[0]?.contextValue, 'copilotRepoSection');
    assert.strictEqual(root[1]?.contextValue, 'copilotUserSection');
    assert.strictEqual(root[2]?.contextValue, 'sharedGitSection');
    assert.strictEqual(root[3]?.contextValue, 'externalSection');
    assert.strictEqual(
      root[0]?.collapsibleState,
      vscode.TreeItemCollapsibleState.Collapsed
    );
  });

  test('getChildren under copilotRepo section lists folder without duplicate description', async () => {
    await manager.createFolder('copilotRepo', 'backend');

    const provider = new MemoryTreeProvider(manager);
    const root = await provider.getChildren();
    const repoSection = root.find((item) => item.contextValue === 'copilotRepoSection');
    assert.ok(repoSection);

    const repoChildren = await provider.getChildren(repoSection);
    assert.strictEqual(repoChildren.length, 1);

    const folderItem = repoChildren[0];
    assert.ok(folderItem?.node && isMemoryFolder(folderItem.node));
    assert.strictEqual(folderItem.label, 'backend');
    assert.strictEqual(folderItem.description, '/memories/repo/backend');
  });

  test('getChildren applies copilotRepo folder style overlay', async () => {
    await manager.createFolder('copilotRepo', 'backend');
    await manager.setFolderStyle('copilotRepo', 'backend', {
      label: 'API Backend',
      icon: 'server',
      color: 'terminal.ansiGreen',
    });

    const provider = new MemoryTreeProvider(manager);
    const root = await provider.getChildren();
    const repoSection = root.find((item) => item.contextValue === 'copilotRepoSection');
    assert.ok(repoSection);

    const repoChildren = await provider.getChildren(repoSection);
    const folderItem = repoChildren[0];
    assert.ok(folderItem?.node);

    assert.strictEqual(folderItem.label, 'API Backend');
    assert.strictEqual(folderItem.description, 'backend');
  });
});
