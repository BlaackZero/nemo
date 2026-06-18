import * as assert from 'assert';
import { buildInjectionPrompt } from '../../src/chatIntegration';

suite('chatIntegration', () => {
  test('buildInjectionPrompt wraps memory content', () => {
    const prompt = buildInjectionPrompt('rules.md', '# Reglas\n- Usar TypeScript');

    assert.match(prompt, /--- Repo Memory: rules\.md ---/);
    assert.match(prompt, /# Reglas/);
    assert.match(prompt, /--- Fin Repo Memory ---/);
  });
});
