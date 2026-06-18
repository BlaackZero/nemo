import * as path from 'path';
import * as vscode from 'vscode';
import { i18n } from './i18n';
import { MemoryManager, getParentRelativePath } from './memoryManager';
import { getDefaultIconForNode, resolveNodeIcon } from './nodeStyle';
import { shareToRepo, unshareFromRepo } from './memorySync';
import { isMemoryFile, isMemoryFolder, MemoryNode, MemoryScope } from './types';

const TREE_MIME = 'application/vnd.code.tree.nemo';

function contextValueForFolder(scope: MemoryScope): string {
  return scope === 'shared' ? 'sharedMemoryFolder' : 'personalMemoryFolder';
}

function contextValueForFile(scope: MemoryScope): string {
  return scope === 'shared' ? 'sharedMemoryFile' : 'personalMemoryFile';
}

export class MemoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly node: MemoryNode | undefined,
    public readonly sectionScope: MemoryScope | undefined,
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    contextValue: string,
    options?: {
      description?: string;
      iconPath?: vscode.IconPath;
      tooltip?: string;
    }
  ) {
    super(label, collapsibleState);

    this.contextValue = contextValue;

    if (options?.description) {
      this.description = options.description;
    }

    if (options?.tooltip) {
      this.tooltip = options.tooltip;
    }

    if (options?.iconPath) {
      this.iconPath = options.iconPath;
    }

    if (node && isMemoryFile(node)) {
      this.tooltip = node.filePath;
      this.command = {
        command: 'nemo.editMemory',
        title: i18n.tree.editMemoryTitle(),
        arguments: [this],
      };
    } else if (contextValue === 'sharedSection') {
      this.iconPath = new vscode.ThemeIcon('repo');
    } else if (contextValue === 'personalSection') {
      this.iconPath = new vscode.ThemeIcon('person');
    } else if (contextValue === 'emptyState') {
      this.iconPath = new vscode.ThemeIcon('info');
    }
  }
}

export class MemoryTreeProvider
  implements
    vscode.TreeDataProvider<MemoryTreeItem>,
    vscode.TreeDragAndDropController<MemoryTreeItem>
{
  dropMimeTypes = [TREE_MIME];
  dragMimeTypes = [TREE_MIME];

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

  getParent(element: MemoryTreeItem): vscode.ProviderResult<MemoryTreeItem> {
    if (element.sectionScope && !element.node) {
      return undefined;
    }

    if (!element.node) {
      return undefined;
    }

    const parentRelative = getParentRelativePath(element.node.relativePath);
    if (!parentRelative) {
      return createSectionItem(element.node.scope);
    }

    const parentName = path.posix.basename(parentRelative);
    const scope = element.node.scope;

    return new MemoryTreeItem(
      {
        kind: 'folder',
        scope,
        name: parentName,
        relativePath: parentRelative,
        absolutePath:
          this.manager.resolveAbsolutePath(scope, parentRelative) ?? '',
      },
      undefined,
      parentName,
      vscode.TreeItemCollapsibleState.Collapsed,
      contextValueForFolder(scope)
    );
  }

  async getChildren(element?: MemoryTreeItem): Promise<MemoryTreeItem[]> {
    if (element?.node && isMemoryFile(element.node)) {
      return [];
    }

    const identity = this.manager.getCurrentRepoIdentity();
    if (!identity && !element) {
      return [
        new MemoryTreeItem(
          undefined,
          undefined,
          i18n.tree.noWorkspace(),
          vscode.TreeItemCollapsibleState.None,
          'emptyState'
        ),
      ];
    }

    if (!element) {
      return [createSectionItem('shared'), createSectionItem('personal')];
    }

    if (element.sectionScope && !element.node) {
      return this.buildSectionChildren(element.sectionScope);
    }

    if (element.node && isMemoryFolder(element.node)) {
      const children = await this.manager.listChildren(
        element.node.scope,
        element.node.relativePath
      );
      return this.buildTreeItems(children);
    }

    return [];
  }

  private async buildSectionChildren(
    scope: MemoryScope
  ): Promise<MemoryTreeItem[]> {
    const children = await this.manager.listChildren(scope);

    if (children.length === 0) {
      return [
        new MemoryTreeItem(
          undefined,
          scope,
          scope === 'shared'
            ? i18n.tree.emptyShared()
            : i18n.tree.emptyPersonal(),
          vscode.TreeItemCollapsibleState.None,
          'emptyState'
        ),
      ];
    }

    return this.buildTreeItems(children);
  }

  private async buildTreeItems(nodes: MemoryNode[]): Promise<MemoryTreeItem[]> {
    if (nodes.length === 0) {
      return [];
    }

    const scope = nodes[0]?.scope ?? 'personal';
    const manifest = await this.manager.getManifest(scope);
    if (!manifest) {
      return [];
    }

    return nodes.map((node) => {
      if (isMemoryFolder(node)) {
        const meta = this.manager.getFolderMetaForNode(node.relativePath, manifest);
        const iconId = meta.icon ?? 'folder';
        const displayLabel = meta.label ?? node.name;
        const description =
          meta.label && meta.label !== node.name ? node.name : undefined;

        return new MemoryTreeItem(
          node,
          undefined,
          displayLabel,
          vscode.TreeItemCollapsibleState.Collapsed,
          contextValueForFolder(node.scope),
          {
            description,
            tooltip: node.relativePath,
            iconPath: resolveNodeIcon(iconId, meta.color, 'folder'),
          }
        );
      }

      const meta = this.manager.getFileMetaForNode(node.relativePath, manifest);
      const fallbackIcon = getDefaultIconForNode(false, node.format);

      return new MemoryTreeItem(
        node,
        undefined,
        node.name,
        vscode.TreeItemCollapsibleState.None,
        contextValueForFile(node.scope),
        {
          iconPath: resolveNodeIcon(meta.icon, meta.color, fallbackIcon),
        }
      );
    });
  }

  async handleDrag(
    source: readonly MemoryTreeItem[],
    dataTransfer: vscode.DataTransfer
  ): Promise<void> {
    const nodes = source
      .map((item) => item.node)
      .filter((node): node is MemoryNode => node !== undefined);

    if (nodes.length === 0) {
      return;
    }

    dataTransfer.set(TREE_MIME, new vscode.DataTransferItem(nodes));
  }

  async handleDrop(
    target: MemoryTreeItem | undefined,
    dataTransfer: vscode.DataTransfer
  ): Promise<void> {
    const transfer = dataTransfer.get(TREE_MIME);
    if (!transfer) {
      return;
    }

    const nodes = transfer.value as MemoryNode[];
    if (!Array.isArray(nodes) || nodes.length === 0) {
      return;
    }

    const targetScope = resolveScopeFromItem(target);
    const targetFolderRelative = resolveTargetFolderRelative(target);
    let reorderScope: MemoryScope | undefined;
    let reorderParent: string | undefined;

    for (const node of nodes) {
      if (node.scope !== targetScope) {
        if (node.scope === 'personal' && targetScope === 'shared') {
          await shareToRepo(this.manager, node);
        } else if (node.scope === 'shared' && targetScope === 'personal') {
          await unshareFromRepo(this.manager, node);
        }
        continue;
      }

      if (
        isMemoryFolder(node) &&
        targetFolderRelative &&
        this.manager.isDescendantPath(node.relativePath, targetFolderRelative)
      ) {
        continue;
      }

      await this.manager.moveNode(
        node.scope,
        node.relativePath,
        targetFolderRelative,
        isMemoryFolder(node)
      );

      reorderScope = node.scope;
      reorderParent =
        target?.node && isMemoryFile(target.node)
          ? getParentRelativePath(target.node.relativePath)
          : targetFolderRelative;
    }

    if (reorderScope !== undefined) {
      const siblings = await this.manager.listChildren(reorderScope, reorderParent);
      const folders = siblings.filter(isMemoryFolder).map((f) => f.relativePath);
      const files = siblings.filter(isMemoryFile).map((f) => f.relativePath);
      await this.manager.reorderSiblings(reorderScope, reorderParent, folders, 'folder');
      await this.manager.reorderSiblings(reorderScope, reorderParent, files, 'file');
    }

    this.refresh();
  }
}

function createSectionItem(scope: MemoryScope): MemoryTreeItem {
  return new MemoryTreeItem(
    undefined,
    scope,
    scope === 'shared' ? i18n.tree.sharedSection() : i18n.tree.personalSection(),
    vscode.TreeItemCollapsibleState.Collapsed,
    scope === 'shared' ? 'sharedSection' : 'personalSection'
  );
}

export function resolveScopeFromItem(item?: MemoryTreeItem): MemoryScope {
  if (item?.node) {
    return item.node.scope;
  }

  if (item?.sectionScope) {
    return item.sectionScope;
  }

  return 'personal';
}

function resolveTargetFolderRelative(
  target: MemoryTreeItem | undefined
): string | undefined {
  if (!target) {
    return undefined;
  }

  if (target.sectionScope && !target.node) {
    return undefined;
  }

  if (target.node && isMemoryFolder(target.node)) {
    return target.node.relativePath;
  }

  if (target.node && isMemoryFile(target.node)) {
    return getParentRelativePath(target.node.relativePath);
  }

  return undefined;
}

export function resolveTreeItem(
  treeView: vscode.TreeView<MemoryTreeItem>,
  item?: MemoryTreeItem
): MemoryTreeItem | undefined {
  if (item?.node || item?.sectionScope) {
    return item;
  }

  return treeView.selection.find(
    (selected) => selected.node !== undefined || selected.sectionScope !== undefined
  );
}

export function resolveFileNode(
  treeView: vscode.TreeView<MemoryTreeItem>,
  item?: MemoryTreeItem
): MemoryNode | undefined {
  const resolved = resolveTreeItem(treeView, item);
  if (resolved?.node && isMemoryFile(resolved.node)) {
    return resolved.node;
  }

  return undefined;
}

export function resolveFolderNode(
  treeView: vscode.TreeView<MemoryTreeItem>,
  item?: MemoryTreeItem
): MemoryNode | undefined {
  const resolved = resolveTreeItem(treeView, item);
  if (resolved?.node && isMemoryFolder(resolved.node)) {
    return resolved.node;
  }

  return undefined;
}

export function resolveAnyNode(
  treeView: vscode.TreeView<MemoryTreeItem>,
  item?: MemoryTreeItem
): MemoryNode | undefined {
  const resolved = resolveTreeItem(treeView, item);
  return resolved?.node;
}

export function getParentFolderRelativeFromItem(
  item?: MemoryTreeItem
): string | undefined {
  if (!item?.node) {
    return undefined;
  }

  if (isMemoryFolder(item.node)) {
    return item.node.relativePath;
  }

  return getParentRelativePath(item.node.relativePath);
}

export function getScopeFromItem(item?: MemoryTreeItem): MemoryScope {
  return resolveScopeFromItem(item);
}
