import { MemoryFormat } from './types';

export function formatMemoryTitle(baseName: string): string {
  return baseName
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function buildDefaultMemoryContent(
  baseName: string,
  format: MemoryFormat
): string {
  const title = formatMemoryTitle(baseName);

  if (format === 'json') {
    return JSON.stringify(
      {
        title,
        description: 'What this memory is for',
        context: [],
        rules: {
          do: [],
          dont: [],
          always: [],
          never: [],
        },
        prompts: [],
        examples: [],
      },
      null,
      2
    );
  }

  return `# ${title}

> Nemo memory — repository context for Copilot. Keep it concise; prefer bullets.

## Overview

What this memory covers and when the agent should apply it.

## Context

- Stack, architecture, or domain assumptions
- Key paths, docs, or conventions

## Rules

- **Do:** …
- **Don't:** …
- **Always:** …
- **Never:** …

## Prompts

Reusable chat starters:

- When reviewing code: "…"
- When adding features: "…"

## Examples

<!-- Optional: short good vs bad snippets -->
`;
}
