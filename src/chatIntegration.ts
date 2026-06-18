import * as vscode from 'vscode';
import { MemoryManager } from './memoryManager';
import { MemoryFile } from './types';

export async function injectMemoryIntoChat(
  manager: MemoryManager,
  memory: MemoryFile
): Promise<void> {
  const raw = await manager.readMemory(memory.filePath);
  const content = manager.formatForChat(raw, memory.format);
  const prompt = buildInjectionPrompt(memory.name, content);

  try {
    await vscode.commands.executeCommand('workbench.action.chat.open', {
      query: prompt,
      isPartialQuery: true,
    });
    void vscode.window.showInformationMessage(
      'Memoria insertada en Copilot Chat. Edita y envía cuando quieras.'
    );
  } catch {
    await fallbackToClipboard(content);
  }
}

export function buildInjectionPrompt(
  fileName: string,
  content: string
): string {
  return [
    'Usa el siguiente contexto del repositorio como referencia:',
    '',
    `--- Repo Memory: ${fileName} ---`,
    content.trim(),
    '--- Fin Repo Memory ---',
    '',
    'Responde a mi pregunta teniendo en cuenta ese contexto.',
  ].join('\n');
}

async function fallbackToClipboard(content: string): Promise<void> {
  await vscode.env.clipboard.writeText(content);
  void vscode.window.showInformationMessage(
    'Copilot Chat no disponible. Contenido copiado al portapapeles.'
  );
}
