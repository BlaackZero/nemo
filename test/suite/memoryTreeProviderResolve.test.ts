import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  MemoryTreeItem,
  resolveFileNode,
  resolveFolderNode,
} from '../../src/memoryTreeProvider';
import { MemoryFile, MemoryFolder } from '../../src/types';

suite('memoryTreeProvider resolve', () => {
  const fileNode: MemoryFile = {
    kind: 'file',
    scope: 'sharedGit',
    name: 'rules.md',
    relativePath: 'rules.md',
    filePath: '/tmp/rules.md',
    format: 'markdown',
  };

  const folderNode: MemoryFolder = {
    kind: 'folder',
    scope: 'sharedGit',
    name: 'backend',
    relativePath: 'backend',
    absolutePath: '/tmp/backend',
  };

  const fileItem = new MemoryTreeItem(
    fileNode,
    undefined,
    'rules.md',
    vscode.TreeItemCollapsibleState.None,
    'sharedGitMemoryFile'
  );

  const folderItem = new MemoryTreeItem(
    folderNode,
    undefined,
    'backend',
    vscode.TreeItemCollapsibleState.Collapsed,
    'sharedGitMemoryFolder'
  );

  test('resolveFileNode uses explicit tree item argument', () => {
    const treeView = {
      selection: [],
    } as unknown as vscode.TreeView<MemoryTreeItem>;

    const resolved = resolveFileNode(treeView, fileItem);
    assert.strictEqual(resolved?.name, 'rules.md');
  });

  test('resolveFileNode falls back to tree selection', () => {
    const treeView = {
      selection: [fileItem],
    } as unknown as vscode.TreeView<MemoryTreeItem>;

    const resolved = resolveFileNode(treeView);
    assert.strictEqual(resolved?.relativePath, 'rules.md');
  });

  test('resolveFileNode returns undefined without item or selection', () => {
    const treeView = {
      selection: [],
    } as unknown as vscode.TreeView<MemoryTreeItem>;

    assert.strictEqual(resolveFileNode(treeView), undefined);
  });

  test('resolveFolderNode uses explicit folder item', () => {
    const treeView = {
      selection: [],
    } as unknown as vscode.TreeView<MemoryTreeItem>;

    const resolved = resolveFolderNode(treeView, folderItem);
    assert.strictEqual(resolved?.name, 'backend');
  });
});
