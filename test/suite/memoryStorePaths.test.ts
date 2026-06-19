import * as assert from 'assert';
import {
  normalizeSharedPath,
  createDefaultConfig,
  resolveWorkspaceFolderPath,
} from '../../src/memoryStorePaths';

suite('memoryStorePaths', () => {
  test('normalizeSharedPath accepts relative folder names', () => {
    assert.strictEqual(normalizeSharedPath('.nemo'), '.nemo');
    assert.strictEqual(normalizeSharedPath('docs/memories'), 'docs/memories');
  });

  test('normalizeSharedPath rejects path traversal', () => {
    assert.throws(
      () => normalizeSharedPath('../secrets'),
      /cannot contain/
    );
    assert.throws(() => normalizeSharedPath(''), /cannot contain/);
  });

  test('createDefaultConfig includes sharedPath', () => {
    assert.strictEqual(createDefaultConfig().sharedPath, '.nemo');
  });

  test('resolveWorkspaceFolderPath prefers an existing selected workspace', () => {
    assert.strictEqual(
      resolveWorkspaceFolderPath(['/workspace-a', '/workspace-b'], '/workspace-b'),
      '/workspace-b'
    );
  });

  test('resolveWorkspaceFolderPath falls back to the first workspace', () => {
    assert.strictEqual(
      resolveWorkspaceFolderPath(['/workspace-a', '/workspace-b'], '/workspace-c'),
      '/workspace-a'
    );
  });
});
