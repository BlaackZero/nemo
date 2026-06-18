import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  attachFilesToChat,
  attachMemoryToChat,
  buildInjectionPrompt,
  CHAT_OPEN_COMMAND,
  COPILOT_ATTACH_COMMAND,
  injectFolderIntoChat,
  injectMemoryIntoChat,
  isUriUnderWorkspace,
  openChatWithShortPrompt,
  shouldAttachFileDirectly,
  WORKBENCH_ATTACH_FILE,
  WORKBENCH_ATTACH_FOLDER,
} from '../../src/chatIntegration';
import { MemoryManager } from '../../src/memoryManager';
import { MemoryFile, MemoryFolder } from '../../src/types';

suite('chatIntegration', () => {
  test('buildInjectionPrompt wraps memory content', () => {
    const prompt = buildInjectionPrompt('rules.md', '# Reglas\n- Usar TypeScript');

    assert.match(prompt, /--- Nemo: rules\.md ---/);
    assert.match(prompt, /# Reglas/);
    assert.match(prompt, /--- End Nemo ---/);
  });

  test('attachMemoryToChat calls workbench attach first', async () => {
    const calls: string[] = [];
    const executeCommand = async (command: string): Promise<void> => {
      calls.push(command);
    };

    const uri = vscode.Uri.file('/tmp/rules.md');
    const attached = await attachMemoryToChat(uri, executeCommand);

    assert.strictEqual(attached, true);
    assert.deepStrictEqual(calls, [WORKBENCH_ATTACH_FILE]);
  });

  test('attachMemoryToChat falls back to copilot attach command', async () => {
    const calls: string[] = [];
    const executeCommand = async (command: string): Promise<void> => {
      if (command === WORKBENCH_ATTACH_FILE) {
        throw new Error('workbench attach unavailable');
      }
      calls.push(command);
    };

    const uri = vscode.Uri.file('/tmp/rules.md');
    const attached = await attachMemoryToChat(uri, executeCommand);

    assert.strictEqual(attached, true);
    assert.deepStrictEqual(calls, [COPILOT_ATTACH_COMMAND]);
  });

  test('attachMemoryToChat returns false when both attach commands fail', async () => {
    const executeCommand = async (command: string): Promise<void> => {
      if (
        command === WORKBENCH_ATTACH_FILE ||
        command === COPILOT_ATTACH_COMMAND
      ) {
        throw new Error('attach unavailable');
      }
    };

    const attached = await attachMemoryToChat(
      vscode.Uri.file('/tmp/rules.md'),
      executeCommand
    );

    assert.strictEqual(attached, false);
  });

  test('openChatWithShortPrompt opens chat without full content', async () => {
    const calls: Array<{ command: string; args: unknown[] }> = [];
    const executeCommand = async (
      command: string,
      ...args: unknown[]
    ): Promise<void> => {
      calls.push({ command, args });
    };

    await openChatWithShortPrompt(executeCommand);

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0]?.command, CHAT_OPEN_COMMAND);
    assert.deepStrictEqual(calls[0]?.args[0], {
      query: 'Use the attached memory as project context.',
      isPartialQuery: true,
    });
  });

  test('shouldAttachFileDirectly skips copilot storage scopes', () => {
    const copilotMemory: MemoryFile = {
      kind: 'file',
      scope: 'copilotRepo',
      name: 'rules.md',
      relativePath: 'rules.md',
      filePath: 'C:/AppData/rules.md',
      format: 'markdown',
    };

    assert.strictEqual(shouldAttachFileDirectly(copilotMemory), false);
  });

  test('injectMemoryIntoChat uses content prompt for copilotRepo scope', async () => {
    const calls: string[] = [];
    const executeCommand = async (command: string): Promise<void> => {
      calls.push(command);
    };

    const manager = {
      readMemory: async () => '# Reglas',
      formatForChat: (raw: string) => raw,
    } as unknown as MemoryManager;

    const memory: MemoryFile = {
      kind: 'file',
      scope: 'copilotRepo',
      name: 'rules.md',
      relativePath: 'rules.md',
      filePath: '/tmp/store/rules.md',
      format: 'markdown',
    };

    await injectMemoryIntoChat(manager, memory, executeCommand);

    assert.deepStrictEqual(calls, [CHAT_OPEN_COMMAND]);
    assert.ok(!calls.includes(WORKBENCH_ATTACH_FILE));
  });

  test('injectMemoryIntoChat prefers attach for sharedGit workspace files', async () => {
    const calls: string[] = [];
    const executeCommand = async (command: string): Promise<void> => {
      calls.push(command);
    };

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const filePath = workspaceRoot
      ? `${workspaceRoot}/.nemo/rules.md`
      : '/tmp/workspace/.nemo/rules.md';

    const manager = {
      readMemory: async () => '# Reglas',
      formatForChat: (raw: string) => raw,
    } as unknown as MemoryManager;

    const memory: MemoryFile = {
      kind: 'file',
      scope: 'sharedGit',
      name: 'rules.md',
      relativePath: 'rules.md',
      filePath,
      format: 'markdown',
    };

    if (!isUriUnderWorkspace(vscode.Uri.file(filePath))) {
      return;
    }

    await injectMemoryIntoChat(manager, memory, executeCommand);

    assert.deepStrictEqual(calls, [WORKBENCH_ATTACH_FILE, CHAT_OPEN_COMMAND]);
  });

  test('injectMemoryIntoChat falls back to pasted prompt when attach fails', async () => {
    const calls: Array<{ command: string; args: unknown[] }> = [];
    const executeCommand = async (
      command: string,
      ...args: unknown[]
    ): Promise<void> => {
      if (
        command === WORKBENCH_ATTACH_FILE ||
        command === COPILOT_ATTACH_COMMAND
      ) {
        throw new Error('Copilot unavailable');
      }
      calls.push({ command, args });
    };

    const manager = {
      readMemory: async () => '# Reglas',
      formatForChat: (raw: string) => raw,
    } as unknown as MemoryManager;

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      return;
    }

    const memory: MemoryFile = {
      kind: 'file',
      scope: 'sharedGit',
      name: 'rules.md',
      relativePath: 'rules.md',
      filePath: `${workspaceRoot}/.nemo/rules.md`,
      format: 'markdown',
    };

    await injectMemoryIntoChat(manager, memory, executeCommand);

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0]?.command, CHAT_OPEN_COMMAND);
    assert.match(String((calls[0]?.args[0] as { query: string }).query), /--- Nemo: rules\.md ---/);
  });

  test('injectFolderIntoChat uses attachFolder for workspace folders', async () => {
    const calls: string[] = [];
    const executeCommand = async (command: string): Promise<void> => {
      calls.push(command);
    };

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      return;
    }

    const folder: MemoryFolder = {
      kind: 'folder',
      scope: 'sharedGit',
      name: 'backend',
      relativePath: 'backend',
      absolutePath: `${workspaceRoot}/.nemo/backend`,
    };

    const files: MemoryFile[] = [
      {
        kind: 'file',
        scope: 'sharedGit',
        name: 'rules.md',
        relativePath: 'backend/rules.md',
        filePath: `${workspaceRoot}/.nemo/backend/rules.md`,
        format: 'markdown',
      },
    ];

    const manager = {
      collectDescendantMemoryFiles: async () => files,
      readMemory: async () => '# Reglas',
      formatForChat: (raw: string) => raw,
    } as unknown as MemoryManager;

    await injectFolderIntoChat(manager, folder, executeCommand);

    assert.deepStrictEqual(calls, [WORKBENCH_ATTACH_FOLDER, CHAT_OPEN_COMMAND]);
  });

  test('injectFolderIntoChat multi-attaches files outside workspace', async () => {
    const calls: unknown[][] = [];
    const executeCommand = async (
      command: string,
      ...args: unknown[]
    ): Promise<void> => {
      calls.push([command, ...args]);
    };

    const folder: MemoryFolder = {
      kind: 'folder',
      scope: 'copilotRepo',
      name: 'backend',
      relativePath: 'backend',
      absolutePath: 'C:/AppData/copilot/backend',
    };

    const files: MemoryFile[] = [
      {
        kind: 'file',
        scope: 'copilotRepo',
        name: 'rules.md',
        relativePath: 'backend/rules.md',
        filePath: 'C:/AppData/copilot/backend/rules.md',
        format: 'markdown',
      },
    ];

    const manager = {
      collectDescendantMemoryFiles: async () => files,
      readMemory: async () => '# Reglas',
      formatForChat: (raw: string) => raw,
    } as unknown as MemoryManager;

    await injectFolderIntoChat(manager, folder, executeCommand);

    assert.strictEqual(calls[0]?.[0], WORKBENCH_ATTACH_FILE);
    assert.strictEqual(calls[1]?.[0], CHAT_OPEN_COMMAND);
  });

  test('attachFilesToChat attaches multiple uris in one batch', async () => {
    const calls: unknown[][] = [];
    const executeCommand = async (
      command: string,
      ...args: unknown[]
    ): Promise<void> => {
      calls.push([command, ...args]);
    };

    const uris = [
      vscode.Uri.file('/tmp/a.md'),
      vscode.Uri.file('/tmp/b.md'),
    ];
    const attached = await attachFilesToChat(uris, executeCommand);

    assert.strictEqual(attached, true);
    assert.strictEqual(calls[0]?.[0], WORKBENCH_ATTACH_FILE);
    assert.strictEqual(calls[0]?.length, 3);
  });
});
