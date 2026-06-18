import * as vscode from 'vscode';
import { isCopilotScope, scopeSupportsStyles } from './copilotMemoryPaths';
import { i18n } from './i18n';
import { injectFolderIntoChat, injectMemoryIntoChat } from './chatIntegration';
import { importCandidates } from './memoryImport';
import {
  buildImportCandidateForPath,
  scanImportCandidates,
  ImportCandidate,
} from './memoryImportScan';
import { FolderMeta } from './memoryManifest';
import { MemoryManager } from './memoryManager';
import { getDefaultIconForNode, pickNodeStyle } from './nodeStyle';
import { promoteToGit, syncToCopilotRepo } from './memorySync';
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
import { ImportTarget, isMemoryFile, isMemoryFolder } from './types';

interface ImportPickItem extends vscode.QuickPickItem {
  candidate: ImportCandidate;
}

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
      if (event.affectsConfiguration('nemo.sharedPath')) {
        refresh();
      }
    }),
    vscode.commands.registerCommand('nemo.refresh', refresh),
    vscode.commands.registerCommand('nemo.openSharedFolder', async () => {
      const sharedRoot = manager.getSharedGitDir();
      if (!sharedRoot) {
        void vscode.window.showWarningMessage(i18n.warning.noWorkspace());
        return;
      }

      await manager.ensureScopeDir('sharedGit');
      const uri = vscode.Uri.file(sharedRoot);
      await vscode.commands.executeCommand('revealInExplorer', uri);
    }),
    vscode.commands.registerCommand(
      'nemo.createFolder',
      async (item?: MemoryTreeItem) => {
        const scope = getScopeFromItem(item);
        if (scope === 'external') {
          void vscode.window.showWarningMessage(i18n.error.externalReadOnly());
          return;
        }
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
        if (scope === 'external') {
          void vscode.window.showWarningMessage(i18n.error.externalReadOnly());
          return;
        }
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

        let format: 'markdown' | 'json' = 'markdown';
        if (scope === 'sharedGit') {
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
          format = formatPick.value;
        }

        try {
          const created = await manager.createMemory(
            scope,
            name.trim(),
            format,
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
          void vscode.window.showWarningMessage(i18n.warning.selectTreeItem());
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
          void vscode.window.showWarningMessage(i18n.warning.selectTreeItem());
          return;
        }

        try {
          await injectMemoryIntoChat(manager, node);
        } catch (error) {
          showError(i18n.error.injectMemory(), error);
        }
      }
    ),
    vscode.commands.registerCommand(
      'nemo.injectFolder',
      async (item?: MemoryTreeItem) => {
        const node = resolveFolderNode(treeView, item);
        if (!node || !isMemoryFolder(node)) {
          void vscode.window.showWarningMessage(i18n.warning.selectTreeItem());
          return;
        }

        try {
          await injectFolderIntoChat(manager, node);
        } catch (error) {
          showError(i18n.error.injectFolder(), error);
        }
      }
    ),
    vscode.commands.registerCommand(
      'nemo.syncToCopilotRepo',
      async (item?: MemoryTreeItem) => {
        const node = resolveAnyNode(treeView, item);
        if (!node || node.scope !== 'sharedGit') {
          void vscode.window.showWarningMessage(
            i18n.warning.selectSharedGitToSync()
          );
          return;
        }

        const copyLabel = i18n.command.copy();
        const confirm = await vscode.window.showWarningMessage(
          i18n.warning.confirmSyncToCopilot(node.relativePath),
          { modal: true },
          copyLabel
        );

        if (confirm !== copyLabel) {
          return;
        }

        try {
          await syncToCopilotRepo(manager, node, false);
          refresh();
          void vscode.window.showInformationMessage(i18n.info.syncedToCopilot());
        } catch (error) {
          showError(i18n.error.syncToCopilotRepo(), error);
        }
      }
    ),
    vscode.commands.registerCommand(
      'nemo.promoteToGit',
      async (item?: MemoryTreeItem) => {
        const node = resolveAnyNode(treeView, item);
        if (!node || !isCopilotScope(node.scope)) {
          void vscode.window.showWarningMessage(
            i18n.warning.selectCopilotToPromote()
          );
          return;
        }

        const copyLabel = i18n.command.copy();
        const confirm = await vscode.window.showWarningMessage(
          i18n.warning.confirmPromoteToGit(node.relativePath),
          { modal: true },
          copyLabel
        );

        if (confirm !== copyLabel) {
          return;
        }

        try {
          await promoteToGit(manager, node, false);
          refresh();
          void vscode.window.showInformationMessage(i18n.info.promotedToGit());
        } catch (error) {
          showError(i18n.error.promoteToGit(), error);
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

        if (!scopeSupportsStyles(resolved.node.scope)) {
          void vscode.window.showWarningMessage(
            i18n.error.stylesUnsupportedScope()
          );
          return;
        }

        const manifest = await manager.getManifest(resolved.node.scope);
        if (!manifest) {
          return;
        }

        const isFolder = isMemoryFolder(resolved.node);
        const meta = isFolder
          ? manager.getFolderMetaForNode(
              resolved.node.relativePath,
              manifest,
              resolved.node.scope
            )
          : manager.getFileMetaForNode(
              resolved.node.relativePath,
              manifest,
              resolved.node.scope
            );
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

        let folderStyle: Partial<FolderMeta> = { ...style };
        if (isFolder) {
          const folderMeta = meta as FolderMeta;
          const labelInput = await vscode.window.showInputBox({
            prompt: i18n.prompt.folderDisplayLabel(),
            value: folderMeta.label ?? resolved.node.name,
          });

          if (labelInput !== undefined) {
            const trimmed = labelInput.trim();
            if (trimmed && trimmed !== resolved.node.name) {
              folderStyle = { ...folderStyle, label: trimmed };
            } else {
              folderStyle = { ...folderStyle, label: undefined };
            }
          }
        }

        try {
          if (isFolder) {
            await manager.setFolderStyle(
              resolved.node.scope,
              resolved.node.relativePath,
              folderStyle
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
    ),
    vscode.commands.registerCommand('nemo.importContext', async () => {
      const targetPick = await vscode.window.showQuickPick(
        [
          {
            label: i18n.zones.copilotRepo(),
            detail: i18n.zones.copilotRepoPath(),
            value: 'copilotRepo' as ImportTarget,
          },
          {
            label: i18n.zones.sharedGit(),
            value: 'sharedGit' as ImportTarget,
          },
          {
            label: i18n.zones.bothTargets(),
            detail: `${i18n.zones.copilotRepoPath()} + ${manager.getConfig().sharedPath}`,
            value: 'both' as ImportTarget,
          },
        ],
        { placeHolder: i18n.import.targetTitle() }
      );

      if (!targetPick) {
        return;
      }

      const candidates = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: i18n.import.scanning(),
        },
        () => scanImportCandidates(manager, targetPick.value)
      );

      if (candidates.length === 0) {
        void vscode.window.showInformationMessage(i18n.import.noneFound());
        return;
      }

      const pickItems: ImportPickItem[] = candidates.map((candidate) => ({
        label: candidate.label,
        description: candidate.description,
        detail: candidate.conflict
          ? `${candidate.workspaceRelative} — ${i18n.import.conflictSuffix()}`
          : candidate.workspaceRelative,
        picked: !candidate.conflict,
        candidate,
      }));

      const selected = await vscode.window.showQuickPick(pickItems, {
        canPickMany: true,
        matchOnDescription: true,
        matchOnDetail: true,
        placeHolder: i18n.import.pickTitle(),
      });

      if (!selected || selected.length === 0) {
        void vscode.window.showInformationMessage(i18n.import.nothingSelected());
        return;
      }

      const moveLabel = i18n.command.move();
      const confirm = await vscode.window.showWarningMessage(
        i18n.import.confirmMove(selected.length, targetPick.label),
        { modal: true },
        moveLabel
      );

      if (confirm !== moveLabel) {
        return;
      }

      try {
        const result = await importCandidates(
          manager,
          selected.map((item) => item.candidate),
          targetPick.value
        );
        refresh();
        void vscode.window.showInformationMessage(
          i18n.import.done(result.moved.length, result.skipped.length)
        );
      } catch (error) {
        showError(i18n.error.importContext(), error);
      }
    }),
    vscode.commands.registerCommand(
      'nemo.importExternalFile',
      async (item?: MemoryTreeItem) => {
        const node = resolveFileNode(treeView, item);
        if (!node || node.scope !== 'external') {
          if (!node) {
            void vscode.window.showWarningMessage(i18n.warning.selectTreeItem());
          }
          return;
        }

        const candidate = await buildImportCandidateForPath(
          manager,
          node.relativePath
        );
        if (!candidate) {
          void vscode.window.showWarningMessage(i18n.warning.noWorkspace());
          return;
        }

        const targetPick = await vscode.window.showQuickPick(
          [
            {
              label: i18n.zones.copilotRepo(),
              detail: i18n.zones.copilotRepoPath(),
              value: 'copilotRepo' as ImportTarget,
            },
            {
              label: i18n.zones.sharedGit(),
              value: 'sharedGit' as ImportTarget,
            },
            {
              label: i18n.zones.bothTargets(),
              detail: `${i18n.zones.copilotRepoPath()} + ${manager.getConfig().sharedPath}`,
              value: 'both' as ImportTarget,
            },
          ],
          { placeHolder: i18n.import.targetTitle() }
        );

        if (!targetPick) {
          return;
        }

        const moveLabel = i18n.command.move();
        const confirm = await vscode.window.showWarningMessage(
          i18n.import.confirmMove(1, targetPick.label),
          { modal: true },
          moveLabel
        );

        if (confirm !== moveLabel) {
          return;
        }

        try {
          const result = await importCandidates(
            manager,
            [candidate],
            targetPick.value
          );
          refresh();
          void vscode.window.showInformationMessage(
            i18n.import.done(result.moved.length, result.skipped.length)
          );
        } catch (error) {
          showError(i18n.error.importContext(), error);
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
