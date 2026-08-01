/**
 * EntityExtractor.ts — Strongly-Typed Regex Entity Extraction
 *
 * Extracts structured ConversationEntity[] from natural language input.
 * Every entity has { type, value, confidence, raw }.
 *
 * Pure regex — no LLM calls. Executes in <5ms.
 * Platform-independent entity recognition.
 */

import type { ConversationEntity, EntityType } from './ConversationTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Known Lists for High-Confidence Matching
// ─────────────────────────────────────────────────────────────────────────────

const COMMON_APPS = [
  'Chrome', 'Safari', 'Firefox', 'Edge', 'Arc', 'Brave',
  'Terminal', 'iTerm', 'Warp', 'Alacritty',
  'VSCode', 'VS Code', 'Code', 'Cursor', 'Xcode', 'IntelliJ', 'WebStorm',
  'Spotify', 'Slack', 'Discord', 'Telegram', 'WhatsApp', 'Zoom', 'Teams',
  'Docker', 'Postman', 'Figma', 'Notion', 'Obsidian',
  'Finder', 'System Settings', 'System Preferences', 'Activity Monitor',
  'Preview', 'Notes', 'Calendar', 'Mail', 'Messages', 'Photos',
  'Node', 'Python', 'Nginx', 'Redis', 'MongoDB', 'Postgres',
  'YouTube', 'Twitter', 'GitHub', 'Netflix',
];

const COMMON_BT_DEVICES = [
  'AirPods', 'AirPods Pro', 'AirPods Max',
  'Headphones', 'Earbuds', 'Earphones',
  'Magic Mouse', 'Magic Keyboard', 'Magic Trackpad',
  'Mouse', 'Keyboard', 'Trackpad',
  'Speaker', 'HomePod', 'Soundbar',
  'JBL', 'Bose', 'Sony', 'Beats', 'Samsung',
  'Controller', 'Gamepad', 'Watch',
];

// ─────────────────────────────────────────────────────────────────────────────
// Entity Extractor
// ─────────────────────────────────────────────────────────────────────────────

export class EntityExtractor {
  /**
   * Extract all entities from natural language input.
   * Returns strongly-typed ConversationEntity[].
   */
  public extract(input: string): ConversationEntity[] {
    const entities: ConversationEntity[] = [];
    const text = input.trim();

    if (!text) return entities;

    // Order matters: extract specific patterns first, then broader ones
    this.extractPorts(text, entities);
    this.extractIPAddresses(text, entities);
    this.extractEmails(text, entities);
    this.extractURLs(text, entities);
    this.extractPaths(text, entities);
    this.extractRepositories(text, entities);
    this.extractBranches(text, entities);
    this.extractBluetoothDevices(text, entities);
    this.extractSSIDs(text, entities);
    this.extractApplications(text, entities);
    this.extractProcesses(text, entities);
    this.extractContainers(text, entities);
    this.extractPackages(text, entities);
    this.extractUsers(text, entities);
    this.extractSSHHosts(text, entities);

    return entities;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Individual Extractors
  // ─────────────────────────────────────────────────────────────────────────

  private extractPorts(text: string, out: ConversationEntity[]): void {
    // "port 3000", "on port 8080", "listening on port 443"
    const regex = /\b(?:port|on\s+port|to\s+port|listening\s+on\s+port)\s+(\d{2,5})\b/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const port = parseInt(match[1], 10);
      if (port >= 1 && port <= 65535) {
        this.addEntity(out, 'port', String(port), 0.99, match[0]);
      }
    }

    // Bare port numbers like ":3000" or "localhost:8080"
    const colonPort = /(?:localhost|127\.0\.0\.1):(\d{2,5})\b/g;
    while ((match = colonPort.exec(text)) !== null) {
      const port = parseInt(match[1], 10);
      if (port >= 1 && port <= 65535) {
        this.addEntity(out, 'port', String(port), 0.97, match[0]);
      }
    }
  }

  private extractIPAddresses(text: string, out: ConversationEntity[]): void {
    const regex = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\b/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      this.addEntity(out, 'ip_address', match[0], 0.99, match[0]);
    }
  }

  private extractEmails(text: string, out: ConversationEntity[]): void {
    const regex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      this.addEntity(out, 'email', match[0], 0.99, match[0]);
    }
  }

  private extractURLs(text: string, out: ConversationEntity[]): void {
    const regex = /(?:https?:\/\/|www\.)[^\s/$.?#][^\s]*/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
      let url = match[0].replace(/[.,;:!?)]+$/, '');
      if (url.startsWith('www.')) url = `https://${url}`;
      this.addEntity(out, 'url', url, 0.98, match[0]);
    }
  }

  private extractPaths(text: string, out: ConversationEntity[]): void {
    // Explicit paths: ~/..., /..., ./...
    const pathRegex = /(?:~\/[^\s]+|\/(?:usr|bin|etc|var|home|Applications|System|Library|Users|tmp|opt)[^\s]*|\.\.?\/[^\s]+)/g;
    let match;
    while ((match = pathRegex.exec(text)) !== null) {
      const p = match[0].replace(/[.,;:!?)]+$/, '');
      const type = this.isFilePath(p) ? 'file' : 'folder';
      this.addEntity(out, type as EntityType, p, 0.96, match[0]);
      this.addEntity(out, 'path', p, 0.96, match[0]);
    }

    // Well-known folder names
    const folderMap: [RegExp, string][] = [
      [/\b(?:downloads?|donwloads?)(?:\s+(?:folder|directory|dir))?\b/i, '~/Downloads'],
      [/\bdesktop(?:\s+(?:folder|directory|dir))?\b/i, '~/Desktop'],
      [/\bdocuments?(?:\s+(?:folder|directory|dir))?\b/i, '~/Documents'],
      [/\b(?:pictures?|photos?)(?:\s+(?:folder|directory|dir))?\b/i, '~/Pictures'],
      [/\bmusic(?:\s+(?:folder|directory|dir))?\b/i, '~/Music'],
      [/\b(?:movies?|videos?)(?:\s+(?:folder|directory|dir))?\b/i, '~/Movies'],
    ];

    for (const [regex, folder] of folderMap) {
      const m = text.match(regex);
      if (m) {
        this.addEntity(out, 'folder', folder, 0.95, m[0]);
      }
    }

    // Files with extensions mentioned in text
    const fileExtRegex = /\b[\w-]+\.(?:txt|json|md|ts|tsx|js|jsx|rs|py|go|rb|png|jpg|jpeg|gif|svg|mp4|mp3|mov|zip|tar|gz|pdf|sh|yaml|yml|html|css|sql|csv|doc|docx|toml|xml|log)\b/gi;
    while ((match = fileExtRegex.exec(text)) !== null) {
      this.addEntity(out, 'file', match[0], 0.94, match[0]);
    }
  }

  private extractRepositories(text: string, out: ConversationEntity[]): void {
    // GitHub URLs: github.com/owner/repo
    const ghRegex = /github\.com\/([^\s/]+\/[^\s/]+)/gi;
    let match;
    while ((match = ghRegex.exec(text)) !== null) {
      const repo = match[1].replace(/\.git$/, '').replace(/[.,;:!?)]+$/, '');
      this.addEntity(out, 'repository', repo, 0.99, match[0]);
    }

    // "repo owner/name" or "repository owner/name"
    const repoRegex = /\b(?:repo(?:sitory)?)\s+([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)/i;
    const repoMatch = text.match(repoRegex);
    if (repoMatch) {
      this.addEntity(out, 'repository', repoMatch[1], 0.95, repoMatch[0]);
    }
  }

  private extractBranches(text: string, out: ConversationEntity[]): void {
    const regex = /\b(?:branch|checkout(?:\s+branch)?|switch\s+to(?:\s+branch)?)\s+(?:named?\s+)?["']?([a-zA-Z0-9_\-/.]+)["']?/i;
    const match = text.match(regex);
    if (match && match[1]) {
      const branch = match[1].replace(/[.,;:!?)]+$/, '');
      // Ignore common false positives
      if (!['the', 'a', 'my', 'new', 'that', 'this'].includes(branch.toLowerCase())) {
        this.addEntity(out, 'branch', branch, 0.93, match[0]);
      }
    }
  }

  private extractBluetoothDevices(text: string, out: ConversationEntity[]): void {
    for (const device of COMMON_BT_DEVICES) {
      const regex = new RegExp(`\\b${this.escapeRegex(device)}\\b`, 'i');
      const match = text.match(regex);
      if (match) {
        this.addEntity(out, 'bluetooth_device', device, 0.96, match[0]);
      }
    }

    // Quoted device names: connect to "My Speaker"
    const quotedRegex = /(?:connect|pair|disconnect)\s+(?:to|with|from)?\s*["']([^"']+)["']/i;
    const quotedMatch = text.match(quotedRegex);
    if (quotedMatch && quotedMatch[1]) {
      this.addEntity(out, 'bluetooth_device', quotedMatch[1], 0.92, quotedMatch[0]);
    }
  }

  private extractSSIDs(text: string, out: ConversationEntity[]): void {
    // "connect to wifi NetworkName", "join network MyWiFi"
    const regex = /\b(?:connect\s+to\s+(?:wifi|wi-fi|network)|join\s+(?:wifi|wi-fi|network)|wifi\s+(?:network|name|ssid))\s+(?:called\s+|named\s+)?["']?([^\s"',;]+)["']?/i;
    const match = text.match(regex);
    if (match && match[1]) {
      this.addEntity(out, 'ssid', match[1], 0.95, match[0]);
    }

    // Quoted SSID: connect to "MyNetwork"
    const quotedRegex = /\b(?:wifi|wi-fi|network|ssid)\s+["']([^"']+)["']/i;
    const quotedMatch = text.match(quotedRegex);
    if (quotedMatch && quotedMatch[1]) {
      this.addEntity(out, 'ssid', quotedMatch[1], 0.93, quotedMatch[0]);
    }
  }

  private extractApplications(text: string, out: ConversationEntity[]): void {
    for (const app of COMMON_APPS) {
      const regex = new RegExp(`\\b${this.escapeRegex(app)}\\b`, 'i');
      const match = text.match(regex);
      if (match) {
        this.addEntity(out, 'application', app, 0.97, match[0]);
      }
    }

    // "open/launch/start AppName" for unlisted apps
    const openRegex = /\b(?:[Oo]pen|[Ll]aunch|[Ss]tart|[Rr]un|[Cc]lose|[Qq]uit|[Kk]ill)\s+(?:[Tt]he\s+|[Mm]y\s+)?(?:[Aa]pp(?:lication)?\s+)?([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/;
    const openMatch = text.match(openRegex);
    if (openMatch && openMatch[1]) {
      const appName = openMatch[1].trim();
      const ignoreList = ['Bluetooth', 'WiFi', 'the', 'my', 'all', 'process', 'folder', 'file', 'directory'];
      if (!ignoreList.includes(appName) && !out.some(e => e.type === 'application' && e.value.toLowerCase() === appName.toLowerCase())) {
        this.addEntity(out, 'application', appName, 0.85, openMatch[0]);
      }
    }
  }

  private extractProcesses(text: string, out: ConversationEntity[]): void {
    // "kill process named X", "terminate X process"
    const regex = /\b(?:kill|terminate|stop|end)\s+(?:the\s+)?(?:process\s+)?(?:named?\s+|called\s+)?["']?([a-zA-Z0-9_\-.]+)["']?\s*(?:process)?/i;
    const match = text.match(regex);
    if (match && match[1]) {
      const proc = match[1].trim();
      const ignoreList = ['the', 'all', 'process', 'it', 'that', 'this', 'them'];
      if (!ignoreList.includes(proc.toLowerCase())) {
        this.addEntity(out, 'process', proc, 0.90, match[0]);
      }
    }
  }

  private extractContainers(text: string, out: ConversationEntity[]): void {
    // "docker stop my-container", "container nginx"
    const regex = /\b(?:docker|container)\s+(?:start|stop|restart|kill|logs|exec|run|rm|remove)\s+["']?([a-zA-Z0-9_\-]+)["']?/i;
    const match = text.match(regex);
    if (match && match[1]) {
      this.addEntity(out, 'container', match[1], 0.95, match[0]);
    }
  }

  private extractPackages(text: string, out: ConversationEntity[]): void {
    // "install express", "npm install lodash", "brew install wget"
    const regex = /\b(?:npm|yarn|pnpm|pip|brew|apt|cargo|gem)\s+(?:install|add|remove|uninstall)\s+["']?([a-zA-Z0-9_@\-/.]+)["']?/i;
    const match = text.match(regex);
    if (match && match[1]) {
      this.addEntity(out, 'package', match[1], 0.96, match[0]);
    }

    // Generic "install packageName"
    const genericRegex = /\b(?:install|uninstall)\s+(?:the\s+)?(?:package\s+)?["']?([a-zA-Z0-9_@\-/.]+)["']?/i;
    const genericMatch = text.match(genericRegex);
    if (genericMatch && genericMatch[1]) {
      const pkg = genericMatch[1];
      const ignoreList = ['it', 'this', 'that', 'the', 'bluetooth', 'wifi', 'all', 'now'];
      if (!ignoreList.includes(pkg.toLowerCase()) && !out.some(e => e.type === 'package')) {
        this.addEntity(out, 'package', pkg, 0.88, genericMatch[0]);
      }
    }
  }

  private extractUsers(text: string, out: ConversationEntity[]): void {
    const regex = /\b(?:user|username|as\s+user)\s+["']?([a-zA-Z0-9_\-]+)["']?/i;
    const match = text.match(regex);
    if (match && match[1]) {
      this.addEntity(out, 'user', match[1], 0.93, match[0]);
    }

    // @mentions
    const atRegex = /@([a-zA-Z0-9_\-]{3,})\b/;
    const atMatch = text.match(atRegex);
    if (atMatch && atMatch[1]) {
      this.addEntity(out, 'user', atMatch[1], 0.90, atMatch[0]);
    }
  }

  private extractSSHHosts(text: string, out: ConversationEntity[]): void {
    // "ssh into myserver", "ssh user@host"
    const regex = /\bssh\s+(?:into\s+|to\s+|connect\s+to\s+)?(?:[a-zA-Z0-9_]+@)?([a-zA-Z0-9_.\-]+)/i;
    const match = text.match(regex);
    if (match && match[1]) {
      const host = match[1];
      if (!['into', 'to', 'connect', 'the'].includes(host.toLowerCase())) {
        this.addEntity(out, 'ssh_host', host, 0.94, match[0]);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private addEntity(
    out: ConversationEntity[],
    type: EntityType,
    value: string,
    confidence: number,
    raw: string
  ): void {
    // Deduplicate by type + value (exact match)
    if (out.some(e => e.type === type && e.value === value)) return;

    // Substring deduplication for entities of the same type (e.g. "Speaker" vs "My Speaker")
    const existingIndex = out.findIndex(e => e.type === type && value.toLowerCase().includes(e.value.toLowerCase()));
    if (existingIndex !== -1) {
      out.splice(existingIndex, 1);
    }
    
    if (out.some(e => e.type === type && e.value.toLowerCase().includes(value.toLowerCase()))) return;
    out.push({ type, value, confidence, raw });
  }

  private isFilePath(path: string): boolean {
    // Has a file extension
    const lastSegment = path.split('/').pop() || '';
    return lastSegment.includes('.') && !lastSegment.endsWith('/');
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
