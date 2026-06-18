import * as vscode from 'vscode';
import { i18n } from './i18n';
import { MemoryManager } from './memoryManager';
import { MemoryFile } from './types';

export const COPILOT_ATTACH_COMMAND = 'github.copilot.chat.attachFile';
export const CHAT_OPEN_COMMAND = 'workbench.action.chat.open';

export type CommandExecutor = (
  command: string,
  ...args: unknown[]
) => Thenable<unknown>;

export async function attachMemoryToChat(
  fileUri: vscode.Uri,
  executeCommand: CommandExecutor = vscode.commands.executeCommand.bind(
    vscode.commands
  )
): Promise<boolean> {
  await executeCommand(COPILOT_ATTACH_COMMAND, fileUri);
  return true;
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

export async function injectMemoryIntoChat(
  manager: MemoryManager,
  memory: MemoryFile,
  executeCommand: CommandExecutor = vscode.commands.executeCommand.bind(
    vscode.commands
  )
): Promise<void> {
  const fileUri = vscode.Uri.file(memory.filePath);

  try {
    await attachMemoryToChat(fileUri, executeCommand);
    await openChatWithShortPrompt(executeCommand);
    void vscode.window.showInformationMessage(i18n.info.attachedToChat());
    return;
  } catch {
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
