/**
 * SynonymMap.ts — Centralized Verb & Noun Synonym Registry
 * 
 * Single source of truth for all synonym expansions used across:
 * - ToolSearcher (verb-aware scoring)
 * - Planner (disambiguation)
 * - EntityExtractor (fuzzy correction)
 * 
 * Adding a synonym here automatically improves matching everywhere.
 */

/** Verb synonym groups: key = canonical verb, values = all equivalent phrasings */
export const VerbSynonyms: Record<string, string[]> = {
  'create':    ['make', 'new', 'add', 'generate', 'build', 'setup', 'init', 'initialize', 'spawn', 'produce', 'set up', 'start'],
  'delete':    ['remove', 'erase', 'destroy', 'trash', 'wipe', 'purge', 'eliminate', 'clean', 'clear out', 'get rid of', 'nuke'],
  'navigate':  ['go', 'cd', 'enter', 'switch', 'jump', 'move', 'head', 'access', 'visit', 'change to', 'take me', 'bring me', 'goto', 'head to', 'head over'],
  'list':      ['show', 'display', 'view', 'see', 'enumerate', 'print', 'get', 'what', 'tell', 'reveal', 'check'],
  'search':    ['find', 'locate', 'look for', 'hunt', 'seek', 'where', 'discover', 'scan for', 'track down', 'look up'],
  'open':      ['launch', 'start', 'run', 'fire up', 'boot', 'activate', 'bring up', 'load', 'execute', 'spin up'],
  'close':     ['quit', 'exit', 'shut down', 'terminate', 'end', 'stop', 'kill', 'force quit', 'force close'],
  'connect':   ['join', 'pair', 'link', 'attach', 'bind', 'hook up', 'associate', 'couple'],
  'disconnect':['unpair', 'unlink', 'detach', 'drop', 'leave', 'part', 'sever'],
  'enable':    ['turn on', 'activate', 'switch on', 'power on', 'start', 'engage'],
  'disable':   ['turn off', 'deactivate', 'switch off', 'power off', 'stop', 'disengage'],
  'copy':      ['duplicate', 'clone', 'replicate', 'backup', 'back up', 'mirror'],
  'move':      ['transfer', 'relocate', 'shift', 'transport', 'migrate'],
  'rename':    ['name', 'retitle', 'relabel', 'change name'],
  'read':      ['cat', 'view', 'display', 'print', 'output', 'show contents', 'peek'],
  'install':   ['setup', 'set up', 'deploy', 'add', 'get', 'grab', 'fetch', 'download'],
  'update':    ['upgrade', 'refresh', 'patch', 'bump'],
  'compress':  ['zip', 'archive', 'tar', 'pack', 'bundle'],
  'extract':   ['unzip', 'untar', 'unpack', 'decompress', 'expand'],
};

/** Noun synonym groups: key = canonical noun, values = all equivalent terms */
export const NounSynonyms: Record<string, string[]> = {
  'folder':      ['directory', 'dir', 'path', 'location'],
  'file':        ['document', 'doc', 'item', 'asset'],
  'process':     ['task', 'job', 'daemon', 'service', 'pid'],
  'application': ['app', 'program', 'software', 'executable', 'binary'],
  'terminal':    ['console', 'shell', 'command line', 'cli', 'prompt'],
  'network':     ['internet', 'connection', 'wifi', 'ethernet', 'lan'],
  'bluetooth':   ['bt', 'wireless'],
  'port':        ['socket', 'endpoint', 'listener'],
  'container':   ['docker', 'pod', 'instance'],
  'repository':  ['repo', 'git repo', 'project', 'codebase'],
  'package':     ['module', 'dependency', 'library', 'lib'],
  'variable':    ['var', 'env var', 'environment variable', 'setting', 'config'],
};

/** Known website/service names that should route to browser, not filesystem */
export const WebDestinations: string[] = [
  'youtube', 'google', 'facebook', 'twitter', 'github', 'reddit',
  'stackoverflow', 'linkedin', 'amazon', 'netflix', 'instagram',
  'spotify', 'twitch', 'discord', 'slack', 'notion', 'figma',
  'vercel', 'netlify', 'heroku', 'aws', 'azure', 'firebase',
  'chatgpt', 'claude', 'gemini', 'perplexity', 'huggingface',
  'wikipedia', 'medium', 'dev.to', 'hackernews', 'producthunt',
  'dribbble', 'behance', 'pinterest', 'tiktok', 'whatsapp',
  'telegram', 'signal', 'zoom', 'teams', 'meet',
];

/** Common typo corrections for folder names */
export const FolderTypoCorrections: Record<string, string> = {
  'donwloads': 'Downloads', 'downlaods': 'Downloads', 'dwonloads': 'Downloads',
  'dowloads': 'Downloads', 'dwnload': 'Downloads', 'downlods': 'Downloads',
  'downloas': 'Downloads', 'donwload': 'Downloads', 'downlod': 'Downloads',
  'dekstop': 'Desktop', 'desktp': 'Desktop', 'deskop': 'Desktop',
  'dektsop': 'Desktop', 'desptok': 'Desktop', 'deskotp': 'Desktop',
  'documets': 'Documents', 'documens': 'Documents', 'documnets': 'Documents',
  'documetns': 'Documents', 'docuemnts': 'Documents', 'documentss': 'Documents',
  'pictues': 'Pictures', 'picutres': 'Pictures', 'picturs': 'Pictures',
  'applicaitons': 'Applications', 'applcations': 'Applications',
  'applicatons': 'Applications', 'aplications': 'Applications',
};

/** Common typo corrections for general terms */
export const GeneralTypoCorrections: Record<string, string> = {
  'enviornment': 'environment', 'envirnoment': 'environment', 'enviorment': 'environment',
  'environemnt': 'environment', 'enviornmental': 'environment',
  'proccess': 'process', 'proceses': 'processes', 'processs': 'process',
  'direcotry': 'directory', 'directroy': 'directory', 'diretory': 'directory',
  'termianl': 'terminal', 'termnial': 'terminal', 'terminla': 'terminal',
  'conncet': 'connect', 'conect': 'connect', 'connct': 'connect',
  'disconect': 'disconnect', 'disconnct': 'disconnect',
  'bluethooth': 'bluetooth', 'bluetooh': 'bluetooth', 'blutooth': 'bluetooth',
  'seach': 'search', 'serach': 'search', 'saerch': 'search',
  'naviagte': 'navigate', 'naviage': 'navigate', 'navigte': 'navigate',
  'delte': 'delete', 'deleet': 'delete', 'deelte': 'delete',
  'cretae': 'create', 'craete': 'create', 'creat': 'create',
  'opne': 'open', 'oepn': 'open',
  'clsoe': 'close', 'closee': 'close',
  'runing': 'running', 'runnign': 'running',
  'currrent': 'current', 'curretn': 'current', 'curent': 'current',
  'comand': 'command', 'commnad': 'command', 'commmand': 'command',
  'insatll': 'install', 'isntall': 'install', 'intall': 'install',
  'calednar': 'calendar', 'calender': 'calendar', 'calnedar': 'calendar',
};

/**
 * Utility: Levenshtein distance for fuzzy matching
 */
export function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[a.length][b.length];
}

/**
 * Utility: Get canonical verb for a given word.
 * Returns the canonical form if the word is a known synonym, otherwise returns the word itself.
 */
export function getCanonicalVerb(word: string): string {
  const lower = word.toLowerCase().trim();
  for (const [canonical, synonyms] of Object.entries(VerbSynonyms)) {
    if (lower === canonical || synonyms.includes(lower)) {
      return canonical;
    }
  }
  return lower;
}

/**
 * Utility: Get all synonyms for a verb (including the canonical form).
 */
export function getVerbSynonyms(verb: string): string[] {
  const canonical = getCanonicalVerb(verb);
  const synonyms = VerbSynonyms[canonical];
  if (synonyms) {
    return [canonical, ...synonyms];
  }
  return [verb.toLowerCase()];
}

/**
 * Utility: Check if two verbs are synonymous.
 */
export function areVerbsSynonymous(verb1: string, verb2: string): boolean {
  return getCanonicalVerb(verb1) === getCanonicalVerb(verb2);
}

/**
 * Utility: Correct common typos in a string.
 * Applies both folder-specific and general typo corrections.
 */
export function correctTypos(input: string): string {
  let result = input;
  const words = input.split(/\s+/);
  for (const word of words) {
    const lower = word.toLowerCase();
    const folderFix = FolderTypoCorrections[lower];
    const generalFix = GeneralTypoCorrections[lower];
    if (folderFix) {
      result = result.replace(new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi'), folderFix);
    } else if (generalFix) {
      result = result.replace(new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi'), generalFix);
    }
  }
  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
