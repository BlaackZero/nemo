import * as assert from 'assert';
import {
  hashWorkspacePath,
  normalizeWorkspacePath,
  resolveRepoIdentity,
  resolveWorkspaceName,
  sanitizeRepoId,
} from '../../src/repoIdResolver';

suite('repoIdResolver', () => {
  test('sanitizeRepoId removes invalid characters', () => {
    assert.strictEqual(
      sanitizeRepoId('mi<api>:rest'),
      'mi-api-rest'
    );
  });

  test('sanitizeRepoId collapses whitespace and dashes', () => {
    assert.strictEqual(
      sanitizeRepoId('  my   project  '),
      'my-project'
    );
  });

  test('sanitizeRepoId falls back to unnamed-repo', () => {
    assert.strictEqual(sanitizeRepoId('***'), 'unnamed-repo');
  });

  test('normalizeWorkspacePath is stable across separators', () => {
    assert.strictEqual(
      normalizeWorkspacePath('C:\\Users\\dev\\mi-api-rest'),
      normalizeWorkspacePath('C:/Users/dev/mi-api-rest')
    );
  });

  test('hashWorkspacePath is stable for the same path', () => {
    const first = hashWorkspacePath('C:/Users/dev/mi-api-rest');
    const second = hashWorkspacePath('C:\\Users\\dev\\mi-api-rest');
    assert.strictEqual(first, second);
    assert.strictEqual(first.length, 12);
  });

  test('resolveWorkspaceName uses workspace name when present', () => {
    assert.strictEqual(
      resolveWorkspaceName({
        workspaceName: 'Mi API REST',
        folderPath: 'C:/Users/dev/mi-api-rest',
      }),
      'Mi-API-REST'
    );
  });

  test('resolveWorkspaceName falls back to basename', () => {
    assert.strictEqual(
      resolveWorkspaceName({
        folderPath: 'C:/Users/dev/mi-api-rest',
      }),
      'mi-api-rest'
    );
  });

  test('resolveRepoIdentity uses workspaceName strategy', () => {
    const identity = resolveRepoIdentity(
      {
        workspaceName: 'Mi API REST',
        folderPath: 'C:/Users/dev/mi-api-rest',
      },
      'workspaceName'
    );

    assert.strictEqual(identity.repoId, 'Mi-API-REST');
    assert.strictEqual(identity.displayName, 'Mi-API-REST');
  });

  test('resolveRepoIdentity uses pathHash strategy', () => {
    const identity = resolveRepoIdentity(
      {
        workspaceName: 'Mi API REST',
        folderPath: 'C:/Users/dev/mi-api-rest',
      },
      'pathHash'
    );

    assert.match(identity.repoId, /^Mi-API-REST-[a-f0-9]{12}$/);
    assert.strictEqual(identity.displayName, 'Mi-API-REST');
  });

  test('different strategies produce different repoId values', () => {
    const info = {
      workspaceName: 'api',
      folderPath: 'C:/Users/dev/api',
    };

    const byName = resolveRepoIdentity(info, 'workspaceName');
    const byHash = resolveRepoIdentity(info, 'pathHash');

    assert.notStrictEqual(byName.repoId, byHash.repoId);
  });
});
