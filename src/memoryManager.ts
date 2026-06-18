import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { resolveRepoIdentity } from './repoIdResolver';
import {
  MemoryFile,
  MemoryFormat,
  MemoryManagerConfig,
  RepoIdentity,
} from './types';

export class MemoryManager {
  constructor(private readonly context: vscode.ExtensionContext) {}

  getConfig(): MemoryManagerConfig {
    const config = vscode.workspace.getConfiguration('repoMemory');
    return {
      storageLocation: config.get<'home' | 'globalStorage'>(
        'storageLocation',
        'home'
      ),
      repoIdStrategy: config.get<'workspaceName' | 'pathHash'>(
        'repoIdStrategy',
        'workspaceName'
      ),
    };
  }

  getCurrentRepoIdentity(): RepoIdentity | undefined {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      return undefined;
    }

    const config = this.getConfig();
    return resolveRepoIdentity(
      {
        workspaceName: vscode.workspace.name,
        folderPath: folder.uri.fsPath,
      },
      config.repoIdStrategy
    );
  }

  getStorageRoot(): string {
    const { storageLocation } = this.getConfig();

    if (storageLocation === 'globalStorage') {
      return path.join(this.context.globalStorageUri.fsPath, 'repos');
    }

    return path.join(os.homedir(), '.repo-memory-store');
  }

  getRepoMemoryDir(): string | undefined {
    const identity = this.getCurrentRepoIdentity();
    if (!identity) {
      return undefined;
    }

    return path.join(this.getStorageRoot(), identity.repoId);
  }

  async ensureRepoDir(): Promise<string> {
    const dir = this.getRepoMemoryDir();
    if (!dir) {
      throw new Error('No hay workspace abierto.');
    }

    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  isMemoryFileName(name: string): boolean {
    return name.endsWith('.md') || name.endsWith('.json');
  }

  getFormatFromFileName(name: string): MemoryFormat {
    return name.endsWith('.json') ? 'json' : 'markdown';
  }

  async listMemories(): Promise<MemoryFile[]> {
    const dir = this.getRepoMemoryDir();
    if (!dir) {
      return [];
    }

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile() && this.isMemoryFileName(entry.name))
        .map((entry) => ({
          name: entry.name,
          filePath: path.join(dir, entry.name),
          format: this.getFormatFromFileName(entry.name),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }

  async readMemory(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf8');
  }

  buildDefaultContent(baseName: string, format: MemoryFormat): string {
    if (format === 'json') {
      return JSON.stringify(
        {
          title: baseName,
          rules: [],
          context: '',
          prompts: [],
        },
        null,
        2
      );
    }

    return `# ${baseName}\n\n## Contexto\n\n## Reglas\n\n## Prompts\n`;
  }

  async createMemory(
    baseName: string,
    format: MemoryFormat
  ): Promise<MemoryFile> {
    const dir = await this.ensureRepoDir();
    const ext = format === 'json' ? '.json' : '.md';
    const safeName = sanitizeMemoryBaseName(baseName);
    const fileName = `${safeName}${ext}`;
    const filePath = path.join(dir, fileName);
    const content = this.buildDefaultContent(baseName.trim(), format);

    await fs.writeFile(filePath, content, { flag: 'wx' });

    return {
      name: fileName,
      filePath,
      format,
    };
  }

  async deleteMemory(filePath: string): Promise<void> {
    await fs.unlink(filePath);
  }

  formatForChat(raw: string, format: MemoryFormat): string {
    if (format !== 'json') {
      return raw;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === 'string'
        ? parsed
        : JSON.stringify(parsed, null, 2);
    } catch {
      return raw;
    }
  }
}

export function sanitizeMemoryBaseName(name: string): string {
  const trimmed = name.trim();
  const withoutExt = trimmed.replace(/\.(md|json)$/i, '');
  return (
    withoutExt
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 120) || 'memory'
  );
}
