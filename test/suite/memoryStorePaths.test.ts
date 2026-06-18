import * as assert from 'assert';
import {
  normalizeSharedPath,
  createDefaultConfig,
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
});
