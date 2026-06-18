import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  attachMemoryToChat,
  buildInjectionPrompt,
  CHAT_OPEN_COMMAND,
  COPILOT_ATTACH_COMMAND,
  injectMemoryIntoChat,
  openChatWithShortPrompt,
} from '../../src/chatIntegration';
import { MemoryManager } from '../../src/memoryManager';
import { MemoryFile } from '../../src/types';

suite('chatIntegration', () => {
  test('buildInjectionPrompt wraps memory content', () => {
    const prompt = buildInjectionPrompt('rules.md', '# Reglas\n- Usar TypeScript');

    assert.match(prompt, /--- Nemo: rules\.md ---/);
    assert.match(prompt, /# Reglas/);
    assert.match(prompt, /--- End Nemo ---/);
  });

  test('attachMemoryToChat calls copilot attach command', async () => {
    const calls: string[] = [];
    const executeCommand = async (command: string): Promise<void> => {
      calls.push(command);
    };

    const uri = vscode.Uri.file('/tmp/rules.md');
    await attachMemoryToChat(uri, executeCommand);

    assert.deepStrictEqual(calls, [COPILOT_ATTACH_COMMAND]);
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

  test('injectMemoryIntoChat prefers attach then short prompt', async () => {
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

    assert.deepStrictEqual(calls, [COPILOT_ATTACH_COMMAND, CHAT_OPEN_COMMAND]);
  });

  test('injectMemoryIntoChat falls back to pasted prompt when attach fails', async () => {
    const calls: Array<{ command: string; args: unknown[] }> = [];
    const executeCommand = async (
      command: string,
      ...args: unknown[]
    ): Promise<void> => {
      if (command === COPILOT_ATTACH_COMMAND) {
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
      filePath: '/tmp/store/rules.md',
      format: 'markdown',
    };

    await injectMemoryIntoChat(manager, memory, executeCommand);

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0]?.command, CHAT_OPEN_COMMAND);
    assert.match(String((calls[0]?.args[0] as { query: string }).query), /--- Nemo: rules\.md ---/);
  });
});
