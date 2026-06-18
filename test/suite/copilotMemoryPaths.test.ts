import * as assert from 'assert';
import * as path from 'path';
import {
  COPILOT_EXTENSION_ID,
  getCopilotRepoMemoryDir,
  getCopilotUserMemoryDir,
  isReservedCopilotUserEntry,
  virtualPathForScope,
} from '../../src/copilotMemoryPaths';

suite('copilotMemoryPaths', () => {
  const mockContext = {
    storageUri: { fsPath: '/ws-storage/nemo-context' },
    globalStorageUri: { fsPath: '/global/blaackzero.nemo-context' },
  } as never;

  test('getCopilotRepoMemoryDir resolves workspace storage path', () => {
    assert.strictEqual(
      getCopilotRepoMemoryDir(mockContext),
      path.join(
        '/ws-storage',
        COPILOT_EXTENSION_ID,
        'memory-tool/memories/repo'
      )
    );
  });

  test('getCopilotUserMemoryDir resolves global storage path', () => {
    assert.strictEqual(
      getCopilotUserMemoryDir(mockContext),
      path.join('/global', COPILOT_EXTENSION_ID, 'memory-tool/memories')
    );
  });

  test('virtualPathForScope maps repository and user paths', () => {
    assert.strictEqual(
      virtualPathForScope('copilotRepo', 'rules.md'),
      '/memories/repo/rules.md'
    );
    assert.strictEqual(
      virtualPathForScope('copilotUser', 'preferences.md'),
      '/memories/preferences.md'
    );
  });

  test('isReservedCopilotUserEntry excludes repo and session dirs', () => {
    assert.strictEqual(isReservedCopilotUserEntry('repo', true), true);
    assert.strictEqual(isReservedCopilotUserEntry('session', true), true);
    assert.strictEqual(isReservedCopilotUserEntry('preferences.md', false), false);
  });
});
