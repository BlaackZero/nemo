import * as vscode from 'vscode';
import { MemoryManager } from './memoryManager';
import { MemoryFile } from './types';

export class MemoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly memory: MemoryFile | undefined,
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    contextValue: string
  ) {
    super(label, collapsibleState);

    this.contextValue = contextValue;

    if (memory) {
      this.tooltip = memory.filePath;
      this.iconPath =
        memory.format === 'json'
          ? new vscode.ThemeIcon('json')
          : new vscode.ThemeIcon('markdown');
      this.command = {
        command: 'repoMemory.editMemory',
        title: 'Editar memoria',
        arguments: [this],
      };
    } else if (contextValue === 'repoHeader') {
      this.iconPath = new vscode.ThemeIcon('repo');
    } else {
      this.iconPath = new vscode.ThemeIcon('info');
    }
  }
}

export class MemoryTreeProvider
  implements vscode.TreeDataProvider<MemoryTreeItem>
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    MemoryTreeItem | undefined | void
  >();

  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly manager: MemoryManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: MemoryTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: MemoryTreeItem): Promise<MemoryTreeItem[]> {
    if (element) {
      return [];
    }

    const identity = this.manager.getCurrentRepoIdentity();
    if (!identity) {
      return [
        new MemoryTreeItem(
          undefined,
          'Abre una carpeta de workspace',
          vscode.TreeItemCollapsibleState.None,
          'emptyState'
        ),
      ];
    }

    const memories = await this.manager.listMemories();
    const header = new MemoryTreeItem(
      undefined,
      identity.displayName,
      vscode.TreeItemCollapsibleState.Expanded,
      'repoHeader'
    );
    header.description = identity.repoId;

    if (memories.length === 0) {
      return [
        header,
        new MemoryTreeItem(
          undefined,
          'Sin memorias — usa + para crear',
          vscode.TreeItemCollapsibleState.None,
          'emptyState'
        ),
      ];
    }

    return [
      header,
      ...memories.map(
        (memory) =>
          new MemoryTreeItem(
            memory,
            memory.name,
            vscode.TreeItemCollapsibleState.None,
            'memoryFile'
          )
      ),
    ];
  }
}
