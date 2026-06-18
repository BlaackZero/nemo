import * as vscode from 'vscode';
import { i18n } from './i18n';
import { injectMemoryIntoChat } from './chatIntegration';
import { getFileMeta, getFolderMeta } from './memoryManifest';
import { MemoryManager } from './memoryManager';
import { getDefaultIconForNode, pickNodeStyle } from './nodeStyle';
import { shareToRepo, unshareFromRepo } from './memorySync';
import {
  getParentFolderRelativeFromItem,
  getScopeFromItem,
  MemoryTreeItem,
  MemoryTreeProvider,
  resolveAnyNode,
  resolveFileNode,
  resolveFolderNode,
  resolveTreeItem,
} from './memoryTreeProvider';
import { isMemoryFile, isMemoryFolder } from './types';

export function activate(context: vscode.ExtensionContext): void {
  const manager = new MemoryManager(context);
  const treeProvider = new MemoryTreeProvider(manager);

  const treeView = vscode.window.createTreeView('nemo.memories', {
    treeDataProvider: treeProvider,
    dragAndDropController: treeProvider,
    showCollapseAll: true,
  });

  const refresh = (): void => {
    treeProvider.refresh();
  };

  context.subscriptions.push(
    treeView,
    vscode.workspace.onDidChangeWorkspaceFolders(refresh),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration('nemo.storageLocation') ||
        event.affectsConfiguration('nemo.repoIdStrategy') ||
        event.affectsConfiguration('nemo.sharedPath')
      ) {
        refresh();
      }
    }),
    vscode.commands.registerCommand('nemo.refresh', refresh),
    vscode.commands.registerCommand('nemo.openSharedFolder', async () => {
      const sharedRoot = manager.getSharedMemoryDir();
      if (!sharedRoot) {
        void vscode.window.showWarningMessage(i18n.warning.noWorkspace());
        return;
      }

      await manager.ensureScopeDir('shared');
      const uri = vscode.Uri.file(sharedRoot);
      await vscode.commands.executeCommand('revealInExplorer', uri);
    }),
    vscode.commands.registerCommand(
      'nemo.createFolder',
      async (item?: MemoryTreeItem) => {
        const scope = getScopeFromItem(item);
        const parentRelative = getParentFolderRelativeFromItem(item);
        const name = await vscode.window.showInputBox({
          prompt: i18n.prompt.folderName(),
          placeHolder: i18n.prompt.folderNamePlaceholder(),
          validateInput: (value) =>
            value.trim() ? undefined : i18n.prompt.nameRequired(),
        });

        if (!name) {
          return;
        }

        try {
          await manager.createFolder(scope, name.trim(), parentRelative);
          refresh();
        } catch (error) {
          showError(i18n.error.createFolder(), error);
        }
      }
    ),
    vscode.commands.registerCommand(
      'nemo.createMemory',
      async (item?: MemoryTreeItem) => {
        const scope = getScopeFromItem(item);
        const parentRelative = getParentFolderRelativeFromItem(item);
        const name = await vscode.window.showInputBox({
          prompt: i18n.prompt.memoryName(),
          placeHolder: i18n.prompt.memoryNamePlaceholder(),
          validateInput: (value) =>
            value.trim() ? undefined : i18n.prompt.nameRequired(),
        });

        if (!name) {
          return;
        }

        const formatPick = await vscode.window.showQuickPick(
          [
            {
              label: i18n.command.formatMarkdown(),
              value: 'markdown' as const,
            },
            { label: i18n.command.formatJson(), value: 'json' as const },
          ],
          { placeHolder: i18n.prompt.fileFormat() }
        );

        if (!formatPick) {
          return;
        }

        try {
          const created = await manager.createMemory(
            scope,
            name.trim(),
            formatPick.value,
            parentRelative
          );
          refresh();
          const document = await vscode.workspace.openTextDocument(
            created.filePath
          );
          await vscode.window.showTextDocument(document, { preview: false });
        } catch (error) {
          showError(i18n.error.createMemory(), error);
        }
      }
    ),
    vscode.commands.registerCommand(
      'nemo.editMemory',
      async (item?: MemoryTreeItem) => {
        const node = resolveFileNode(treeView, item);
        if (!node || !isMemoryFile(node)) {
          return;
        }

        const document = await vscode.workspace.openTextDocument(node.filePath);
        await vscode.window.showTextDocument(document, { preview: false });
      }
    ),
    vscode.commands.registerCommand(
      'nemo.injectMemory',
      async (item?: MemoryTreeItem) => {
        const node = resolveFileNode(treeView, item);
        if (!node || !isMemoryFile(node)) {
          return;
        }

        await injectMemoryIntoChat(manager, node);
      }
    ),
    vscode.commands.registerCommand(
      'nemo.shareToRepo',
      async (item?: MemoryTreeItem) => {
        const node = resolveAnyNode(treeView, item);
        if (!node || node.scope !== 'personal') {
          void vscode.window.showWarningMessage(
            i18n.warning.selectPersonalToShare()
          );
          return;
        }

        const moveLabel = i18n.command.move();
        const confirm = await vscode.window.showWarningMessage(
          i18n.warning.confirmShare(node.relativePath),
          { modal: true },
          moveLabel
        );

        if (confirm !== moveLabel) {
          return;
        }

        try {
          await shareToRepo(manager, node);
          refresh();
          void vscode.window.showInformationMessage(i18n.info.sharedMoved());
        } catch (error) {
          showError(i18n.error.shareToRepo(), error);
        }
      }
    ),
    vscode.commands.registerCommand(
      'nemo.unshareFromRepo',
      async (item?: MemoryTreeItem) => {
        const node = resolveAnyNode(treeView, item);
        if (!node || node.scope !== 'shared') {
          void vscode.window.showWarningMessage(
            i18n.warning.selectSharedToUnshare()
          );
          return;
        }

        const moveLabel = i18n.command.move();
        const confirm = await vscode.window.showWarningMessage(
          i18n.warning.confirmUnshare(node.relativePath),
          { modal: true },
          moveLabel
        );

        if (confirm !== moveLabel) {
          return;
        }

        try {
          await unshareFromRepo(manager, node);
          refresh();
          void vscode.window.showInformationMessage(i18n.info.personalMoved());
        } catch (error) {
          showError(i18n.error.unshareFromRepo(), error);
        }
      }
    ),
    vscode.commands.registerCommand(
      'nemo.deleteMemory',
      async (item?: MemoryTreeItem) => {
        const node = resolveFileNode(treeView, item);
        if (!node || !isMemoryFile(node)) {
          return;
        }

        const deleteLabel = i18n.command.delete();
        const confirm = await vscode.window.showWarningMessage(
          i18n.warning.confirmDeleteMemory(node.name),
          { modal: true },
          deleteLabel
        );

        if (confirm !== deleteLabel) {
          return;
        }

        try {
          await manager.deleteMemory(
            node.scope,
            node.filePath,
            node.relativePath
          );
          refresh();
        } catch (error) {
          showError(i18n.error.deleteMemory(), error);
        }
      }
    ),
    vscode.commands.registerCommand(
      'nemo.deleteFolder',
      async (item?: MemoryTreeItem) => {
        const node = resolveFolderNode(treeView, item);
        if (!node || !isMemoryFolder(node)) {
          return;
        }

        const deleteLabel = i18n.command.delete();
        const confirm = await vscode.window.showWarningMessage(
          i18n.warning.confirmDeleteFolder(node.name),
          { modal: true },
          deleteLabel
        );

        if (confirm !== deleteLabel) {
          return;
        }

        try {
          await manager.deleteFolder(node.scope, node.relativePath);
          refresh();
        } catch (error) {
          showError(i18n.error.deleteFolder(), error);
        }
      }
    ),
    vscode.commands.registerCommand(
      'nemo.renameNode',
      async (item?: MemoryTreeItem) => {
        const resolved = resolveTreeItem(treeView, item);
        if (!resolved?.node) {
          return;
        }

        const currentName = isMemoryFolder(resolved.node)
          ? resolved.node.name
          : resolved.node.name.replace(/\.(md|json)$/i, '');

        const newName = await vscode.window.showInputBox({
          prompt: i18n.prompt.newName(),
          value: currentName,
          validateInput: (value) =>
            value.trim() ? undefined : i18n.prompt.nameRequired(),
        });

        if (!newName || newName.trim() === currentName) {
          return;
        }

        try {
          await manager.renameNode(
            resolved.node.scope,
            resolved.node.relativePath,
            newName.trim(),
            isMemoryFolder(resolved.node)
          );
          refresh();
        } catch (error) {
          showError(i18n.error.rename(), error);
        }
      }
    ),
    vscode.commands.registerCommand(
      'nemo.setNodeStyle',
      async (item?: MemoryTreeItem) => {
        const resolved = resolveTreeItem(treeView, item);
        if (!resolved?.node) {
          return;
        }

        const manifest = await manager.getManifest(resolved.node.scope);
        if (!manifest) {
          return;
        }

        const isFolder = isMemoryFolder(resolved.node);
        const meta = isFolder
          ? getFolderMeta(manifest, resolved.node.relativePath)
          : getFileMeta(manifest, resolved.node.relativePath);
        const fallbackIcon = getDefaultIconForNode(
          isFolder,
          isMemoryFile(resolved.node) ? resolved.node.format : undefined
        );

        const style = await pickNodeStyle(
          { icon: meta.icon, color: meta.color },
          fallbackIcon
        );

        if (!style) {
          return;
        }

        try {
          if (isFolder) {
            await manager.setFolderStyle(
              resolved.node.scope,
              resolved.node.relativePath,
              style
            );
          } else {
            await manager.setFileStyle(
              resolved.node.scope,
              resolved.node.relativePath,
              style
            );
          }
          refresh();
        } catch (error) {
          showError(i18n.error.setStyle(), error);
        }
      }
    )
  );

  refresh();
}

function showError(action: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  void vscode.window.showErrorMessage(
    i18n.error.actionFailed(action, message)
  );
}

export function deactivate(): void {}
