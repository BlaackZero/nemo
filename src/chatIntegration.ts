import * as fs from 'fs/promises';
import * as vscode from 'vscode';
import { i18n } from './i18n';
import { MemoryManager } from './memoryManager';
import { MemoryFile, MemoryFolder } from './types';

export const WORKBENCH_ATTACH_FILE = 'workbench.action.chat.attachFile';
export const WORKBENCH_ATTACH_FOLDER = 'workbench.action.chat.attachFolder';
export const COPILOT_ATTACH_COMMAND = 'github.copilot.chat.attachFile';
export const CHAT_OPEN_COMMAND = 'workbench.action.chat.open';

const CHAT_READY_DELAY_MS = 75;

export type CommandExecutor = (
  command: string,
  ...args: unknown[]
) => Thenable<unknown>;

export function isUriUnderWorkspace(uri: vscode.Uri): boolean {
  return vscode.workspace.getWorkspaceFolder(uri) !== undefined;
}

/** @deprecated Use isUriUnderWorkspace for docs; attach is attempted for all local files. */
export function shouldAttachFileDirectly(memory: MemoryFile): boolean {
  return isUriUnderWorkspace(vscode.Uri.file(memory.filePath));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryExecuteCommand(
  executeCommand: CommandExecutor,
  command: string,
  ...args: unknown[]
): Promise<boolean> {
  try {
    await executeCommand(command, ...args);
    return true;
  } catch {
    return false;
  }
}

export async function ensureChatVisible(
  executeCommand: CommandExecutor = vscode.commands.executeCommand.bind(
    vscode.commands
  )
): Promise<void> {
  await executeCommand(CHAT_OPEN_COMMAND);
  await delay(CHAT_READY_DELAY_MS);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function attachFilesToChat(
  fileUris: vscode.Uri[],
  executeCommand: CommandExecutor = vscode.commands.executeCommand.bind(
    vscode.commands
  )
): Promise<boolean> {
  if (fileUris.length === 0) {
    return false;
  }

  if (
    await tryExecuteCommand(executeCommand, WORKBENCH_ATTACH_FILE, ...fileUris)
  ) {
    return true;
  }

  if (
    await tryExecuteCommand(executeCommand, COPILOT_ATTACH_COMMAND, ...fileUris)
  ) {
    return true;
  }

  for (const uri of fileUris) {
    if (await tryExecuteCommand(executeCommand, WORKBENCH_ATTACH_FILE, uri)) {
      continue;
    }
    if (await tryExecuteCommand(executeCommand, COPILOT_ATTACH_COMMAND, uri)) {
      continue;
    }
    return false;
  }

  return fileUris.length > 0;
}

export async function attachMemoryToChat(
  fileUri: vscode.Uri,
  executeCommand: CommandExecutor = vscode.commands.executeCommand.bind(
    vscode.commands
  )
): Promise<boolean> {
  return attachFilesToChat([fileUri], executeCommand);
}

export async function attachFolderToChat(
  folderUri: vscode.Uri,
  executeCommand: CommandExecutor = vscode.commands.executeCommand.bind(
    vscode.commands
  )
): Promise<boolean> {
  return tryExecuteCommand(executeCommand, WORKBENCH_ATTACH_FOLDER, folderUri);
}

export async function openChatWithShortPrompt(
  executeCommand: CommandExecutor = vscode.commands.executeCommand.bind(
    vscode.commands
  )
): Promise<void> {
  await executeCommand(CHAT_OPEN_COMMAND, {
    query: i18n.chat.shortPrompt(),
    isPartialQuery: true,
  });
}

export async function injectMemoryContentAsPrompt(
  manager: MemoryManager,
  memory: MemoryFile,
  executeCommand: CommandExecutor = vscode.commands.executeCommand.bind(
    vscode.commands
  )
): Promise<void> {
  const raw = await manager.readMemory(memory.filePath);
  const content = manager.formatForChat(raw, memory.format);
  const prompt = buildInjectionPrompt(memory.name, content);

  await executeCommand(CHAT_OPEN_COMMAND, {
    query: prompt,
    isPartialQuery: true,
  });
}

export async function injectFolderContentAsPrompt(
  manager: MemoryManager,
  folder: MemoryFolder,
  files: MemoryFile[],
  executeCommand: CommandExecutor = vscode.commands.executeCommand.bind(
    vscode.commands
  )
): Promise<void> {
  const sections: string[] = [i18n.chat.injectionIntro(), ''];

  for (const file of files) {
    const raw = await manager.readMemory(file.filePath);
    const content = manager.formatForChat(raw, file.format);
    sections.push(i18n.chat.injectionStart(file.name));
    sections.push(content.trim());
    sections.push(i18n.chat.injectionEnd());
    sections.push('');
  }

  sections.push(i18n.chat.folderInjectionOutro(folder.name));

  await executeCommand(CHAT_OPEN_COMMAND, {
    query: sections.join('\n'),
    isPartialQuery: true,
  });
}

export async function injectMemoryIntoChat(
  manager: MemoryManager,
  memory: MemoryFile,
  executeCommand: CommandExecutor = vscode.commands.executeCommand.bind(
    vscode.commands
  )
): Promise<void> {
  const fileUri = vscode.Uri.file(memory.filePath);

  if (await fileExists(memory.filePath)) {
    const attached = await attachMemoryToChat(fileUri, executeCommand);
    if (attached) {
      void vscode.window.showInformationMessage(i18n.info.attachedToChat());
      return;
    }
  }

  try {
    await injectMemoryContentAsPrompt(manager, memory, executeCommand);
    void vscode.window.showInformationMessage(i18n.info.contentInserted());
    return;
  } catch {
    const raw = await manager.readMemory(memory.filePath);
    const content = manager.formatForChat(raw, memory.format);
    await fallbackToClipboard(content);
  }
}

export async function injectFolderIntoChat(
  manager: MemoryManager,
  folder: MemoryFolder,
  executeCommand: CommandExecutor = vscode.commands.executeCommand.bind(
    vscode.commands
  )
): Promise<void> {
  const files = await manager.collectDescendantMemoryFiles(
    folder.scope,
    folder.relativePath
  );

  if (files.length === 0) {
    void vscode.window.showWarningMessage(i18n.warning.emptyFolderInject());
    return;
  }

  const folderUri = vscode.Uri.file(folder.absolutePath);

  if (isUriUnderWorkspace(folderUri) && (await fileExists(folder.absolutePath))) {
    const attached = await attachFolderToChat(folderUri, executeCommand);
    if (attached) {
      void vscode.window.showInformationMessage(i18n.info.folderAttachedToChat());
      return;
    }
  }

  const fileUris = files.map((file) => vscode.Uri.file(file.filePath));
  const attached = await attachFilesToChat(fileUris, executeCommand);
  if (attached) {
    void vscode.window.showInformationMessage(i18n.info.folderAttachedToChat());
    return;
  }

  try {
    await injectFolderContentAsPrompt(manager, folder, files, executeCommand);
    void vscode.window.showInformationMessage(i18n.info.folderContentInserted());
    return;
  } catch {
    const sections: string[] = [];
    for (const file of files) {
      const raw = await manager.readMemory(file.filePath);
      sections.push(manager.formatForChat(raw, file.format));
    }
    await fallbackToClipboard(sections.join('\n\n'));
  }
}

export function buildInjectionPrompt(
  fileName: string,
  content: string
): string {
  return [
    i18n.chat.injectionIntro(),
    '',
    i18n.chat.injectionStart(fileName),
    content.trim(),
    i18n.chat.injectionEnd(),
    '',
    i18n.chat.injectionOutro(),
  ].join('\n');
}

async function fallbackToClipboard(content: string): Promise<void> {
  await vscode.env.clipboard.writeText(content);
  void vscode.window.showInformationMessage(i18n.info.copiedToClipboard());
}
