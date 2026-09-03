import { describe, expect, it } from 'vitest';
import { isExplicitFilesystemSearch, findFastPath } from './AgentLoop';

describe('AgentLoop fast-path routing', () => {
  it('uses the filesystem shortcut only for explicit file-oriented searches', () => {
    expect(isExplicitFilesystemSearch('find all json files in tools')).toBe(true);
    expect(isExplicitFilesystemSearch('locate *.tsx')).toBe(true);
    expect(isExplicitFilesystemSearch('search for a file named config.json')).toBe(true);
  });

  it('leaves ambiguous and web-oriented searches for the local model', () => {
    expect(isExplicitFilesystemSearch('search the web for Rust ownership')).toBe(false);
    expect(isExplicitFilesystemSearch('find me a good coffee shop')).toBe(false);
  });

  it('routes URL opening directly to browser.navigate with target browser application', () => {
    const res = findFastPath('open youtube.com in safari');
    expect(res).not.toBeNull();
    expect(res?.tool).toBe('browser.navigate');
    expect(res?.params.url).toBe('youtube.com');
    expect(res?.params.appName).toBe('safari');

    const res2 = findFastPath('navigate to https://github.com using chrome');
    expect(res2?.tool).toBe('browser.navigate');
    expect(res2?.params.url).toBe('https://github.com');
    expect(res2?.params.appName).toBe('chrome');

    const res3 = findFastPath('open openai.com');
    expect(res3?.tool).toBe('browser.navigate');
    expect(res3?.params.url).toBe('openai.com');
    expect(res3?.params.appName).toBeUndefined();
  });

  it('routes bare URLs, browse commands, and web search shortcuts directly via fast-path', () => {
    // Bare URLs
    const bareUrl1 = findFastPath('github.com');
    expect(bareUrl1?.tool).toBe('browser.navigate');
    expect(bareUrl1?.params.url).toBe('github.com');

    const bareUrl2 = findFastPath('https://news.ycombinator.com');
    expect(bareUrl2?.tool).toBe('browser.navigate');
    expect(bareUrl2?.params.url).toBe('https://news.ycombinator.com');

    // Browse and go to
    const browseRes = findFastPath('browse to docs.rs');
    expect(browseRes?.tool).toBe('browser.navigate');
    expect(browseRes?.params.url).toBe('docs.rs');

    const goToRes = findFastPath('go to https://anthropic.com in Brave');
    expect(goToRes?.tool).toBe('browser.navigate');
    expect(goToRes?.params.url).toBe('https://anthropic.com');
    expect(goToRes?.params.appName).toBe('Brave');

    // Direct Web searches
    const googleRes = findFastPath('google typescript 5.5 features');
    expect(googleRes?.tool).toBe('browser.search');
    expect(googleRes?.params.engine).toBe('google');
    expect(googleRes?.params.query).toBe('typescript 5.5 features');

    const ytRes = findFastPath('youtube lo-fi beats');
    expect(ytRes?.tool).toBe('browser.search');
    expect(ytRes?.params.engine).toBe('youtube');
    expect(ytRes?.params.query).toBe('lo-fi beats');

    const ghRes = findFastPath('search github for tauri plugins');
    expect(ghRes?.tool).toBe('browser.search');
    expect(ghRes?.params.engine).toBe('github');
    expect(ghRes?.params.query).toBe('tauri plugins');

    const webRes = findFastPath('search the web for quantum computing advances');
    expect(webRes?.tool).toBe('browser.search');
    expect(webRes?.params.engine).toBe('google');
    expect(webRes?.params.query).toBe('quantum computing advances');
  });
});
