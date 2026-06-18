import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
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
    assert.strictEqual(calls[0], WORKBENCH_ATTACH_FILE);
    assert.ok(!calls.includes(CHAT_OPEN_COMMAND));
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
    assert.strictEqual(calls[0], COPILOT_ATTACH_COMMAND);
    assert.ok(!calls.includes(CHAT_OPEN_COMMAND));
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

  test('shouldAttachFileDirectly is false for files outside workspace', () => {
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

  test('injectMemoryIntoChat tries attach before content for copilotRepo', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nemo-inject-'));
    const filePath = path.join(tempDir, 'rules.md');
    await fs.writeFile(filePath, '# Reglas');

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
      filePath,
      format: 'markdown',
    };

    try {
      await injectMemoryIntoChat(manager, memory, executeCommand);

      assert.strictEqual(calls[0], WORKBENCH_ATTACH_FILE);
      assert.ok(!calls.includes(CHAT_OPEN_COMMAND));
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  test('injectMemoryIntoChat uses content prompt when attach fails', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nemo-inject-'));
    const filePath = path.join(tempDir, 'rules.md');
    await fs.writeFile(filePath, '# Reglas');

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

    const memory: MemoryFile = {
      kind: 'file',
      scope: 'copilotRepo',
      name: 'rules.md',
      relativePath: 'rules.md',
      filePath,
      format: 'markdown',
    };

    try {
      await injectMemoryIntoChat(manager, memory, executeCommand);

      const contentCall = calls.find(
        (call) =>
          call.command === CHAT_OPEN_COMMAND &&
          typeof (call.args[0] as { query?: string } | undefined)?.query ===
            'string' &&
          (call.args[0] as { query: string }).query.includes('--- Nemo:')
      );
      assert.ok(contentCall);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  test('injectMemoryIntoChat attaches sharedGit workspace files without extra prompt', async () => {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      return;
    }

    const tempDir = path.join(workspaceRoot, '.nemo-test-inject');
    await fs.mkdir(tempDir, { recursive: true });
    const filePath = path.join(tempDir, 'rules.md');
    await fs.writeFile(filePath, '# Reglas');

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
      scope: 'sharedGit',
      name: 'rules.md',
      relativePath: 'rules.md',
      filePath,
      format: 'markdown',
    };

    if (!isUriUnderWorkspace(vscode.Uri.file(filePath))) {
      await fs.rm(tempDir, { recursive: true, force: true });
      return;
    }

    try {
      await injectMemoryIntoChat(manager, memory, executeCommand);

      assert.strictEqual(calls[0], WORKBENCH_ATTACH_FILE);
      assert.strictEqual(calls.length, 1);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  test('injectFolderIntoChat uses attachFolder for workspace folders', async () => {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      return;
    }

    const folderPath = path.join(workspaceRoot, '.nemo-test-folder');
    await fs.mkdir(folderPath, { recursive: true });
    await fs.writeFile(path.join(folderPath, 'rules.md'), '# Reglas');

    const calls: string[] = [];
    const executeCommand = async (command: string): Promise<void> => {
      calls.push(command);
    };

    const folder: MemoryFolder = {
      kind: 'folder',
      scope: 'sharedGit',
      name: 'backend',
      relativePath: 'backend',
      absolutePath: folderPath,
    };

    const files: MemoryFile[] = [
      {
        kind: 'file',
        scope: 'sharedGit',
        name: 'rules.md',
        relativePath: 'backend/rules.md',
        filePath: path.join(folderPath, 'rules.md'),
        format: 'markdown',
      },
    ];

    const manager = {
      collectDescendantMemoryFiles: async () => files,
      readMemory: async () => '# Reglas',
      formatForChat: (raw: string) => raw,
    } as unknown as MemoryManager;

    try {
      await injectFolderIntoChat(manager, folder, executeCommand);

      assert.strictEqual(calls[0], WORKBENCH_ATTACH_FOLDER);
      assert.strictEqual(calls.length, 1);
    } finally {
      await fs.rm(folderPath, { recursive: true, force: true });
    }
  });

  test('injectFolderIntoChat multi-attaches files outside workspace', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nemo-folder-'));
    const filePath = path.join(tempDir, 'rules.md');
    await fs.writeFile(filePath, '# Reglas');

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
      absolutePath: tempDir,
    };

    const files: MemoryFile[] = [
      {
        kind: 'file',
        scope: 'copilotRepo',
        name: 'rules.md',
        relativePath: 'backend/rules.md',
        filePath,
        format: 'markdown',
      },
    ];

    const manager = {
      collectDescendantMemoryFiles: async () => files,
      readMemory: async () => '# Reglas',
      formatForChat: (raw: string) => raw,
    } as unknown as MemoryManager;

    try {
      await injectFolderIntoChat(manager, folder, executeCommand);

      assert.strictEqual(calls[0]?.[0], WORKBENCH_ATTACH_FILE);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  test('attachFilesToChat uses workbench attach first', async () => {
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
    assert.ok(calls.every((call) => call[0] !== CHAT_OPEN_COMMAND));
  });
});
