/**
 * EntityExtractor.ts — Comprehensive OS & Registry Entity Extractor
 * 
 * Reliably extracts all Sentinel required entities from natural language:
 * paths, folders, files, URLs, repositories, applications, SSID, bluetooth devices,
 * ports, IP addresses, containers, services, packages, users, emails, device names, and custom entities.
 */

export interface ExtractedEntities {
  paths?: string[];
  folders?: string[];
  files?: string[];
  URLs?: string[];
  repositories?: string[];
  applications?: string[];
  SSID?: string[];
  bluetooth_devices?: string[];
  device_names?: string[];
  ports?: number[];
  ip_addresses?: string[];
  containers?: string[];
  services?: string[];
  packages?: string[];
  users?: string[];
  emails?: string[];
  processes?: string[];
  [key: string]: any;
}

export class EntityExtractor {
  // Known list of common applications, devices, containers, and packages to boost extraction accuracy
  private readonly COMMON_APPS = ['Chrome', 'Safari', 'Firefox', 'Edge', 'YouTube', 'Terminal', 'VSCode', 'Code', 'Spotify', 'Slack', 'Discord', 'Docker', 'Xcode', 'Node', 'Python', 'Finder', 'System Settings'];
  private readonly COMMON_DEVICES = ['AirPods', 'AirPods Pro', 'AirPods Max', 'Headphones', 'Earbuds', 'Magic Mouse', 'Mouse', 'Magic Keyboard', 'Keyboard', 'Speaker', 'HomePod', 'JBL', 'Bose', 'Sony'];
  private readonly COMMON_CONTAINERS = ['nginx', 'postgres', 'mysql', 'redis', 'mongo', 'node', 'python', 'alpine', 'ubuntu'];

  public extract(query: string): ExtractedEntities {
    const result: ExtractedEntities = {};
    const text = query.trim();

    // 1. IP Addresses (IPv4)
    const ipRegex = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g;
    const ips = text.match(ipRegex);
    if (ips) {
      result.ip_addresses = Array.from(new Set(ips));
    }

    // 2. Ports
    const portRegex = /\b(?:port|on port|to port)\s+([0-9]{2,5})\b/gi;
    let match;
    while ((match = portRegex.exec(text)) !== null) {
      const portNum = parseInt(match[1], 10);
      if (portNum >= 1 && portNum <= 65535) {
        if (!result.ports) result.ports = [];
        if (!result.ports.includes(portNum)) result.ports.push(portNum);
      }
    }

    // 3. URLs
    const urlRegex = /(?:https?:\/\/|www\.)[^\s/$.?#].[^\s]*/gi;
    const urls = text.match(urlRegex);
    if (urls) {
      result.URLs = Array.from(new Set(urls.map(u => u.startsWith('www.') ? `https://${u}` : u)));
    }

    // 4. Emails
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    const emails = text.match(emailRegex);
    if (emails) {
      result.emails = Array.from(new Set(emails));
    }

    // 5. File & Folder Paths
    const pathRegex = /(?:(?:\~|\/|\.\/|\.\.\/)[^\s]+|\b[a-zA-Z]:\\[^\s]+|\b\/(?:usr|bin|etc|var|home|Applications|System|Library|Users|tmp)[^\s]*)/g;
    const paths = text.match(pathRegex);
    if (paths) {
      const cleanPaths = Array.from(new Set(paths.map(p => p.replace(/[.,;:!?)]+$/, ''))));
      result.paths = cleanPaths;
      const folders: string[] = [];
      const files: string[] = [];
      for (const p of cleanPaths) {
        if (p.includes('.') && !p.endsWith('/')) {
          files.push(p);
        } else {
          folders.push(p);
        }
      }
      if (folders.length > 0) result.folders = folders;
      if (files.length > 0) result.files = files;
    }

    // Intelligent folder and directory name mapping (supporting common typos & standard macOS user folders)
    const lowerText = text.toLowerCase();
    const directoryMappings: [RegExp, string][] = [
      [/\b(downl?o?a?ds?|donwloads?|dwnloads?)(?:\s*(?:fod?le?r|dir(?:ectory)?))?\b/i, '~/Downloads'],
      [/\bdesktop(?:\s*(?:fod?le?r|dir(?:ectory)?))?\b/i, '~/Desktop'],
      [/\bdocuments?(?:\s*(?:fod?le?r|dir(?:ectory)?))?\b/i, '~/Documents'],
      [/\b(pictures?|photos?|images?)(?:\s*(?:fod?le?r|dir(?:ectory)?))?\b/i, '~/Pictures'],
      [/\b(music|songs?|audio)(?:\s*(?:fod?le?r|dir(?:ectory)?))?\b/i, '~/Music'],
      [/\b(movies?|videos?)(?:\s*(?:fod?le?r|dir(?:ectory)?))?\b/i, '~/Movies'],
      [/\b(?:home|user)(?:\s*(?:fod?le?r|dir(?:ectory)?))?\b/i, '~'],
      [/\bproject\s*(?:fod?le?r|dir(?:ectory)?)\b/i, '~/Project Folder']
    ];
    for (const [regex, mappedPath] of directoryMappings) {
      if (regex.test(lowerText)) {
        result.paths = Array.from(new Set([...(result.paths || []), mappedPath]));
        result.folders = Array.from(new Set([...(result.folders || []), mappedPath]));
      }
    }

    // Intelligent Folder / File Creation & Deletion Extraction (e.g., "in Downloads folder Make a new folder named AAAAAAAA" or "create folder AAAAAAAA in Desktop")
    const creationRegex = /(?:make|create|new|add|delete|remove|destroy|erase)\s+(?:(?:a|an|the)\s+)?(?:new\s+|old\s+)?(folder|directory|dir|file)\s+(?:named?|called|titled|as)?\s*["']?([a-z0-9_\-\.\s]+?)["']?(?:\s+(?:in|at|inside|from|on|under)\s+.*|\s*$)/i;
    const creationMatch = text.match(creationRegex);
    if (creationMatch && creationMatch[2]) {
      let extractedName = creationMatch[2].trim();
      extractedName = extractedName.replace(/\s+(?:in|at|inside|from|on|under)\s+.*$/i, '').trim();
      if (extractedName && !['folder', 'file', 'dir', 'directory', 'wifi', 'bluetooth', 'network'].includes(extractedName.toLowerCase())) {
        const type = creationMatch[1].toLowerCase();
        let baseDir = '~';
        if (result.folders && result.folders.length > 0) {
          baseDir = result.folders[0];
        } else if (result.paths && result.paths.length > 0) {
          baseDir = result.paths[0];
        }
        const fullPath = (baseDir === '~' && !result.folders && !result.paths) ? extractedName : `${baseDir.replace(/\/+$/, '')}/${extractedName}`;
        if (!result.paths) result.paths = [];
        result.paths.unshift(fullPath);
        if (type === 'file') {
          if (!result.files) result.files = [];
          result.files.unshift(fullPath);
        } else {
          if (!result.folders) result.folders = [];
          result.folders.unshift(fullPath);
        }
      }
    }

    // Intelligent File/Folder Search & Location Query Extraction ("where did you create AAAAAA folder", "tell me the path where you created X", "where is X located")
    const searchLocRegex = /(?:where|path|find|locate|search)\s+(?:(?:is|are|of|for|did\s+you\s+(?:create|make|save|put)|did\s+it\s+(?:create|make|save|put)|to|the|my|a|an)\s+)*(?:(?:folder|directory|dir|file|app|application)\s+)*(?:named?|called)?\s*["']?([a-zA-Z0-9_\-\.]+?)\s*(?:folder|directory|dir|file|app|application)?["']?(?:\s+(?:located|created|saved|stored|hidden|put|\?|$)|$)/i;
    const searchLocMatch = text.match(searchLocRegex);
    if (searchLocMatch && searchLocMatch[1]) {
      const targetName = searchLocMatch[1].replace(/\s+(?:folder|directory|dir|file)$/i, '').trim();
      if (targetName && !['folder', 'file', 'directory', 'path', 'the', 'a', 'an', 'is', 'did', 'you', 'create', 'make', 'where', 'tell', 'me'].includes(targetName.toLowerCase())) {
        result.pattern = targetName;
        result.query = targetName;
        if (!result.paths || result.paths.length === 0) {
          result.paths = ['~'];
        }
      }
    }

    // Also look for quotes containing filenames or extensions like .txt, .json, .md, .js, .ts
    const fileExtRegex = /\b[\w-]+\.(?:txt|json|md|ts|js|rs|py|go|png|jpg|pdf|sh|zip|html|css|yaml)\b/ig;
    const fileExts = text.match(fileExtRegex);
    if (fileExts) {
      result.files = Array.from(new Set([...(result.files || []), ...fileExts]));
    }

    // 6. Bluetooth Devices & Device Names
    for (const dev of this.COMMON_DEVICES) {
      const reg = new RegExp(`\\b${dev}\\b`, 'i');
      if (reg.test(text)) {
        if (!result.bluetooth_devices) result.bluetooth_devices = [];
        if (!result.device_names) result.device_names = [];
        if (!result.bluetooth_devices.includes(dev.toLowerCase())) result.bluetooth_devices.push(dev.toLowerCase());
        if (!result.device_names.includes(dev.toLowerCase())) result.device_names.push(dev.toLowerCase());
      }
    }
    // Also capture general connection, pairing, or joining targets ("connect me to X", "connect it to X", "join X", "pair with X", "connect my X")
    const connRegex = /(?:connect|pair|join|disconnect|unpair)\s+(?:(?:me|it|us|device|my|the|wifi|network|bluetooth)\s+)*(?:to|with|from)?\s*(?:(?:the|my|a|an)\s+)*(["']?)(.+?)\1(?:\s*[\.\,\;\!]*$)/i;
    const connMatch = text.match(connRegex);
    if (connMatch && connMatch[2]) {
      let candidate = connMatch[2].trim();
      candidate = candidate
        .replace(/^(?:(?:the|my|a|an|wifi|wi-fi|wireless|bluetooth|bt)\s+)*(?:network|device|name|profile)?\s*(?:called|named|similar\s+to|matching|like|is|as)\s+/i, '')
        .replace(/\s+(?:wifi|wi-fi|network|connection)$/i, '')
        .replace(/\s+(?:please|now|instantly|immediately|right\s+now|which\s+was.*|that\s+was.*|if\s+possible)$/i, '')
        .trim();

      if (candidate && !['bluetooth', 'bt', 'wifi', 'wi-fi', 'network', 'internet', 'device', 'headphones', 'earbuds'].includes(candidate.toLowerCase()) && !/\b(?:port|server|http|github|docker)\b/i.test(candidate)) {
        const isBtHint = /\b(headphones|earbuds|airpods|speaker|mouse|keyboard|trackpad|controller|homepod|watch|soundbar|jbl|bose|sony)\b/i.test(candidate) || text.toLowerCase().includes('bluetooth') || text.toLowerCase().includes('bt') || text.toLowerCase().includes('pair');
        const isWifiHint = /\b(phone|5g|4g|3g|fiber|fibre|wifi|wi-fi|hotspot|router|net|lan|airtel|jio|bsnl|verizon|att|guest|pro|max|ultra)\b/i.test(candidate) || text.toLowerCase().includes('wifi') || text.toLowerCase().includes('wi-fi') || text.toLowerCase().includes('network') || text.toLowerCase().includes('hotspot');

        if (isBtHint && !isWifiHint) {
          if (!result.bluetooth_devices) result.bluetooth_devices = [];
          if (!result.device_names) result.device_names = [];
          if (!result.bluetooth_devices.includes(candidate.toLowerCase())) result.bluetooth_devices.push(candidate.toLowerCase());
          if (!result.device_names.includes(candidate.toLowerCase())) result.device_names.push(candidate.toLowerCase());
        } else if (isWifiHint && !isBtHint) {
          if (!result.SSID) result.SSID = [];
          if (!result.SSID.includes(candidate)) result.SSID.push(candidate);
        } else {
          if (!result.device_names) result.device_names = [];
          if (!result.device_names.includes(candidate)) result.device_names.push(candidate);
          if (!result.SSID) result.SSID = [];
          if (!result.SSID.includes(candidate)) result.SSID.push(candidate);
        }
      } else if (['headphones', 'earbuds', 'speaker', 'airpods pro', 'airpods'].includes(candidate.toLowerCase())) {
        if (!result.bluetooth_devices) result.bluetooth_devices = [];
        if (!result.device_names) result.device_names = [];
        if (!result.bluetooth_devices.includes(candidate.toLowerCase())) result.bluetooth_devices.push(candidate.toLowerCase());
        if (!result.device_names.includes(candidate.toLowerCase())) result.device_names.push(candidate.toLowerCase());
      }
    }

    // 7. Applications & Processes
    for (const app of this.COMMON_APPS) {
      const reg = new RegExp(`\\b${app}\\b`, 'i');
      if (reg.test(text)) {
        if (!result.applications) result.applications = [];
        if (!result.applications.includes(app)) result.applications.push(app);
      }
    }
    const openInRegex = /(?:open|launch)\s+(.+?)\s+(?:in|using|with)\s+([a-z0-9_\-\.\s]+)$/i;
    const openInMatch = text.match(openInRegex);
    if (openInMatch && openInMatch[1] && openInMatch[2]) {
      const appName = openInMatch[2].trim();
      const targetUrl = openInMatch[1].trim();
      if (!result.applications) result.applications = [];
      if (!result.applications.includes(appName)) result.applications.unshift(appName);
      if (!result.URLs) result.URLs = [];
      if (!result.URLs.includes(targetUrl)) result.URLs.unshift(targetUrl);
    } else {
      const openAppRegex = /(?:open|launch|start|run)\s+(?:my|the|any|all)?\s*(?:app|application|service|task)?\s*([a-zA-Z0-9_\-\.]+)/i;
      const openMatch = text.match(openAppRegex);
      if (openMatch && openMatch[1]) {
        const appName = openMatch[1].trim();
        if (appName && !['process', 'app', 'application', 'service', 'task', 'any', 'all'].includes(appName.toLowerCase())) {
          if (!result.applications) result.applications = [];
          if (!result.applications.includes(appName)) result.applications.push(appName);
        }
      }
    }

    // Comprehensive process & app termination extraction for kill, stop, force quit, terminate commands
    const killStopMatch = text.match(/(?:kill|terminate|stop|end|pkill|killall|force\s+quit|force\s+close|halt)\s+(.+)/i);
    if (killStopMatch && killStopMatch[1]) {
      let target = killStopMatch[1].trim();
      const cleanPrefix = /^(?:entirely|completely|all|the|any|every|active|running|processes|process|services|service|apps|app|applications|application|tasks|task|of|called|named|with\s+name|by\s+name)\s+/i;
      while (cleanPrefix.test(target)) {
        target = target.replace(cleanPrefix, '').trim();
      }
      target = target.replace(/\s+(?:processes|process|services|service|apps|app|applications|application|tasks|task)$/i, '').trim();
      target = target.replace(/["'.!;,?]/g, '').trim();
      if (target && !['process', 'app', 'application', 'task', 'any', 'all', 'the', 'service'].includes(target.toLowerCase())) {
        if (!result.processes) result.processes = [];
        if (!result.processes.includes(target)) result.processes.push(target);
        if (!result.applications) result.applications = [];
        if (!result.applications.includes(target)) result.applications.push(target);
      }
    }

    // 8. Repositories (owner/repo or git url or after repository)
    const repoRegex = /(?:github\.com\/([^\s\/]+\/[^\s\/]+)|(?:repo|repository)\s+([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+))/i;
    const repoMatch = text.match(repoRegex);
    if (repoMatch) {
      const repoName = (repoMatch[1] || repoMatch[2]).replace(/\.git$/, '');
      result.repositories = [repoName];
    }

    // 9. SSID (Wi-Fi network names fallback)
    const ssidRegex = /(?:connect to wifi|connect to network|wifi network|join wifi|ssid)\s+(?:called|named)?\s*(?:["']?([^"'.,\s]+)["']?)/i;
    const ssidMatch = text.match(ssidRegex);
    if (ssidMatch && ssidMatch[1]) {
      const s = ssidMatch[1].trim();
      if (!result.SSID) result.SSID = [];
      if (!result.SSID.includes(s)) result.SSID.push(s);
    }

    // 10. Containers & Services
    for (const cont of this.COMMON_CONTAINERS) {
      const reg = new RegExp(`\\b(?:container|docker|image|service|running)\\s+${cont}\\b|\\b${cont}\\s+(?:container|service)\\b`, 'i');
      if (reg.test(text)) {
        if (!result.containers) result.containers = [];
        if (!result.containers.includes(cont)) result.containers.push(cont);
        if (!result.services) result.services = [];
        if (!result.services.includes(cont)) result.services.push(cont);
      }
    }
    if (text.toLowerCase().includes('docker') || text.toLowerCase().includes('container')) {
      const docReg = /(?:docker|container)\s+(?:run|stop|kill|restart|logs|exec|pull)\s+([a-zA-Z0-9_-]+)/i;
      const m = text.match(docReg);
      if (m && m[1]) {
        if (!result.containers) result.containers = [];
        result.containers.push(m[1]);
      }
    }

    // 11. Packages (npm, brew, apt, pip, cargo)
    const pkgRegex = /(?:install|remove|uninstall|update|upgrade)\s+(?:package|formula|crate|module)?\s*([a-zA-Z0-9_.-]+)(?:\s+via|\s+using|\s+with|\s*\.|$)/i;
    const pkgMatch = text.match(pkgRegex);
    if (pkgMatch && pkgMatch[1]) {
      const pkg = pkgMatch[1].trim();
      if (!['bluetooth', 'wifi', 'all', 'now', 'please', 'me', 'it'].includes(pkg.toLowerCase())) {
        result.packages = [pkg];
      }
    }

    // 12. Users
    const userRegex = /(?:user|username|as user)\s+([a-zA-Z0-9_-]+)|@([a-zA-Z0-9_-]{3,})/i;
    const userMatch = text.match(userRegex);
    if (userMatch && (userMatch[1] || userMatch[2])) {
      result.users = [userMatch[1] || userMatch[2]];
    }

    return result;
  }
}
