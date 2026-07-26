export interface AIContext {
  os?: 'macos' | 'windows' | 'linux';
  cwd?: string;
  shell?: string;
  [key: string]: any;
}
