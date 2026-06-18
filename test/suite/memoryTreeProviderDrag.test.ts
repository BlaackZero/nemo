import * as assert from 'assert';
import * as vscode from 'vscode';
import { MemoryManager } from '../../src/memoryManager';
import {
  MemoryTreeItem,
  MemoryTreeProvider,
  resolveDropTargetScope,
} from '../../src/memoryTreeProvider';
import { MemoryNode, MemoryScope } from '../../src/types';

suite('memoryTreeProvider drag', () => {
  test('resolveDropTargetScope returns undefined without a valid target', () => {
    assert.strictEqual(resolveDropTargetScope(undefined), undefined);
  });

  test('resolveDropTargetScope uses section scope', () => {
    const item = new MemoryTreeItem(
      undefined,
      'copilotUser',
      'Global Memory',
      vscode.TreeItemCollapsibleState.Collapsed,
      'copilotUserSection'
    );

    assert.strictEqual(resolveDropTargetScope(item), 'copilotUser');
  });

  test('handleDrop calls moveNodeToScope for cross-scope drag', async () => {
    const node: MemoryNode = {
      kind: 'file',
      scope: 'copilotRepo',
      name: 'rules.md',
      relativePath: 'rules.md',
      filePath: '/tmp/copilot/rules.md',
      format: 'markdown',
    };

    const target = new MemoryTreeItem(
      undefined,
      'copilotUser',
      'Global Memory',
      vscode.TreeItemCollapsibleState.Collapsed,
      'copilotUserSection'
    );

    const calls: Array<{
      node: MemoryNode;
      toScope: MemoryScope;
      targetFolder?: string;
      move: boolean;
    }> = [];

    const manager = {
      moveNode: async () => {
        throw new Error('same-scope move should not run');
      },
      moveNodeToScope: async (
        dragged: MemoryNode,
        toScope: MemoryScope,
        targetFolderRelative?: string,
        move = true
      ) => {
        calls.push({
          node: dragged,
          toScope,
          targetFolder: targetFolderRelative,
          move,
        });
        return dragged;
      },
      listChildren: async () => [],
      reorderSiblings: async () => undefined,
      isDescendantPath: () => false,
      invalidateExternalCache: () => undefined,
    } as unknown as MemoryManager;

    const provider = new MemoryTreeProvider(manager);
    const transfer = new vscode.DataTransfer();
    transfer.set(
      'application/vnd.code.tree.nemo',
      new vscode.DataTransferItem([node])
    );

    await provider.handleDrop(target, transfer);

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0]?.toScope, 'copilotUser');
    assert.strictEqual(calls[0]?.move, true);
    assert.strictEqual(calls[0]?.node.scope, 'copilotRepo');
  });
});
