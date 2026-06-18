import * as assert from 'assert';
import {
  buildColorPickItems,
  buildIconPickItems,
  resolveNodeIcon,
} from '../../src/nodeStyle';
import { PICKER_THEME_COLORS, THEME_ICONS } from '../../src/memoryManifest';

suite('nodeStyle', () => {
  test('resolveNodeIcon uses fallback when icon is omitted', () => {
    const icon = resolveNodeIcon(undefined, undefined, 'folder');
    assert.strictEqual(icon.id, 'folder');
  });

  test('resolveNodeIcon applies icon and color ids', () => {
    const icon = resolveNodeIcon('server', 'terminal.ansiBlue', 'folder');
    assert.strictEqual(icon.id, 'server');
    assert.ok(icon.color);
  });

  test('buildColorPickItems includes no-color and palette swatches', () => {
    const items = buildColorPickItems();
    assert.strictEqual(items.length, 1 + PICKER_THEME_COLORS.length);
    assert.strictEqual(items[0]?.pick.kind, 'none');
    assert.ok(items.every((item) => item.iconPath));
  });

  test('buildColorPickItems adds keep-current when color is set', () => {
    const items = buildColorPickItems('terminal.ansiRed');
    assert.strictEqual(items.length, 2 + PICKER_THEME_COLORS.length);
    assert.strictEqual(items[1]?.pick.kind, 'keep');
  });

  test('buildIconPickItems previews icons with selected color', () => {
    const items = buildIconPickItems('terminal.ansiGreen', undefined, 'folder');
    assert.strictEqual(items.length, THEME_ICONS.length);
    assert.ok(items.every((item) => item.iconPath));
  });

  test('buildIconPickItems adds keep-current when icon is set', () => {
    const items = buildIconPickItems(undefined, 'cloud', 'folder');
    assert.strictEqual(items.length, 1 + THEME_ICONS.length);
    assert.strictEqual(items[0]?.pick.kind, 'keep');
  });
});
