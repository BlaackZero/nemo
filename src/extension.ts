import * as vscode from 'vscode';
import { injectMemoryIntoChat } from './chatIntegration';
import { MemoryManager } from './memoryManager';
import { MemoryTreeItem, MemoryTreeProvider } from './memoryTreeProvider';

export function activate(context: vscode.ExtensionContext): void {
  const manager = new MemoryManager(context);
  const treeProvider = new MemoryTreeProvider(manager);

  const treeView = vscode.window.createTreeView('repoMemory.memories', {
    treeDataProvider: treeProvider,
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
        event.affectsConfiguration('repoMemory.storageLocation') ||
        event.affectsConfiguration('repoMemory.repoIdStrategy')
      ) {
        refresh();
      }
    }),
    vscode.commands.registerCommand('repoMemory.refresh', refresh),
    vscode.commands.registerCommand('repoMemory.createMemory', async () => {
      const name = await vscode.window.showInputBox({
        prompt: 'Nombre de la memoria (sin extensión)',
        placeHolder: 'reglas-backend',
        validateInput: (value) =>
          value.trim() ? undefined : 'El nombre no puede estar vacío',
      });

      if (!name) {
        return;
      }

      const formatPick = await vscode.window.showQuickPick(
        [
          { label: 'Markdown (.md)', value: 'markdown' as const },
          { label: 'JSON (.json)', value: 'json' as const },
        ],
        { placeHolder: 'Formato del archivo' }
      );

      if (!formatPick) {
        return;
      }

      try {
        const created = await manager.createMemory(
          name.trim(),
          formatPick.value
        );
        refresh();
        const document = await vscode.workspace.openTextDocument(
          created.filePath
        );
        await vscode.window.showTextDocument(document, { preview: false });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(
          `No se pudo crear la memoria: ${message}`
        );
      }
    }),
    vscode.commands.registerCommand(
      'repoMemory.editMemory',
      async (item?: MemoryTreeItem) => {
        const memory = resolveMemoryItem(treeView, item);
        if (!memory) {
          return;
        }

        const document = await vscode.workspace.openTextDocument(
          memory.filePath
        );
        await vscode.window.showTextDocument(document, { preview: false });
      }
    ),
    vscode.commands.registerCommand(
      'repoMemory.injectMemory',
      async (item?: MemoryTreeItem) => {
        const memory = resolveMemoryItem(treeView, item);
        if (!memory) {
          return;
        }

        await injectMemoryIntoChat(manager, memory);
      }
    ),
    vscode.commands.registerCommand(
      'repoMemory.deleteMemory',
      async (item?: MemoryTreeItem) => {
        const memory = resolveMemoryItem(treeView, item);
        if (!memory) {
          return;
        }

        const confirm = await vscode.window.showWarningMessage(
          `¿Eliminar "${memory.name}"?`,
          { modal: true },
          'Eliminar'
        );

        if (confirm !== 'Eliminar') {
          return;
        }

        try {
          await manager.deleteMemory(memory.filePath);
          refresh();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          void vscode.window.showErrorMessage(
            `No se pudo eliminar la memoria: ${message}`
          );
        }
      }
    )
  );

  refresh();
}

function resolveMemoryItem(
  treeView: vscode.TreeView<MemoryTreeItem>,
  item?: MemoryTreeItem
): MemoryTreeItem['memory'] | undefined {
  if (item?.memory) {
    return item.memory;
  }

  return treeView.selection[0]?.memory;
}

export function deactivate(): void {}
