export interface AICache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  clear(): void;
  delete(key: string): void;
}
