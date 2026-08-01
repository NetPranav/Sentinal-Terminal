/**
 * Planner.ts — Local Intent Multi-Step Task Decomposition
 * 
 * Converts unrestricted natural language into sequential task arrays composed of Tool IDs and extracted entities.
 * Determines dependencies and sequencing without generating workflows or shell commands.
 */

import { ModelManager } from '../management/ModelManager';
import { ContextBuilder } from './ContextBuilder';
import { EntityExtractor, ExtractedEntities } from './EntityExtractor';
import { ToolSearcher } from '../../tools/search/ToolSearcher';

export interface PlannedTask {
  tool: string;
  entities: Record<string, any>;
}

export interface StructuredPlan {
  goal: string;
  confidence: number;
  tasks: PlannedTask[];
  rawGeneration?: boolean;
}

export class Planner {
  private extractor: EntityExtractor;
  private searcher: ToolSearcher;

  constructor(private modelManager: ModelManager, private contextBuilder: ContextBuilder) {
    this.extractor = new EntityExtractor();
    this.searcher = this.contextBuilder.getToolSearcher();
  }

  /**
   * Generates a structured sequential execution plan from natural language.
   * Leverages fast heuristic task decomposition and local AI inference when available.
   */
  public async generatePlan(query: string): Promise<StructuredPlan> {
    const clean = query.replace(/^[\s>\$#\-:]+/, '').trim();

    // 1. Extract global entities from prompt
    const globalEntities = this.extractor.extract(clean);

    // 2. Try fast sequential clause splitting for multi-step instructions
    // e.g. "Open Chrome. Go to YouTube. Search for AI." or "Turn on bluetooth and connect my headphones"
    const clauses = this.splitIntoClauses(clean);
    const tasks: PlannedTask[] = [];
    let activeContextPath: string | undefined = undefined;

    for (const clause of clauses) {
      const clauseEntities = this.extractor.extract(clause);
      const combinedEntities: Record<string, any> = { ...clauseEntities };

      // Clean up empty entity arrays
      for (const key of Object.keys(combinedEntities)) {
        if (Array.isArray(combinedEntities[key]) && combinedEntities[key].length === 0) {
          delete combinedEntities[key];
        } else if (Array.isArray(combinedEntities[key]) && combinedEntities[key].length >= 1) {
          if (key === 'bluetooth_devices' || key === 'device_names') {
            combinedEntities['device'] = combinedEntities[key][0];
          }
          if (key === 'SSID') {
            combinedEntities['ssid'] = combinedEntities[key][0];
          }
          if (key === 'applications') {
            combinedEntities['app'] = combinedEntities[key][0];
          }
          if (key === 'URLs') {
            combinedEntities['url'] = combinedEntities[key][0];
          }
          if (key === 'paths' || key === 'folders') {
            combinedEntities['path'] = combinedEntities[key][0];
            combinedEntities['directory'] = combinedEntities[key][0];
          }
          if (key === 'files') {
            combinedEntities['file'] = combinedEntities[key][0];
            if (!combinedEntities['path']) combinedEntities['path'] = combinedEntities[key][0];
          }
          if (key === 'processes' || key === 'process') {
            combinedEntities['process'] = combinedEntities[key][0];
            if (!combinedEntities['app']) combinedEntities['app'] = combinedEntities[key][0];
          }
        }
      }

      // Inherit active contextual folder from earlier sequential tasks if spatial reference is used
      if (activeContextPath && combinedEntities.files && Array.isArray(combinedEntities.files)) {
        combinedEntities.files = combinedEntities.files.map((f: string) => 
          (f.startsWith('~/') || f.startsWith('/') || f.includes('/')) ? f : `${activeContextPath}/${f.replace(/^\.\//, '')}`
        );
        combinedEntities['file'] = combinedEntities.files[0];
        combinedEntities['path'] = combinedEntities.files[0];
      }
      if (activeContextPath && !combinedEntities['path'] && !combinedEntities.folders && !combinedEntities.files) {
        if (clause.toLowerCase().includes('it') || clause.toLowerCase().includes('there') || clause.toLowerCase().includes('that')) {
          combinedEntities['path'] = activeContextPath;
          combinedEntities['directory'] = activeContextPath;
        }
      }

      // Find tool match for this specific clause
      const match = this.searcher.findBestMatch(clause, undefined, combinedEntities);
      let toolId = match ? match.tool.definition.id : 'unknown.tool';

      // Special semantic pattern matching for example test cases & native OS capabilities
      const clauseLower = clause.toLowerCase();
      const isFolderQuery = combinedEntities['path'] || clauseLower.includes('folder') || clauseLower.includes('fodler') || clauseLower.includes('dir') || clauseLower.includes('download') || clauseLower.includes('donwload') || clauseLower.includes('downlod') || clauseLower.includes('desktop') || clauseLower.includes('document');

      if (clauseLower.includes('turn on bluetooth') || clauseLower === 'turn bluetooth on' || clauseLower === 'enable bluetooth') {
        toolId = 'network.bluetooth.on';
      } else if (clauseLower.includes('turn off bluetooth') || clauseLower === 'turn bluetooth off' || clauseLower === 'disable bluetooth') {
        toolId = 'network.bluetooth.off';
      } else if (clauseLower.includes('turn on wifi') || clauseLower.includes('turn wifi on') || clauseLower.includes('enable wifi') || clauseLower.includes('turn the wifi on') || ((clauseLower.includes('wifi') || clauseLower.includes('wi-fi')) && clauseLower.includes('on') && !clauseLower.includes('connect'))) {
        toolId = 'network.wifi.on';
      } else if (clauseLower.includes('turn off wifi') || clauseLower.includes('turn wifi off') || clauseLower.includes('disable wifi') || clauseLower.includes('turn the wifi off') || ((clauseLower.includes('wifi') || clauseLower.includes('wi-fi')) && clauseLower.includes('off'))) {
        toolId = 'network.wifi.off';
      } else if (clauseLower.includes('connect my headphones') || clauseLower.includes('connect headphones') || (clauseLower.includes('pair') && !clauseLower.includes('wifi')) || (clauseLower.includes('connect') && (clauseLower.includes('bluetooth') || clauseLower.includes('bt') || clauseLower.includes('airpod') || clauseLower.includes('earbud') || clauseLower.includes('speaker') || clauseLower.includes('mouse') || clauseLower.includes('keyboard')))) {
        toolId = 'network.bluetooth.connect';
        if (!combinedEntities.device && clauseLower.includes('headphones')) combinedEntities.device = 'headphones';
      } else if (clauseLower.includes('connect ') || clauseLower.includes('join ') || clauseLower.startsWith('connect')) {
        if (combinedEntities.ssid || clauseLower.includes('wifi') || clauseLower.includes('wi-fi') || clauseLower.includes('network') || clauseLower.includes('phone') || clauseLower.includes('5g') || clauseLower.includes('4g') || clauseLower.includes('fiber') || clauseLower.includes('hotspot') || clauseLower.includes('airtel') || clauseLower.includes('jio') || (!clauseLower.includes('bluetooth') && !clauseLower.includes('headphone') && !clauseLower.includes('airpod') && !clauseLower.includes('speaker'))) {
          toolId = 'network.wifi.connect';
          const extractedSsid = combinedEntities.ssid || combinedEntities.device || combinedEntities.SSID?.[0] || clause.replace(/^.*(?:connect|join)\s+(?:(?:me|it|us|device|my|the|wifi|network)\s+)*(?:to|with|from)?\s*/i, '').trim();
          combinedEntities.ssid = extractedSsid;
          delete combinedEntities.device;
          delete combinedEntities.device_names;
          delete combinedEntities.bluetooth_devices;
        } else if (combinedEntities.device) {
          toolId = 'network.bluetooth.connect';
        }
      } else if (clauseLower.includes('where') || clauseLower.includes('what is the path') || clauseLower.includes('tell me the path') || clauseLower.includes('find folder') || clauseLower.includes('find file') || clauseLower.includes('locate folder') || clauseLower.includes('locate file') || clauseLower.includes('search folder') || clauseLower.includes('search file') || (clauseLower.includes('locate') && (clauseLower.includes('folder') || clauseLower.includes('file') || clauseLower.includes('directory')))) {
        toolId = 'filesystem.search';
        if (!combinedEntities.size) {
          const szMatch = clause.match(/(?:(larger|bigger|greater|over|above|exceeding)|(smaller|less|under|below))\s*(?:than\s*)?(\d+(?:\.\d+)?)\s*(mb|mbs|gb|gbs|kb|kbs|bytes?|b|m|k|g)\b/i);
          if (szMatch && (szMatch[1] || szMatch[2])) {
            const isLarger = Boolean(szMatch[1]);
            const num = szMatch[3];
            const uStr = (szMatch[4] || '').toLowerCase().replace(/s$/, '');
            let u = 'M';
            if (uStr === 'kb' || uStr === 'k') u = 'k'; else if (uStr === 'gb' || uStr === 'g') u = 'G'; else if (uStr === 'byte' || uStr === 'b' || uStr === 'c') u = 'c';
            combinedEntities.size = `${isLarger ? '+' : '-'}${num}${u}`;
          }
        }
        if (!combinedEntities.pattern && !combinedEntities.query) {
          const extMatch = clause.match(/\b(pdf|png|jpg|jpeg|gif|svg|mp4|mp3|mov|avi|zip|tar|gz|txt|md|json|yaml|yml|ts|js|py|rs|go|html|css|sql|csv|doc|docx|xls|xlsx|ppt|pptx)s?\b/i);
          if (extMatch && extMatch[1]) {
            const ext = extMatch[1].toLowerCase();
            combinedEntities.pattern = `*.${ext}`;
            combinedEntities.query = `*.${ext}`;
          } else {
            const match = clause.match(/(?:where|path|find|locate|search)\s+(?:(?:is|are|of|for|did\s+you\s+(?:create|make|save|put)|did\s+it\s+(?:create|make|save|put)|to|the|my|a|an)\s+)*(?:(?:folder|directory|dir|file|app|application)\s+)*(?:named?|called)?\s*["']?([a-zA-Z0-9_\-\.]+)/i);
            const name = match && match[1] ? match[1].replace(/\s+(?:folder|directory|dir|file)$/i, '').trim() : (combinedEntities.folders?.[0] || combinedEntities.files?.[0] || 'folder');
            combinedEntities.pattern = name;
            combinedEntities.query = name;
          }
        }
        if (!combinedEntities.dir) {
          combinedEntities.dir = /(?:where|path)/i.test(clause) ? '~' : '.';
        }
      } else if (clauseLower.includes('make a new folder') || clauseLower.includes('create a new folder') || clauseLower.includes('make folder') || clauseLower.includes('create folder') || clauseLower.includes('new folder') || clauseLower.includes('mkdir') || clauseLower.includes('make dir') || clauseLower.includes('create dir') || clauseLower.includes('make a folder') || clauseLower.includes('create a folder') || (clauseLower.includes('make') && clauseLower.includes('folder'))) {
        toolId = 'filesystem.mkdir';
      } else if (clauseLower.includes('make a new file') || clauseLower.includes('create a new file') || clauseLower.includes('make file') || clauseLower.includes('create file') || clauseLower.includes('new file') || clauseLower.includes('touch file') || clauseLower.includes('make a file') || clauseLower.includes('create a file') || (clauseLower.includes('make') && (clauseLower.includes('file') || clauseLower.includes('files'))) || (clauseLower.includes('create') && (clauseLower.includes('file') || clauseLower.includes('files'))) || (clauseLower.includes('touch') && (clauseLower.includes('file') || clauseLower.includes('files')))) {
        toolId = 'filesystem.create';
      } else if (clauseLower.includes('delete file') || clauseLower.includes('delete folder') || clauseLower.includes('remove file') || clauseLower.includes('remove folder') || clauseLower.includes('permanently delete') || (clauseLower.includes('delete') && (clauseLower.includes('file') || clauseLower.includes('folder') || clauseLower.includes('dir')))) {
        toolId = 'filesystem.delete';
      } else if ((clauseLower.includes('go to ') || clauseLower.includes('navigate to ') || clauseLower.includes('take me to ') || clauseLower.includes('bring me to ') || clauseLower.includes('head to ') || clauseLower.includes('switch to ') || clauseLower.includes('jump to ') || clauseLower.includes('move to ') || clauseLower.includes('cd into ') || clauseLower.includes('cd ') || clauseLower.includes('enter ')) && isFolderQuery && !clauseLower.includes('list ') && !clauseLower.includes('show ') && !clauseLower.includes('view ') && !clauseLower.includes('content') && !clauseLower.includes('files in') && !clauseLower.includes('what is in')) {
        toolId = 'filesystem.navigate';
        if (!combinedEntities['path'] && !combinedEntities['directory']) {
          const m = clause.match(/(?:to|into|enter)\s+(.+?)(?:\s+(?:folder|directory|dir))?$/i);
          const rawPath = m ? m[1].replace(/\s*(?:folder|directory|dir)\s*$/i, '').trim() : '.';
          combinedEntities['path'] = rawPath;
          combinedEntities['directory'] = rawPath;
        }
      } else if ((clauseLower.includes('content of') || clauseLower.includes('contents of') || clauseLower.includes('what is in') || clauseLower.includes('files in') || clauseLower.includes('files inside') || ((clauseLower.includes('show ') || clauseLower.includes('list ') || clauseLower.includes('view ')) && !clauseLower.includes('bluetooth') && !clauseLower.includes('wifi') && !clauseLower.includes('network'))) && isFolderQuery) {
        toolId = 'filesystem.list';
        if (!combinedEntities['path'] && !combinedEntities['directory']) {
          const m = clause.match(/(?:to|of|in|inside|show|list|view)\s+([^\s]+)/i);
          const rawPath = m ? m[1].trim() : '~/Downloads';
          combinedEntities['path'] = rawPath;
          combinedEntities['directory'] = rawPath;
        }
      } else if (!/\b(?:kill|terminate|pkill|killall|stop|quit|close)\b/.test(clauseLower) && (clauseLower.includes('vscode') || clauseLower.includes('visual studio code') || clauseLower.includes('vs code') || clauseLower.includes('code .') || (clauseLower.includes('open ') && (clauseLower.includes('code') || clauseLower.includes('vs'))))) {
        toolId = 'developer.vscode';
        combinedEntities.path = this.resolveFolderPath(clause, combinedEntities, activeContextPath);
      } else if (!/\b(?:kill|terminate|pkill|killall|stop|quit|close)\b/.test(clauseLower) && (clauseLower.includes('cursor') || clauseLower.includes('cursor ai') || (clauseLower.includes('open ') && clauseLower.includes('cursor')))) {
        toolId = 'developer.cursor';
        combinedEntities.path = this.resolveFolderPath(clause, combinedEntities, activeContextPath);
      } else if (!/\b(?:kill|terminate|pkill|killall|stop|quit|close)\b/.test(clauseLower) && (clauseLower.includes('antigravity') || (clauseLower.includes('open ') && clauseLower.includes('antigravity')))) {
        toolId = 'application.open';
        combinedEntities.app = 'Antigravity IDE';
        combinedEntities.args = [this.resolveFolderPath(clause, combinedEntities, activeContextPath)];
      } else if (!/\b(?:kill|terminate|pkill|killall|stop|quit|close)\b/.test(clauseLower) && (clauseLower.includes('xcode') || clauseLower.includes('open in xcode') || clauseLower.includes('ios project'))) {
        toolId = 'developer.xcode';
        combinedEntities.path = this.resolveFolderPath(clause, combinedEntities, activeContextPath);
      } else if (!/\b(?:kill|terminate|pkill|killall|stop|quit|close)\b/.test(clauseLower) && (clauseLower.includes('android studio') || clauseLower.includes('open in android studio'))) {
        toolId = 'developer.android_studio';
        combinedEntities.path = this.resolveFolderPath(clause, combinedEntities, activeContextPath);
      } else if (clauseLower.includes('jupyter') || clauseLower.includes('notebook') || clauseLower.includes('data science server')) {
        toolId = 'python.notebook';
      } else if (clauseLower.includes('open ') || clauseLower.includes('launch ')) {
        toolId = 'application.open';
        const openInMatch = clause.match(/(?:open|launch)\s+(.+?)\s+(?:in|inside|using|with|via|on|at)\s+([a-z0-9_\-\.\s]+)$/i);
        if (openInMatch && openInMatch[1] && openInMatch[2]) {
          combinedEntities.app = openInMatch[2].trim().replace(/^(?:the|my|a|an)\s+/i, '');
          const targetArg = this.resolveFolderPath(openInMatch[1].trim(), combinedEntities);
          combinedEntities.url = targetArg;
          combinedEntities.args = [targetArg];
        } else {
          if (!combinedEntities.app) combinedEntities.app = (combinedEntities['path'] || clause.replace(/^.*(?:open|launch)\s+/i, '').trim()).replace(/^(?:the|my|a|an)\s+/i, '');
        }
      } else if ((clauseLower.includes('go to ') || clauseLower.includes('navigate ')) && (clauseLower.includes('http') || clauseLower.includes('.com') || clauseLower.includes('youtube') || clauseLower.includes('google') || clauseLower.includes('website') || clauseLower.includes('page') || combinedEntities.url)) {
        toolId = 'browser.navigate';
        if (!combinedEntities.url && clauseLower.includes('youtube')) combinedEntities.url = 'https://youtube.com';
      } else if (clauseLower.includes('search for ') || clauseLower.startsWith('search ')) {
        toolId = 'browser.search';
        if (!combinedEntities.query) combinedEntities.query = clause.replace(/^.*search (for )?/i, '').trim();
      } else if (clauseLower.includes('show all the bluetooth devices') || clauseLower.includes('show all bluetooth devices') || clauseLower.includes('list bluetooth')) {
        toolId = 'network.bluetooth.list';
      } else if (clauseLower.includes('kill') || clauseLower.includes('terminate') || clauseLower.includes('pkill') || clauseLower.includes('killall') || clauseLower.includes('force quit') || clauseLower.includes('force close') || clauseLower.includes('end task') || clauseLower.startsWith('stop ') || clauseLower.includes(' stop ') || clauseLower.includes('stop all') || clauseLower.includes('stop any')) {
        if (clauseLower.includes('force quit') || clauseLower.includes('force close') || (clauseLower.includes('kill') && clauseLower.includes('app'))) {
          toolId = 'application.force_quit';
        } else {
          toolId = 'system.kill_process';
        }
        if (!combinedEntities.process && !combinedEntities.app) {
          let target = clause.replace(/^.*(?:kill|terminate|stop|end|pkill|killall|force\s+quit|force\s+close)\s+/i, '').trim();
          const cleanWords = /^(?:entirely|completely|all|the|any|every|active|running|processes|process|services|service|apps|app|applications|application|tasks|task|of|called|named|with\s+name|by\s+name|using\s+port|using\s+pid|using|on\s+port|on\s+pid|on|at\s+port|at\s+pid|at|port|pid)\s+/i;
          while (cleanWords.test(target)) {
            target = target.replace(cleanWords, '').trim();
          }
          target = target.replace(/\s+(?:processes|process|services|service|apps|app|applications|application|tasks|task)$/i, '').trim();
          target = target.replace(/["'.!;,?]/g, '').trim();
          if (!target || ['process', 'app', 'application', 'task', 'any'].includes(target.toLowerCase())) {
            target = combinedEntities.applications?.[0] || combinedEntities.processes?.[0] || 'any';
          }
          combinedEntities.process = target;
          combinedEntities.app = target;
        }
      } else if (clauseLower.includes('port') || clauseLower.includes('ports') || clauseLower.includes('socket') || clauseLower.includes('lsof') || clauseLower.includes('netstat')) {
        toolId = 'network.ports';
        if (!combinedEntities.port) {
          const m = clause.match(/port\s*[:=]?\s*(\d{2,5})/i) || clause.match(/\b(\d{2,5})\b/);
          if (m && m[1]) {
            const portNum = parseInt(m[1], 10);
            if (portNum > 0 && portNum <= 65535) {
              combinedEntities.port = portNum;
            }
          }
        }
      } else if (clauseLower.includes('process') || clauseLower.includes('processes') || clauseLower.includes('activity monitor') || clauseLower.includes('top process') || clauseLower === 'ps' || clauseLower === 'ps aux' || clauseLower === 'top' || clauseLower === 'htop' || clauseLower === 'btop' || clauseLower === 'glances') {
        toolId = 'system.processes';
      } else if (
        clauseLower.includes('list running app') || clauseLower.includes('show running app') || clauseLower.includes('active app') ||
        ((clauseLower.includes('app') || clauseLower.includes('applic') || clauseLower.includes('program')) && (clauseLower.includes('runn') || clauseLower.includes('activ') || clauseLower.includes('open') || clauseLower.includes('list') || clauseLower.includes('show') || clauseLower.includes('what')))
      ) {
        toolId = 'application.list_running';
      } else if (clauseLower === 'clear' || clauseLower.includes('clear terminal') || clauseLower.includes('clear screen') || clauseLower.includes('clean screen') || clauseLower.includes('clean terminal')) {
        toolId = 'shell.execute';
        combinedEntities.command = 'clear';
      } else if (clauseLower.includes('who am i') || clauseLower.includes('whoami') || clauseLower === 'who' || clauseLower.includes('current user') || clauseLower.includes('my username')) {
        toolId = 'shell.execute';
        combinedEntities.command = 'whoami';
      } else if (clauseLower.includes('enviorn') || clauseLower.includes('environ') || clauseLower.includes('env var') || clauseLower === 'env' || clauseLower === 'show env' || clauseLower === 'printenv' || clauseLower.includes('environment variables') || clauseLower.includes('env variables')) {
        toolId = 'shell.execute';
        combinedEntities.command = 'env';
      } else if (clauseLower.includes('what time') || clauseLower.includes('current time') || clauseLower.includes('show time') || clauseLower.includes('what is the time') || clauseLower.includes('date today') || clauseLower.includes('current date') || clauseLower.includes('show date') || clauseLower === 'date' || clauseLower === 'time') {
        toolId = 'shell.execute';
        combinedEntities.command = 'date';
      } else if (clauseLower.includes('cal ') || clauseLower.includes('calendar') || clauseLower === 'cal') {
        toolId = 'shell.execute';
        combinedEntities.command = 'cal';
      } else if (clauseLower.includes('view file') || clauseLower.includes('read file') || clauseLower.includes('show file') || clauseLower.includes('display file') || clauseLower.startsWith('cat ') || clauseLower.includes('contents of file') || (clauseLower.includes('open file') && (clauseLower.includes('terminal') || clauseLower.includes('here') || clauseLower.includes('read')))) {
        toolId = 'filesystem.read';
        if (!combinedEntities['file'] && !combinedEntities['path']) {
          const m = clause.match(/(?:file|cat|of|read|view|show|display)\s+["']?([^\s,;:"'!?]+)/i);
          if (m && m[1]) {
            combinedEntities['file'] = m[1];
            combinedEntities['path'] = m[1];
          }
        }
      } else if (clauseLower.includes('copy file') || clauseLower.includes('duplicate file') || clauseLower.includes('copy folder') || clauseLower.startsWith('cp ')) {
        toolId = 'filesystem.copy';
      } else if (clauseLower.includes('move file') || clauseLower.includes('rename file') || clauseLower.includes('move folder') || clauseLower.includes('rename folder') || clauseLower.startsWith('mv ')) {
        toolId = 'filesystem.move';
      } else if (clauseLower.startsWith('find ') || clauseLower.startsWith('search for file') || clauseLower.startsWith('search for folder') || clauseLower.startsWith('locate ') || clauseLower.includes('find every ') || clauseLower.includes('find all ') || clauseLower.includes('find any ') || (clauseLower.includes('find') && (clauseLower.includes('larger than') || clauseLower.includes('smaller than') || clauseLower.includes('mb') || clauseLower.includes('gb') || clauseLower.includes('kb')))) {
        toolId = 'filesystem.search';
        if (!combinedEntities.dir) combinedEntities.dir = '.';
      } else if (clauseLower.includes('system info') || clauseLower.includes('about mac') || clauseLower.includes('my specs') || clauseLower.includes('computer specs') || clauseLower.includes('os version')) {
        toolId = 'system.info';
      } else if (clauseLower.includes('battery') || clauseLower.includes('power remaining') || clauseLower.includes('charging status')) {
        toolId = 'system.battery';
      } else if (clauseLower.includes('cpu usage') || clauseLower.includes('processor load') || clauseLower.includes('check cpu')) {
        toolId = 'system.cpu';
      } else if (clauseLower.includes('ram usage') || clauseLower.includes('memory usage') || clauseLower.includes('check ram') || clauseLower.includes('free memory') || clauseLower.includes('how much ram')) {
        toolId = 'system.ram';
      } else if (clauseLower.includes('disk space') || clauseLower.includes('disk usage') || clauseLower.includes('storage left') || clauseLower.includes('free storage') || clauseLower.includes('check storage') || clauseLower === 'df' || clauseLower === 'df -h') {
        toolId = 'system.storage';
      } else if (clauseLower.includes('temperature') || clauseLower.includes('cpu temp') || clauseLower.includes('running hot') || clauseLower.includes('thermal')) {
        toolId = 'system.temperature';
      } else if (clauseLower.includes('uptime') || clauseLower.includes('how long has computer been running') || clauseLower.includes('boot duration')) {
        toolId = 'system.uptime';
      } else if (clauseLower.includes('what is my ip') || clauseLower.includes('my ip address') || clauseLower.includes('show ip') || clauseLower.includes('get ip') || clauseLower.includes('public ip')) {
        toolId = 'network.ip';
      } else if (clauseLower.includes('ping ') || clauseLower.includes('test connection') || clauseLower.includes('check internet')) {
        toolId = 'network.ping';
      } else if (clauseLower.includes('open ports') || clauseLower.includes('listening ports') || clauseLower.includes('show ports')) {
        toolId = 'network.ports';
      } else if (clauseLower.includes('gpu') || clauseLower.includes('graphics card') || clauseLower.includes('vram')) {
        toolId = 'system.gpu';
      } else if (clauseLower.startsWith('git ') || clauseLower.includes('git repo') || clauseLower.includes('git branch') || clauseLower.includes('git commit') || clauseLower.includes('git status') || clauseLower.includes('git history')) {
        if (clauseLower.includes('clone') || clauseLower.includes('download repo')) { toolId = 'git.clone'; }
        else if (clauseLower.includes('log') || clauseLower.includes('history') || clauseLower.includes('commit history')) { toolId = 'git.log'; }
        else if (clauseLower.includes('commit') || clauseLower.includes('record commit')) { toolId = 'git.commit'; }
        else if (clauseLower.includes('push') || clauseLower.includes('upload commit')) { toolId = 'git.push'; }
        else if (clauseLower.includes('pull') || clauseLower.includes('fetch update')) { toolId = 'git.pull'; }
        else if (clauseLower.includes('checkout') || clauseLower.includes('switch branch')) { toolId = 'git.checkout'; }
        else if (clauseLower.includes('merge')) { toolId = 'git.merge'; }
        else if (clauseLower.includes('stash')) { toolId = 'git.stash'; }
        else if (clauseLower.includes('diff') || clauseLower.includes('show changes')) { toolId = 'git.diff'; }
        else if (clauseLower.includes('branch') || clauseLower.includes('list branch')) { toolId = 'git.branch'; }
        else { toolId = 'shell.execute'; combinedEntities.command = clause; }
      } else if (clauseLower.includes('docker ') || clauseLower.includes('container') || clauseLower.includes('compose')) {
        if (clauseLower.includes('image') || clauseLower.includes('cached image')) { toolId = 'docker.images'; }
        else if (clauseLower.includes('log') || clauseLower.includes('container log')) { toolId = 'docker.logs'; }
        else if (clauseLower.includes('exec') || clauseLower.includes('run inside container')) { toolId = 'docker.exec'; }
        else if (clauseLower.includes('compose up') || clauseLower.includes('start stack')) { toolId = 'docker.compose_up'; }
        else if (clauseLower.includes('compose down') || clauseLower.includes('stop stack')) { toolId = 'docker.compose_down'; }
        else if (clauseLower.includes('stop') || clauseLower.includes('halt container')) { toolId = 'docker.stop'; }
        else if (clauseLower.includes('restart') || clauseLower.includes('reboot container')) { toolId = 'docker.restart'; }
        else { toolId = 'docker.ps'; }
      } else if (clauseLower.includes('npm install') || clauseLower.includes('install npm') || clauseLower.includes('npm i') || clauseLower.includes('node package')) {
        toolId = 'node.npm_install';
      } else if (clauseLower.includes('npm run') || clauseLower.includes('npm start') || clauseLower.includes('npm test') || clauseLower.includes('npm dev')) {
        toolId = 'node.npm_run';
      } else if (clauseLower.includes('pnpm ')) {
        toolId = 'node.pnpm';
      } else if (clauseLower.includes('bun ')) {
        toolId = 'node.bun';
      } else if (clauseLower.includes('yarn ')) {
        toolId = 'node.yarn';
      } else if (clauseLower.includes('python venv') || clauseLower.includes('create venv') || clauseLower.includes('virtual environment') || clauseLower.includes('virtualenv')) {
        toolId = 'python.create_venv';
      } else if (clauseLower.includes('pip install') || clauseLower.includes('install python package') || clauseLower.includes('pip add')) {
        toolId = 'python.pip_install';
      } else if (clauseLower.includes('run python') || clauseLower.includes('execute python') || clauseLower.endsWith('.py')) {
        toolId = 'python.run_script';
      } else if (clauseLower.includes('dns ') || clauseLower.includes('nslookup') || clauseLower.includes('dig ') || clauseLower.includes('domain records')) {
        toolId = 'network.dns';
      } else if (clauseLower.includes('traceroute') || clauseLower.includes('trace hops') || clauseLower.includes('network path')) {
        toolId = 'network.traceroute';
      } else if (clauseLower.includes('network interface') || clauseLower.includes('adapter') || clauseLower.includes('ifconfig') || clauseLower.includes('mac address')) {
        toolId = 'network.interfaces';
      } else if (clauseLower.includes('scan wifi') || clauseLower.includes('list wifi') || clauseLower.includes('available wifi') || clauseLower.includes('nearby wireless')) {
        toolId = 'network.wifi.scan';
      } else if (clauseLower.includes('zip ') || clauseLower.includes('compress ') || clauseLower.includes('tar ') || clauseLower.includes('create archive')) {
        toolId = 'filesystem.compress';
      } else if (clauseLower.includes('unzip ') || clauseLower.includes('extract ') || clauseLower.includes('decompress ') || clauseLower.includes('untar ')) {
        toolId = 'filesystem.extract';
      } else if (clauseLower.includes('chmod ') || clauseLower.includes('file permission') || clauseLower.includes('chown ') || clauseLower.includes('access rights')) {
        toolId = 'filesystem.permissions';
      } else if (clauseLower.includes('disk usage') || clauseLower.includes('folder size') || clauseLower.includes('how large is') || clauseLower.includes('du -h')) {
        toolId = 'filesystem.disk_usage';
      } else if (clauseLower.includes('recent file') || clauseLower.includes('recently edited') || clauseLower.includes('latest files')) {
        toolId = 'filesystem.recent_files';
      } else if (clauseLower.includes('trash') || clauseLower.includes('recycle bin') || clauseLower.includes('move to trash')) {
        toolId = 'filesystem.trash';
      } else if (clauseLower.includes('grep ') || clauseLower.includes('search inside') || clauseLower.includes('find text') || (clauseLower.includes('search') && clauseLower.includes('content'))) {
        toolId = 'filesystem.grep';
      } else if (clauseLower.includes('install ') && !clauseLower.includes('npm') && !clauseLower.includes('pip') && !clauseLower.includes('wifi') && !clauseLower.includes('package')) {
        toolId = 'application.install';
      } else if (clauseLower.includes('uninstall ') || (clauseLower.includes('remove ') && clauseLower.includes('app'))) {
        toolId = 'application.uninstall';
      } else if (clauseLower.includes('minimize') || clauseLower.includes('hide window')) {
        toolId = 'application.minimize';
      } else if (clauseLower.includes('maximize') || clauseLower.includes('fullscreen') || clauseLower.includes('full screen')) {
        toolId = 'application.maximize';
      } else if (clauseLower.includes('focus') || clauseLower.includes('bring to front')) {
        toolId = 'application.focus';
      } else if (clauseLower.includes('browser history') || (clauseLower.includes('history') && clauseLower.includes('web')) || clauseLower.includes('visited site')) {
        toolId = 'browser.history';
      } else if (clauseLower.includes('reload') && (clauseLower.includes('tab') || clauseLower.includes('page') || clauseLower.includes('browser')) || clauseLower.includes('refresh page')) {
        toolId = 'browser.reload';
      } else if (clauseLower.includes('close tab') || clauseLower.includes('close browser tab')) {
        toolId = 'browser.close_tabs';
      }

      if (toolId === 'unknown.tool') {
        // Intelligent Terminal Shell fallback for general user-friendly terminal tasks
        if (
          clauseLower.includes('date') || clauseLower.includes('time') || clauseLower.includes('clock') ||
          clauseLower.includes('cal') || clauseLower.includes('calendar') ||
          clauseLower.includes('whoami') || clauseLower.includes('user') ||
          clauseLower.includes('clear') || clauseLower.includes('env') ||
          clauseLower.includes('history') || clauseLower.includes('version') ||
          clauseLower.includes('curl ') || clauseLower.includes('wget ') ||
          clauseLower.includes('brew ') || clauseLower.includes('echo ') ||
          clauseLower.includes('show me') || clauseLower.includes('check ') ||
          clauseLower.includes('what is') || clauseLower.includes('how many') ||
          clauseLower.startsWith('run ') || clauseLower.startsWith('exec ')
        ) {
          if (clauseLower !== 'do something') {
            toolId = 'shell.execute';
            let cmd = clause;
            if (clauseLower.includes('date') || clauseLower.includes('time') || clauseLower.includes('clock')) cmd = 'date';
            else if (clauseLower.includes('cal') || clauseLower.includes('calendar')) cmd = 'cal';
            else if (clauseLower.includes('whoami') || clauseLower.includes('who am i') || clauseLower.includes('current user')) cmd = 'whoami';
            else if (clauseLower.includes('clear')) cmd = 'clear';
            else if (clauseLower.includes('env')) cmd = 'env';
            combinedEntities.command = cmd;
          }
        }
      }

      if ((toolId === 'filesystem.mkdir' || toolId === 'filesystem.navigate') && (combinedEntities.folders?.[0] || combinedEntities['path'] || combinedEntities['directory'])) {
        activeContextPath = combinedEntities.folders?.[0] || combinedEntities['path'] || combinedEntities['directory'];
      }

      if (toolId === 'filesystem.create' && combinedEntities.files && Array.isArray(combinedEntities.files) && combinedEntities.files.length > 1) {
        for (const f of combinedEntities.files) {
          tasks.push({
            tool: 'filesystem.create',
            entities: { ...combinedEntities, file: f, path: f, files: [f] }
          });
        }
        continue;
      }

      tasks.push({
        tool: toolId,
        entities: combinedEntities
      });
    }

    // Determine high-level goal summary
    const goalSummary = this.summarizeGoal(clean, tasks);

    return {
      goal: goalSummary,
      confidence: 0.95, // Will be refined by ConfidenceEstimator
      tasks
    };
  }

  private splitIntoClauses(text: string): string[] {
    // Replace transitions like ", inside it make..." or ", then open..." or " and then " with a clause boundary '|'
    const cleaned = text
      .replace(/^(?:hey|hi|hello|please|sentinel)[\s,]+/i, '') // Remove conversational filler
      .replace(/\.\s+/g, '|')
      .replace(/\.$/, '')
      .replace(/;\s*/g, '|')
      .replace(/,\s*(?:and\s+)?(?:then|next|afterwards|inside\s+(?:it|that|this|the\s+dir(?:ectory)?|the\s+folder)|in\s+(?:it|that|this|the\s+dir(?:ectory)?|the\s+folder))\b/gi, '|$&')
      .replace(/ \b(?:and\s+)?then\b /gi, '|then ')
      .replace(/,\s*(?=(?:make|create|open|delete|remove|run|execute|list|check|find|search|go|navigate)\b)/gi, '|');

    const segments = cleaned.split('|').flatMap(s => {
      if (s.toLowerCase().includes(' and then ')) return s.split(/ \band then\b /i);
      if (s.toLowerCase().includes(' and ') && !s.includes('@') && !s.includes('=')) {
        // Only split by 'and' if both halves look like independent verbs/commands
        const parts = s.split(/ \band\b /i);
        if (parts.length === 2 && this.hasActionVerb(parts[1])) {
          return parts;
        }
      }
      if (s.toLowerCase().includes(' then ')) return s.split(/ \bthen\b /i);
      return [s];
    });

    return segments.map(s => s.replace(/^[,|\s]+/, '').trim()).filter(Boolean);
  }

  private hasActionVerb(str: string): boolean {
    const verbs = ['connect', 'disconnect', 'open', 'close', 'launch', 'search', 'go', 'navigate', 'show', 'list', 'turn', 'enable', 'disable', 'start', 'stop', 'scan', 'check', 'make', 'create', 'touch', 'delete', 'remove', 'run', 'execute', 'install', 'uninstall', 'find', 'locate', 'inside', 'in'];
    const firstWord = str.trim().split(/\s+/)[0]?.toLowerCase();
    return verbs.includes(firstWord);
  }

  private summarizeGoal(original: string, tasks: PlannedTask[]): string {
    if (original.length <= 40) {
      // Capitalize first letter and remove trailing periods
      const cleaned = original.trim().replace(/\.$/, '');
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    if (tasks.length > 1) {
      return `Sequential execution: ${tasks.map(t => t.tool.split('.').pop()).join(' → ')}`;
    }
    return `Execute ${tasks[0]?.tool || 'requested tool'}`;
  }

  private resolveFolderPath(inputStr: string, entities: Record<string, any>, activeContext?: string): string {
    const lower = inputStr.toLowerCase().trim();
    if (activeContext && (lower.includes('open it') || lower.includes('in it') || lower.includes('open that') || lower.includes('this') || lower.includes('there'))) {
      return activeContext;
    }
    if (lower.includes('this folder') || lower.includes('this directory') || lower.includes('current folder') || lower.includes('current directory') || lower.includes('this project') || lower === 'this' || lower === 'here' || lower === '.' || lower === 'code' || lower === 'cursor' || lower.includes('open ')) {
      return activeContext || '.';
    }
    return entities.path || entities.directory || activeContext || inputStr || '.';
  }
}
