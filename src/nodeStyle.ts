import * as vscode from 'vscode';
import { i18n } from './i18n';
import {
  THEME_COLOR_OPTIONS,
  THEME_ICONS,
  ThemeColorId,
  ThemeIconId,
} from './memoryManifest';

export interface NodeStyle {
  icon?: ThemeIconId;
  color?: ThemeColorId;
}

type ColorPickResult =
  | { kind: 'none' }
  | { kind: 'keep' }
  | { kind: 'color'; value: ThemeColorId };

type IconPickResult =
  | { kind: 'keep' }
  | { kind: 'default' }
  | { kind: 'icon'; value: ThemeIconId };

export interface StyleQuickPickItem<T> extends vscode.QuickPickItem {
  pick: T;
}

export function resolveNodeIcon(
  iconId: string | undefined,
  colorId: ThemeColorId | undefined,
  fallbackIcon: ThemeIconId
): vscode.ThemeIcon {
  const id = iconId ?? fallbackIcon;
  const color = colorId ? new vscode.ThemeColor(colorId) : undefined;
  return new vscode.ThemeIcon(id, color);
}

export function buildColorPickItems(
  currentColor?: ThemeColorId
): StyleQuickPickItem<ColorPickResult>[] {
  const items: StyleQuickPickItem<ColorPickResult>[] = [
    {
      label: i18n.command.noColor(),
      iconPath: new vscode.ThemeIcon('circle-outline'),
      pick: { kind: 'none' },
    },
  ];

  if (currentColor) {
    items.push({
      label: i18n.style.keepCurrentColor(),
      iconPath: new vscode.ThemeIcon(
        'circle-filled',
        new vscode.ThemeColor(currentColor)
      ),
      pick: { kind: 'keep' },
    });
  }

  for (const option of THEME_COLOR_OPTIONS) {
    items.push({
      label: i18n.style.colorLabel(option.labelMessage),
      iconPath: new vscode.ThemeIcon(
        'circle-filled',
        new vscode.ThemeColor(option.id)
      ),
      pick: { kind: 'color', value: option.id },
    });
  }

  return items;
}

export function buildIconPickItems(
  selectedColor: ThemeColorId | undefined,
  currentIcon: ThemeIconId | undefined,
  fallbackIcon: ThemeIconId
): StyleQuickPickItem<IconPickResult>[] {
  const items: StyleQuickPickItem<IconPickResult>[] = [
    {
      label: i18n.style.defaultIcon(),
      iconPath: resolveNodeIcon(fallbackIcon, selectedColor, fallbackIcon),
      pick: { kind: 'default' },
    },
  ];

  if (currentIcon) {
    items.push({
      label: i18n.style.keepCurrentIcon(),
      iconPath: resolveNodeIcon(currentIcon, selectedColor, fallbackIcon),
      pick: { kind: 'keep' },
    });
  }

  for (const iconId of THEME_ICONS) {
    items.push({
      label: i18n.style.iconLabel(iconId),
      iconPath: resolveNodeIcon(iconId, selectedColor, iconId),
      pick: { kind: 'icon', value: iconId },
    });
  }

  return items;
}

export async function pickNodeStyle(
  current?: NodeStyle,
  fallbackIcon: ThemeIconId = 'folder'
): Promise<NodeStyle | undefined> {
  const colorItems = buildColorPickItems(current?.color);
  const colorPick = await vscode.window.showQuickPick(colorItems, {
    placeHolder: i18n.prompt.iconColor(),
    matchOnDescription: false,
  });

  if (!colorPick) {
    return undefined;
  }

  let selectedColor: ThemeColorId | undefined;
  if (colorPick.pick.kind === 'keep') {
    selectedColor = current?.color;
  } else if (colorPick.pick.kind === 'none') {
    selectedColor = undefined;
  } else {
    selectedColor = colorPick.pick.value;
  }

  const iconItems = buildIconPickItems(
    selectedColor,
    current?.icon,
    fallbackIcon
  );
  const iconPick = await vscode.window.showQuickPick(iconItems, {
    placeHolder: i18n.prompt.icon(),
    matchOnDescription: false,
  });

  if (!iconPick) {
    return undefined;
  }

  const selectedIcon =
    iconPick.pick.kind === 'keep'
      ? current?.icon ?? fallbackIcon
      : iconPick.pick.kind === 'default'
        ? undefined
        : iconPick.pick.value;

  return { icon: selectedIcon, color: selectedColor };
}

export function getDefaultIconForNode(
  isFolder: boolean,
  format?: 'markdown' | 'json'
): ThemeIconId {
  if (isFolder) {
    return 'folder';
  }

  return format === 'json' ? 'json' : 'markdown';
}
