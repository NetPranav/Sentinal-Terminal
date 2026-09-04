/**
 * pathPolyfill.ts — Browser-Safe POSIX Path Polyfill for Tauri Webview
 * 
 * Provides standard POSIX path functions (join, resolve, dirname, basename, extname, sep, delimiter)
 * when running inside the Tauri Webview (Safari/WebKit) where Node's 'path' module is unavailable.
 */

export function join(...segments: (string | undefined | null)[]): string {
  const parts = segments.filter((s): s is string => typeof s === 'string' && s.length > 0);
  if (parts.length === 0) return '.';
  const raw = parts.join('/');
  const isAbsolute = raw.startsWith('/');
  const clean = raw.split('/').filter(Boolean).join('/');
  return isAbsolute ? '/' + clean : clean;
}

export function resolve(...segments: (string | undefined | null)[]): string {
  return join(...segments);
}

export function dirname(filePath: string): string {
  if (!filePath) return '.';
  const normalized = filePath.replace(/\/+$/, '');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash === -1) return '.';
  if (lastSlash === 0) return '/';
  return normalized.substring(0, lastSlash);
}

export function basename(filePath: string, ext?: string): string {
  if (!filePath) return '';
  const normalized = filePath.replace(/\/+$/, '');
  const lastSlash = normalized.lastIndexOf('/');
  let base = lastSlash === -1 ? normalized : normalized.substring(lastSlash + 1);
  if (ext && base.endsWith(ext)) {
    base = base.substring(0, base.length - ext.length);
  }
  return base;
}

export function extname(filePath: string): string {
  if (!filePath) return '';
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot <= 0) return '';
  return filePath.substring(lastDot);
}

export function isAbsolute(filePath: string): boolean {
  return typeof filePath === 'string' && filePath.startsWith('/');
}

export function normalize(filePath: string): string {
  if (!filePath) return '.';
  const isAbs = filePath.startsWith('/');
  const parts = filePath.split('/').filter(p => p && p !== '.');
  const res: string[] = [];
  for (const part of parts) {
    if (part === '..') {
      res.pop();
    } else {
      res.push(part);
    }
  }
  const joined = res.join('/');
  return isAbs ? '/' + joined : joined || '.';
}

export function relative(from: string, to: string): string {
  return to;
}

export const sep = '/';
export const delimiter = ':';

export const posix = {
  join,
  resolve,
  dirname,
  basename,
  extname,
  isAbsolute,
  normalize,
  relative,
  sep,
  delimiter,
};

export default {
  join,
  resolve,
  dirname,
  basename,
  extname,
  isAbsolute,
  normalize,
  relative,
  sep,
  delimiter,
  posix,
};
