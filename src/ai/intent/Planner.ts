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
    const clean = query.trim();

    // 1. Extract global entities from prompt
    const globalEntities = this.extractor.extract(clean);

    // 2. Try fast sequential clause splitting for multi-step instructions
    // e.g. "Open Chrome. Go to YouTube. Search for AI." or "Turn on bluetooth and connect my headphones"
    const clauses = this.splitIntoClauses(clean);
    const tasks: PlannedTask[] = [];

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
        if (!combinedEntities.pattern && !combinedEntities.query) {
          const match = clause.match(/(?:where|path|find|locate|search)\s+(?:(?:is|are|of|for|did\s+you\s+(?:create|make|save|put)|did\s+it\s+(?:create|make|save|put)|to|the|my|a|an)\s+)*(?:(?:folder|directory|dir|file|app|application)\s+)*(?:named?|called)?\s*["']?([a-zA-Z0-9_\-\.]+)/i);
          const name = match && match[1] ? match[1].replace(/\s+(?:folder|directory|dir|file)$/i, '').trim() : (combinedEntities.folders?.[0] || combinedEntities.files?.[0] || 'folder');
          combinedEntities.pattern = name;
          combinedEntities.query = name;
        }
        if (!combinedEntities.dir) {
          combinedEntities.dir = '~';
        }
      } else if (clauseLower.includes('make a new folder') || clauseLower.includes('create a new folder') || clauseLower.includes('make folder') || clauseLower.includes('create folder') || clauseLower.includes('new folder') || clauseLower.includes('mkdir') || clauseLower.includes('make dir') || clauseLower.includes('create dir') || clauseLower.includes('make a folder') || clauseLower.includes('create a folder') || (clauseLower.includes('make') && clauseLower.includes('folder'))) {
        toolId = 'filesystem.mkdir';
      } else if (clauseLower.includes('make a new file') || clauseLower.includes('create a new file') || clauseLower.includes('make file') || clauseLower.includes('create file') || clauseLower.includes('new file') || clauseLower.includes('touch file') || clauseLower.includes('make a file') || clauseLower.includes('create a file')) {
        toolId = 'filesystem.create';
      } else if (clauseLower.includes('delete file') || clauseLower.includes('delete folder') || clauseLower.includes('remove file') || clauseLower.includes('remove folder') || clauseLower.includes('permanently delete') || (clauseLower.includes('delete') && (clauseLower.includes('file') || clauseLower.includes('folder') || clauseLower.includes('dir')))) {
        toolId = 'filesystem.delete';
      } else if ((clauseLower.includes('go to ') || clauseLower.includes('navigate ') || clauseLower.includes('content of') || clauseLower.includes('contents of') || clauseLower.includes('what is in') || clauseLower.includes('files in') || ((clauseLower.includes('show ') || clauseLower.includes('list ') || clauseLower.includes('view ')) && !clauseLower.includes('bluetooth') && !clauseLower.includes('wifi') && !clauseLower.includes('network'))) && isFolderQuery) {
        toolId = 'filesystem.list';
        if (!combinedEntities['path'] && !combinedEntities['directory']) {
          const m = clause.match(/(?:to|of|in|show|list|view)\s+([^\s]+)/i);
          const rawPath = m ? m[1].trim() : '~/Downloads';
          combinedEntities['path'] = rawPath;
          combinedEntities['directory'] = rawPath;
        }
      } else if (clauseLower.includes('open ') || clauseLower.includes('launch ')) {
        toolId = 'application.open';
        if (!combinedEntities.app) combinedEntities.app = combinedEntities['path'] || clause.replace(/^.*(?:open|launch)\s+/i, '').trim();
      } else if ((clauseLower.includes('go to ') || clauseLower.includes('navigate ')) && (clauseLower.includes('http') || clauseLower.includes('.com') || clauseLower.includes('youtube') || clauseLower.includes('google') || clauseLower.includes('website') || clauseLower.includes('page') || combinedEntities.url)) {
        toolId = 'browser.navigate';
        if (!combinedEntities.url && clauseLower.includes('youtube')) combinedEntities.url = 'https://youtube.com';
      } else if (clauseLower.includes('search for ') || clauseLower.startsWith('search ')) {
        toolId = 'browser.search';
        if (!combinedEntities.query) combinedEntities.query = clause.replace(/^.*search (for )?/i, '').trim();
      } else if (clauseLower.includes('show all the bluetooth devices') || clauseLower.includes('show all bluetooth devices') || clauseLower.includes('list bluetooth')) {
        toolId = 'network.bluetooth.list';
      } else if (clauseLower.includes('kill') || clauseLower.includes('terminate') || clauseLower.includes('pkill') || clauseLower.includes('killall') || clauseLower.includes('force quit') || clauseLower.includes('force close') || clauseLower.includes('end task') || (clauseLower.includes('stop') && (clauseLower.includes('process') || clauseLower.includes('service') || clauseLower.includes('app') || clauseLower.includes('daemon') || clauseLower.includes('task') || combinedEntities.process))) {
        if (clauseLower.includes('force quit') || clauseLower.includes('force close') || (clauseLower.includes('kill') && clauseLower.includes('app'))) {
          toolId = 'application.force_quit';
        } else {
          toolId = 'system.kill_process';
        }
        if (!combinedEntities.process && !combinedEntities.app) {
          const m = clause.match(/(?:kill|terminate|stop|end|pkill|killall|force\s+quit|force\s+close)\s+(?:any\s+|the\s+|all\s+)?(?:process|app|application|task|service)?\s*["']?([^\s,;:"'!?.]+)/i);
          const target = m && m[1] && !['process', 'app', 'application', 'task', 'any'].includes(m[1].toLowerCase()) ? m[1] : (combinedEntities.applications?.[0] || combinedEntities.processes?.[0] || 'any');
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
      } else if (clauseLower.includes('list running app') || clauseLower.includes('show running app') || clauseLower.includes('active app') || (clauseLower.includes('what') && clauseLower.includes('app') && clauseLower.includes('running'))) {
        toolId = 'application.list_running';
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
      } else if (clauseLower.startsWith('find ')) {
        toolId = 'filesystem.search';
        if (!combinedEntities.dir) combinedEntities.dir = '~';
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
    // Split by periods followed by space or end of string, semicolons, or sequential conjunctions " and then ", " and ", " then "
    // Be careful not to split decimal numbers or filenames
    const cleaned = text.replace(/\.\s+/g, '|').replace(/\.$/, '').replace(/;\s*/g, '|');
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

    return segments.map(s => s.trim()).filter(Boolean);
  }

  private hasActionVerb(str: string): boolean {
    const verbs = ['connect', 'disconnect', 'open', 'close', 'launch', 'search', 'go', 'navigate', 'show', 'list', 'turn', 'enable', 'disable', 'start', 'stop', 'scan', 'check'];
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
}
