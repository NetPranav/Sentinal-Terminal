/**
 * fsPolyfill.ts — Browser-Safe Filesystem Polyfill for Tauri Webview
 * 
 * Provides safe, non-throwing stubs for Node's 'fs' module when running in browser context.
 */

export function existsSync(): boolean {
  return false;
}

export function readFileSync(): string {
  return '';
}

export function writeFileSync(): void {
  // No-op in browser context; persistent storage delegates to Tauri IPC
}

export function appendFileSync(): void {
  // No-op in browser context
}

export function unlinkSync(): void {
  // No-op in browser context
}

export function rmdirSync(): void {
  // No-op in browser context
}

export function copyFileSync(): void {
  // No-op in browser context
}

export function mkdirSync(): void {
  // No-op in browser context
}

export function readdirSync(): string[] {
  return [];
}

export function statSync(): { isFile: () => boolean; isDirectory: () => boolean; size: number } {
  return {
    isFile: () => false,
    isDirectory: () => false,
    size: 0,
  };
}

export const promises = {
  readFile: async (): Promise<string> => '',
  writeFile: async (): Promise<void> => {},
  readdir: async (): Promise<string[]> => [],
  stat: async (): Promise<{ isFile: () => boolean; isDirectory: () => boolean; size: number }> => ({
    isFile: () => false,
    isDirectory: () => false,
    size: 0,
  }),
  access: async (): Promise<void> => {},
};

export default {
  existsSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  unlinkSync,
  rmdirSync,
  copyFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  promises,
};
