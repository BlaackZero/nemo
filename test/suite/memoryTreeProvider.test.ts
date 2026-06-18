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
import { isMemoryFolder } from '../../src/types';

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

  test('getChildren at root returns only section headers', async () => {
    const provider = new MemoryTreeProvider(manager);

    const root = await provider.getChildren();

    assert.strictEqual(root.length, 2);
    assert.strictEqual(root[0]?.contextValue, 'sharedSection');
    assert.strictEqual(root[1]?.contextValue, 'personalSection');
    assert.strictEqual(
      root[0]?.collapsibleState,
      vscode.TreeItemCollapsibleState.Collapsed
    );
    assert.strictEqual(
      root[1]?.collapsibleState,
      vscode.TreeItemCollapsibleState.Collapsed
    );
  });

  test('getChildren under personal section lists folder once without duplicate description', async () => {
    await manager.createFolder('personal', 'backend');

    const provider = new MemoryTreeProvider(manager);
    const root = await provider.getChildren();
    const personalSection = root.find((item) => item.contextValue === 'personalSection');
    assert.ok(personalSection);

    const personalChildren = await provider.getChildren(personalSection);
    assert.strictEqual(personalChildren.length, 1);

    const folderItem = personalChildren[0];
    assert.ok(folderItem?.node && isMemoryFolder(folderItem.node));
    assert.strictEqual(folderItem.label, 'backend');
    assert.strictEqual(folderItem.description, undefined);
    assert.strictEqual(folderItem.tooltip, 'backend');
  });
});
