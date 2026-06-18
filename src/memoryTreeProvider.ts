import * as path from 'path';
import * as vscode from 'vscode';
import { isCopilotChatInstalled, scopeSupportsStyles } from './copilotMemoryPaths';
import { i18n } from './i18n';
import { MemoryManager, getParentRelativePath } from './memoryManager';
import { getDefaultIconForNode, resolveNodeIcon } from './nodeStyle';
import { isMemoryFile, isMemoryFolder, MemoryNode, MemoryScope } from './types';

const TREE_MIME = 'application/vnd.code.tree.nemo';

const SECTION_ORDER: MemoryScope[] = [
  'copilotRepo',
  'copilotUser',
  'sharedGit',
  'external',
];

function contextValueForFolder(scope: MemoryScope): string {
  switch (scope) {
    case 'copilotRepo':
      return 'copilotRepoMemoryFolder';
    case 'copilotUser':
      return 'copilotUserMemoryFolder';
    case 'sharedGit':
      return 'sharedGitMemoryFolder';
    case 'external':
      return 'externalMemoryFolder';
  }
}

function contextValueForFile(scope: MemoryScope): string {
  switch (scope) {
    case 'copilotRepo':
      return 'copilotRepoMemoryFile';
    case 'copilotUser':
      return 'copilotUserMemoryFile';
    case 'sharedGit':
      return 'sharedGitMemoryFile';
    case 'external':
      return 'externalMemoryFile';
  }
}

function contextValueForSection(scope: MemoryScope): string {
  switch (scope) {
    case 'copilotRepo':
      return 'copilotRepoSection';
    case 'copilotUser':
      return 'copilotUserSection';
    case 'sharedGit':
      return 'sharedGitSection';
    case 'external':
      return 'externalSection';
  }
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
      this.command = {
        command: 'nemo.editMemory',
        title: i18n.tree.editMemoryTitle(),
        arguments: [this],
      };
    } else if (contextValue === 'copilotRepoSection') {
      this.iconPath = new vscode.ThemeIcon('repo');
    } else if (contextValue === 'copilotUserSection') {
      this.iconPath = new vscode.ThemeIcon('person');
    } else if (contextValue === 'sharedGitSection') {
      this.iconPath = new vscode.ThemeIcon('source-control');
    } else if (contextValue === 'externalSection') {
      this.iconPath = new vscode.ThemeIcon('file-symlink-file');
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
    this.manager.invalidateExternalCache();
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

    if (!element) {
      const hasWorkspace = !!vscode.workspace.workspaceFolders?.length;
      const hasCopilotStorage = !!this.manager.getRootForScope('copilotUser');
      if (!hasWorkspace && !hasCopilotStorage) {
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

      return SECTION_ORDER.map((scope) => createSectionItem(scope));
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

    if (
      children.length === 0 &&
      (scope === 'copilotRepo' || scope === 'copilotUser') &&
      !isCopilotChatInstalled()
    ) {
      return [
        new MemoryTreeItem(
          undefined,
          scope,
          i18n.tree.copilotNotInstalled(),
          vscode.TreeItemCollapsibleState.None,
          'emptyState',
          {
            tooltip: i18n.tree.copilotInstallHint(),
          }
        ),
      ];
    }

    if (children.length === 0) {
      return [
        new MemoryTreeItem(
          undefined,
          scope,
          emptyMessageForScope(scope),
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

    const scope = nodes[0]?.scope ?? 'copilotRepo';
    const manifest = scopeSupportsStyles(scope)
      ? await this.manager.getManifest(scope)
      : undefined;
    const usesStyles = scopeSupportsStyles(scope) && manifest !== undefined;

    return nodes.map((node) => {
      const virtualPath = this.manager.getVirtualPath(
        node.scope,
        node.relativePath
      );
      const absolutePath = isMemoryFile(node) ? node.filePath : node.absolutePath;
      const tooltip = `${virtualPath}\n${absolutePath}`;

      if (isMemoryFolder(node)) {
        if (usesStyles && manifest) {
          const meta = this.manager.getFolderMetaForNode(
            node.relativePath,
            manifest,
            node.scope
          );
          const iconId = meta.icon ?? 'folder';
          const displayLabel = meta.label ?? node.name;
          const description =
            meta.label && meta.label !== node.name ? node.name : virtualPath;

          return new MemoryTreeItem(
            node,
            undefined,
            displayLabel,
            vscode.TreeItemCollapsibleState.Collapsed,
            contextValueForFolder(node.scope),
            {
              description,
              tooltip,
              iconPath: resolveNodeIcon(iconId, meta.color, 'folder'),
            }
          );
        }

        return new MemoryTreeItem(
          node,
          undefined,
          node.name,
          vscode.TreeItemCollapsibleState.Collapsed,
          contextValueForFolder(node.scope),
          {
            description: virtualPath,
            tooltip,
            iconPath: new vscode.ThemeIcon('folder'),
          }
        );
      }

      if (usesStyles && manifest) {
        const meta = this.manager.getFileMetaForNode(
          node.relativePath,
          manifest,
          node.scope
        );
        const fallbackIcon = getDefaultIconForNode(false, node.format);

        return new MemoryTreeItem(
          node,
          undefined,
          node.name,
          vscode.TreeItemCollapsibleState.None,
          contextValueForFile(node.scope),
          {
            description: virtualPath,
            tooltip,
            iconPath: resolveNodeIcon(meta.icon, meta.color, fallbackIcon),
          }
        );
      }

      const fallbackIcon = getDefaultIconForNode(false, node.format);

      return new MemoryTreeItem(
        node,
        undefined,
        node.name,
        vscode.TreeItemCollapsibleState.None,
        contextValueForFile(node.scope),
        {
          description: virtualPath,
          tooltip,
          iconPath: new vscode.ThemeIcon(fallbackIcon),
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
      .filter(
        (node): node is MemoryNode =>
          node !== undefined && node.scope !== 'external'
      );

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

    const targetScope = resolveDropTargetScope(target);
    if (!targetScope || targetScope === 'external') {
      return;
    }

    const targetFolderRelative = resolveTargetFolderRelative(target);
    let reorderScope: MemoryScope | undefined;
    let reorderParent: string | undefined;

    try {
      for (const node of nodes) {
        if (node.scope === 'external') {
          continue;
        }

        if (node.scope !== targetScope) {
          if (
            isMemoryFolder(node) &&
            targetFolderRelative &&
            this.manager.isDescendantPath(node.relativePath, targetFolderRelative)
          ) {
            continue;
          }

          await this.manager.moveNodeToScope(
            node,
            targetScope,
            targetFolderRelative,
            true
          );
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(
        i18n.error.actionFailed(i18n.command.move(), message)
      );
    }

    if (reorderScope === 'sharedGit') {
      const siblings = await this.manager.listChildren(reorderScope, reorderParent);
      const folders = siblings.filter(isMemoryFolder).map((f) => f.relativePath);
      const files = siblings.filter(isMemoryFile).map((f) => f.relativePath);
      await this.manager.reorderSiblings(reorderScope, reorderParent, folders, 'folder');
      await this.manager.reorderSiblings(reorderScope, reorderParent, files, 'file');
    }

    this.refresh();
  }
}

function emptyMessageForScope(scope: MemoryScope): string {
  switch (scope) {
    case 'copilotRepo':
      return i18n.tree.emptyCopilotRepo();
    case 'copilotUser':
      return i18n.tree.emptyCopilotUser();
    case 'sharedGit':
      return i18n.tree.emptySharedGit();
    case 'external':
      return i18n.tree.emptyExternal();
  }
}

function createSectionItem(scope: MemoryScope): MemoryTreeItem {
  let label: string;
  switch (scope) {
    case 'copilotRepo':
      label = i18n.zones.copilotRepo();
      break;
    case 'copilotUser':
      label = i18n.zones.copilotUser();
      break;
    case 'sharedGit':
      label = i18n.zones.sharedGit();
      break;
    case 'external':
      label = i18n.zones.external();
      break;
  }

  return new MemoryTreeItem(
    undefined,
    scope,
    label,
    vscode.TreeItemCollapsibleState.Collapsed,
    contextValueForSection(scope)
  );
}

export function resolveScopeFromItem(item?: MemoryTreeItem): MemoryScope {
  if (item?.node) {
    return item.node.scope;
  }

  if (item?.sectionScope) {
    return item.sectionScope;
  }

  return 'copilotRepo';
}

export function resolveDropTargetScope(
  item?: MemoryTreeItem
): MemoryScope | undefined {
  if (item?.node) {
    return item.node.scope;
  }

  if (item?.sectionScope) {
    return item.sectionScope;
  }

  return undefined;
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
