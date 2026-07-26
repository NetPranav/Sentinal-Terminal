/**
 * build_tools.mjs
 * 
 * Generates all tool bundle JSON files in tools/ across all 10 priority domains (~91 tools)
 * and generates src/tools/loader/BundledTools.ts for static bundler resolution.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../../');
const toolsDir = path.join(rootDir, 'tools');

const toolSpecs = [
  // ─── 1. FILESYSTEM DOMAIN ───
  {
    id: 'filesystem.list', folder: 'filesystem/list', domain: 'filesystem', action: 'list',
    name: 'List Directory Contents', desc: 'Lists files and folders in target directory path.',
    category: 'Filesystem', risk: 'SAFE', params: [{ name: 'path', type: 'string', desc: 'Directory path to list', required: true }],
    aliases: ['list files', 'ls', 'dir', 'show directory', 'list directory'], sampleInput: 'list files in /tmp',
    customWorkflowParams: { command: "ls", args: ["-la", "{{path}}"], path: "{{path}}" }
  },
  {
    id: 'filesystem.read', folder: 'filesystem/read', domain: 'filesystem', action: 'read',
    name: 'Read File Content', desc: 'Reads text content from a specified file path using safe native APIs.',
    category: 'Filesystem', risk: 'SAFE', params: [{ name: 'path', type: 'string', desc: 'File path to read', required: true }],
    aliases: ['read file', 'cat file', 'view file', 'show file contents'], sampleInput: 'read package.json'
  },
  {
    id: 'filesystem.search', folder: 'filesystem/search', domain: 'filesystem', action: 'search',
    name: 'Search Filesystem by Name', desc: 'Searches directory recursively for files or folders matching a filename pattern.',
    category: 'Filesystem', risk: 'SAFE', params: [
      { name: 'dir', type: 'string', desc: 'Starting root directory path', required: true },
      { name: 'pattern', type: 'string', desc: 'Search keyword or glob pattern', required: true }
    ],
    aliases: ['find file', 'search directory', 'search files', 'locate file', 'find folder', 'locate folder', 'where is', 'tell me the path'], sampleInput: 'search for *.ts files in src directory'
  },
  {
    id: 'filesystem.copy', folder: 'filesystem/copy', domain: 'filesystem', action: 'copy',
    name: 'Copy File or Directory', desc: 'Copies a source file or directory to a destination path using native filesystem APIs.',
    category: 'Filesystem', risk: 'LOW', params: [
      { name: 'source', type: 'string', desc: 'Source path to copy', required: true },
      { name: 'destination', type: 'string', desc: 'Target destination path', required: true }
    ],
    aliases: ['copy file', 'duplicate file', 'cp file'], sampleInput: 'copy config.json to config.bak'
  },
  {
    id: 'filesystem.locate_files', folder: 'filesystem/locate_files', domain: 'filesystem', action: 'locate_files',
    name: 'Locate Specific Files', desc: 'Fast file location lookup across the OS filesystem by filename.',
    category: 'Filesystem', risk: 'SAFE', params: [{ name: 'name', type: 'string', desc: 'Target filename or substring', required: true }],
    aliases: ['locate files', 'find files across system', 'where is file'], sampleInput: 'locate files named id_rsa'
  },
  {
    id: 'filesystem.locate_folders', folder: 'filesystem/locate_folders', domain: 'filesystem', action: 'locate_folders',
    name: 'Locate Specific Folders', desc: 'Finds directory paths across the operating system filesystem.',
    category: 'Filesystem', risk: 'SAFE', params: [{ name: 'name', type: 'string', desc: 'Folder name or substring', required: true }],
    aliases: ['locate folders', 'find directory', 'locate directory'], sampleInput: 'locate folders named node_modules'
  },
  {
    id: 'filesystem.grep', folder: 'filesystem/grep', domain: 'filesystem', action: 'grep',
    name: 'Search by File Content', desc: 'Searches inside text files for matching regex patterns or literal strings.',
    category: 'Filesystem', risk: 'SAFE', params: [
      { name: 'path', type: 'string', desc: 'Directory or file path to search inside', required: true },
      { name: 'query', type: 'string', desc: 'String or regex pattern to match', required: true }
    ],
    aliases: ['grep files', 'search content in files', 'find text in files'], sampleInput: 'search by content for TODO in src'
  },
  {
    id: 'filesystem.move', folder: 'filesystem/move', domain: 'filesystem', action: 'move',
    name: 'Move File or Directory', desc: 'Moves a file or directory from source path to destination path.',
    category: 'Filesystem', risk: 'MEDIUM', params: [
      { name: 'source', type: 'string', desc: 'Source file or folder path', required: true },
      { name: 'destination', type: 'string', desc: 'New target location path', required: true }
    ],
    aliases: ['move file', 'mv file', 'relocate folder'], sampleInput: 'move test.txt to archive/test.txt'
  },
  {
    id: 'filesystem.rename', folder: 'filesystem/rename', domain: 'filesystem', action: 'rename',
    name: 'Rename File or Directory', desc: 'Renames an existing file or directory path.',
    category: 'Filesystem', risk: 'MEDIUM', params: [
      { name: 'path', type: 'string', desc: 'Current path of file or directory', required: true },
      { name: 'newName', type: 'string', desc: 'New file name or title', required: true }
    ],
    aliases: ['rename file', 'rename folder'], sampleInput: 'rename file old.json to new.json'
  },
  {
    id: 'filesystem.compress', folder: 'filesystem/compress', domain: 'filesystem', action: 'compress',
    name: 'Compress Files to Archive', desc: 'Compresses files or directories into a zip or tar archive.',
    category: 'Filesystem', risk: 'LOW', params: [
      { name: 'source', type: 'string', desc: 'Directory or files to compress', required: true },
      { name: 'archiveName', type: 'string', desc: 'Name of destination zip/tar archive', required: true }
    ],
    aliases: ['zip folder', 'compress files', 'create archive', 'tar folder'], sampleInput: 'compress src to build.zip'
  },
  {
    id: 'filesystem.extract', folder: 'filesystem/extract', domain: 'filesystem', action: 'extract',
    name: 'Extract Archive File', desc: 'Extracts contents from a zip, tar, or compressed archive file into target directory.',
    category: 'Filesystem', risk: 'LOW', params: [
      { name: 'archivePath', type: 'string', desc: 'Path to zip/tar archive file', required: true },
      { name: 'destination', type: 'string', desc: 'Target directory for extracted files', required: false, default: '.' }
    ],
    aliases: ['unzip file', 'extract archive', 'untar file', 'decompress archive'], sampleInput: 'extract build.zip into ./dist'
  },
  {
    id: 'filesystem.duplicate', folder: 'filesystem/duplicate', domain: 'filesystem', action: 'duplicate',
    name: 'Duplicate File or Directory', desc: 'Creates an immediate duplicated copy of a file or folder with timestamp or copy suffix.',
    category: 'Filesystem', risk: 'LOW', params: [{ name: 'path', type: 'string', desc: 'File or folder path to duplicate', required: true }],
    aliases: ['duplicate file', 'clone file locally', 'make copy of'], sampleInput: 'duplicate config.json'
  },
  {
    id: 'filesystem.delete', folder: 'filesystem/delete', domain: 'filesystem', action: 'delete',
    name: 'Permanently Delete File or Folder', desc: 'Permanently deletes a file or directory path from disk.',
    category: 'Filesystem', risk: 'HIGH', params: [{ name: 'path', type: 'string', desc: 'Target file or directory path to remove', required: true }],
    aliases: ['delete file', 'remove file', 'rm file', 'delete folder'], sampleInput: 'delete file temp.log'
  },
  {
    id: 'filesystem.trash', folder: 'filesystem/trash', domain: 'filesystem', action: 'trash',
    name: 'Move to System Trash', desc: 'Safely moves a file or directory to the macOS/OS system Trash or Recycle Bin.',
    category: 'Filesystem', risk: 'MEDIUM', params: [{ name: 'path', type: 'string', desc: 'File or directory path to move to trash', required: true }],
    aliases: ['move to trash', 'trash file', 'send to bin', 'delete to recycle bin'], sampleInput: 'trash file old_dump.sql'
  },
  {
    id: 'filesystem.restore', folder: 'filesystem/restore', domain: 'filesystem', action: 'restore',
    name: 'Restore File from Trash', desc: 'Restores a recently deleted file from system Trash back to its original path.',
    category: 'Filesystem', risk: 'LOW', params: [{ name: 'name', type: 'string', desc: 'Filename or trashed path to restore', required: true }],
    aliases: ['restore file', 'undelete file', 'untrash file', 'recover from bin'], sampleInput: 'restore file document.docx'
  },
  {
    id: 'filesystem.permissions', folder: 'filesystem/permissions', domain: 'filesystem', action: 'permissions',
    name: 'Inspect or Modify File Permissions', desc: 'Queries or updates Unix filesystem POSIX read/write/execute permissions (chmod/chown).',
    category: 'Filesystem', risk: 'MEDIUM', params: [
      { name: 'path', type: 'string', desc: 'Target file or directory path', required: true },
      { name: 'mode', type: 'string', desc: 'Octal or symbol mode e.g. 755 or +x', required: false }
    ],
    aliases: ['change permissions', 'chmod', 'chown', 'file permissions'], sampleInput: 'set permissions 755 on script.sh'
  },
  {
    id: 'filesystem.disk_usage', folder: 'filesystem/disk_usage', domain: 'filesystem', action: 'disk_usage',
    name: 'Check Disk Capacity and Usage', desc: 'Queries available storage space and folder size usage statistics (df/du).',
    category: 'Filesystem', risk: 'SAFE', params: [{ name: 'path', type: 'string', desc: 'Directory or mount path to analyze', required: false, default: '/' }],
    aliases: ['check disk usage', 'folder size', 'disk space available', 'du h'], sampleInput: 'check disk usage for /Users'
  },
  {
    id: 'filesystem.recent_files', folder: 'filesystem/recent_files', domain: 'filesystem', action: 'recent_files',
    name: 'Query Recently Modified Files', desc: 'Retrieves a list of files recently created, modified, or accessed across the system.',
    category: 'Filesystem', risk: 'SAFE', params: [{ name: 'count', type: 'number', desc: 'Maximum number of recent files to list', required: false, default: 20 }],
    aliases: ['recent files', 'show latest modified files', 'recently opened files'], sampleInput: 'show 10 recent files'
  },
  {
    id: 'filesystem.mkdir', folder: 'filesystem/mkdir', domain: 'filesystem', action: 'mkdir',
    name: 'Create New Directory', desc: 'Creates a new folder or directory hierarchy on disk.',
    category: 'Filesystem', risk: 'SAFE', params: [{ name: 'path', type: 'string', desc: 'Directory or folder path to create', required: true }],
    aliases: ['make folder', 'create folder', 'new folder', 'mkdir', 'make directory', 'create directory', 'new dir', 'create dir', 'make a new folder', 'create a new folder', 'make new directory'], sampleInput: 'make a new folder named AAAAAAAA in Downloads'
  },
  {
    id: 'filesystem.create', folder: 'filesystem/create', domain: 'filesystem', action: 'create',
    name: 'Create New File', desc: 'Creates a new empty file or initializes a file with content on disk.',
    category: 'Filesystem', risk: 'SAFE', params: [
      { name: 'path', type: 'string', desc: 'File path to create', required: true },
      { name: 'content', type: 'string', desc: 'Optional initial file content', required: false }
    ],
    aliases: ['create file', 'make file', 'new file', 'touch file', 'create a new file', 'make new file'], sampleInput: 'create file notes.txt'
  },

  // ─── 2. APPLICATIONS DOMAIN ───
  {
    id: 'application.open', folder: 'application/open', domain: 'application', action: 'open',
    name: 'Open Desktop Application', desc: 'Opens a system desktop application using native launchers (Launch Services).',
    category: 'Desktop', risk: 'SAFE', params: [{ name: 'app', type: 'string', desc: 'Application name or bundle path', required: true }],
    aliases: ['open app', 'launch app', 'run program', 'start application'], sampleInput: 'open Chrome'
  },
  {
    id: 'application.close', folder: 'application/close', domain: 'application', action: 'close',
    name: 'Close Desktop Application', desc: 'Gracefully requests an running application process or window to quit.',
    category: 'Desktop', risk: 'LOW', params: [{ name: 'app', type: 'string', desc: 'Application name to close', required: true }],
    aliases: ['close app', 'quit application', 'exit program', 'terminate app'], sampleInput: 'close Safari'
  },
  {
    id: 'application.force_quit', folder: 'application/force_quit', domain: 'application', action: 'force_quit',
    name: 'Force Quit Application', desc: 'Instantly terminates an unresponsive desktop application or frozen process (pkill -9).',
    category: 'Desktop', risk: 'HIGH', params: [{ name: 'app', type: 'string', desc: 'Application name or process ID to force quit', required: true }],
    aliases: ['force quit app', 'kill application', 'kill process app', 'force close'], sampleInput: 'force quit Xcode'
  },
  {
    id: 'application.focus', folder: 'application/focus', domain: 'application', action: 'focus',
    name: 'Focus Application Window', desc: 'Brings a desktop application window to the foreground screen focus.',
    category: 'Desktop', risk: 'SAFE', params: [{ name: 'app', type: 'string', desc: 'Application name to focus', required: true }],
    aliases: ['focus app', 'switch to application', 'bring to front'], sampleInput: 'focus VSCode'
  },
  {
    id: 'application.minimize', folder: 'application/minimize', domain: 'application', action: 'minimize',
    name: 'Minimize Application Window', desc: 'Minimizes application window down to system dock or taskbar.',
    category: 'Desktop', risk: 'SAFE', params: [{ name: 'app', type: 'string', desc: 'Application name to minimize', required: true }],
    aliases: ['minimize app', 'hide application window', 'minimize program'], sampleInput: 'minimize Spotify'
  },
  {
    id: 'application.maximize', folder: 'application/maximize', domain: 'application', action: 'maximize',
    name: 'Maximize Application Window', desc: 'Maximizes or switches application window into full-screen workspace mode.',
    category: 'Desktop', risk: 'SAFE', params: [{ name: 'app', type: 'string', desc: 'Application name to maximize or full-screen', required: true }],
    aliases: ['maximize app', 'full screen application', 'zoom window'], sampleInput: 'maximize Terminal'
  },
  {
    id: 'application.list_running', folder: 'application/list_running', domain: 'application', action: 'list_running',
    name: 'List Running Applications', desc: 'Lists all actively running desktop graphical applications and their PIDs.',
    category: 'Desktop', risk: 'SAFE', params: [],
    aliases: ['list running apps', 'show running applications', 'what apps are running', 'active apps'], sampleInput: 'list running applications'
  },
  {
    id: 'application.install', folder: 'application/install', domain: 'application', action: 'install',
    name: 'Install Desktop Package or App', desc: 'Installs software application via native OS package managers (Homebrew, apt, winget).',
    category: 'Desktop', risk: 'MEDIUM', params: [{ name: 'package', type: 'string', desc: 'Package or application name to install', required: true }],
    aliases: ['install app', 'brew install', 'install package', 'setup software'], sampleInput: 'install app ffmpeg'
  },
  {
    id: 'application.uninstall', folder: 'application/uninstall', domain: 'application', action: 'uninstall',
    name: 'Uninstall Desktop Application', desc: 'Uninstalls or removes software package via system package manager or App cleaner.',
    category: 'Desktop', risk: 'HIGH', params: [{ name: 'package', type: 'string', desc: 'Package or application name to remove', required: true }],
    aliases: ['uninstall app', 'remove package', 'brew uninstall', 'delete app program'], sampleInput: 'uninstall package wget'
  },

  // ─── 3. BROWSER DOMAIN ───
  {
    id: 'browser.navigate', folder: 'browser/navigate', domain: 'browser', action: 'navigate',
    name: 'Navigate Browser to URL', desc: 'Launches default system web browser and navigates directly to web URL.',
    category: 'Web', risk: 'SAFE', params: [{ name: 'url', type: 'string', desc: 'Web address to visit', required: true }],
    aliases: ['go to website', 'open url', 'navigate to', 'visit url'], sampleInput: 'go to youtube.com'
  },
  {
    id: 'browser.search', folder: 'browser/search', domain: 'browser', action: 'search',
    name: 'Search the Web in Browser', desc: 'Launches search query directly in default system browser on Google, YouTube, or GitHub.',
    category: 'Web', risk: 'SAFE', params: [
      { name: 'query', type: 'string', desc: 'Keywords to search', required: true },
      { name: 'engine', type: 'string', desc: 'Target search engine', required: false, default: 'google' }
    ],
    aliases: ['search for', 'google for', 'find online', 'search web'], sampleInput: 'search for AI tutorials on youtube'
  },
  {
    id: 'browser.new_tab', folder: 'browser/new_tab', domain: 'browser', action: 'new_tab',
    name: 'Open New Browser Tab', desc: 'Opens a blank or target URL new tab inside the currently running web browser.',
    category: 'Web', risk: 'SAFE', params: [{ name: 'url', type: 'string', desc: 'Optional initial URL for new tab', required: false }],
    aliases: ['open new tab', 'new browser tab', 'create tab'], sampleInput: 'open new tab with github.com'
  },
  {
    id: 'browser.bookmarks', folder: 'browser/bookmarks', domain: 'browser', action: 'bookmarks',
    name: 'Inspect Browser Bookmarks', desc: 'Queries and displays user saved bookmark links and favorite websites.',
    category: 'Web', risk: 'SAFE', params: [{ name: 'filter', type: 'string', desc: 'Keyword filter to search bookmark titles', required: false }],
    aliases: ['show bookmarks', 'find bookmark', 'browser favorites'], sampleInput: 'show bookmarks for sentinel'
  },
  {
    id: 'browser.downloads', folder: 'browser/downloads', domain: 'browser', action: 'downloads',
    name: 'Check Browser Downloads', desc: 'Lists recent files downloaded via the system web browser.',
    category: 'Web', risk: 'SAFE', params: [{ name: 'limit', type: 'number', desc: 'Maximum number of downloads to list', required: false, default: 10 }],
    aliases: ['show downloads', 'recent downloads', 'browser download history'], sampleInput: 'show 5 recent browser downloads'
  },
  {
    id: 'browser.history', folder: 'browser/history', domain: 'browser', action: 'history',
    name: 'Query Browser History', desc: 'Searches recent web browsing navigation history entries.',
    category: 'Web', risk: 'SAFE', params: [{ name: 'query', type: 'string', desc: 'Domain or title query keyword', required: false }],
    aliases: ['browser history', 'show visited sites', 'search web history'], sampleInput: 'search browser history for docs'
  },
  {
    id: 'browser.reload', folder: 'browser/reload', domain: 'browser', action: 'reload',
    name: 'Reload Active Browser Tab', desc: 'Reloads or refreshes the current active web page inside the default browser.',
    category: 'Web', risk: 'SAFE', params: [],
    aliases: ['reload page', 'refresh browser', 'refresh web page'], sampleInput: 'refresh browser tab'
  },
  {
    id: 'browser.close_tabs', folder: 'browser/close_tabs', domain: 'browser', action: 'close_tabs',
    name: 'Close Browser Tabs', desc: 'Closes active browser tab or all open background tabs.',
    category: 'Web', risk: 'LOW', params: [{ name: 'target', type: 'string', desc: 'Tab target: current, background, or all', required: false, default: 'current' }],
    aliases: ['close tab', 'close all browser tabs', 'close current tab'], sampleInput: 'close current browser tab'
  },

  // ─── 4. GIT DOMAIN ───
  {
    id: 'git.clone', folder: 'git/clone', domain: 'git', action: 'clone',
    name: 'Clone Git Repository', desc: 'Closes remote Git repository URL into local workspace directory.',
    category: 'Git', risk: 'LOW', params: [
      { name: 'url', type: 'string', desc: 'Repository Git URL', required: true },
      { name: 'directory', type: 'string', desc: 'Target local directory path', required: false }
    ],
    aliases: ['git clone', 'clone repository', 'download repo'], sampleInput: 'clone repository https://github.com/torvalds/linux'
  },
  {
    id: 'git.commit', folder: 'git/commit', domain: 'git', action: 'commit',
    name: 'Record Git Commit', desc: 'Stages modified workspace files and records a version commit with message.',
    category: 'Git', risk: 'LOW', params: [
      { name: 'message', type: 'string', desc: 'Commit message describing changes', required: true },
      { name: 'all', type: 'boolean', desc: 'Auto stage modified files (-a)', required: false, default: true }
    ],
    aliases: ['git commit', 'commit changes', 'save git changes'], sampleInput: 'commit changes with message "Fix login validation"'
  },
  {
    id: 'git.push', folder: 'git/push', domain: 'git', action: 'push',
    name: 'Push Git Commits', desc: 'Pushes local branch commits to remote repository origin server.',
    category: 'Git', risk: 'MEDIUM', params: [
      { name: 'remote', type: 'string', desc: 'Target remote name', required: false, default: 'origin' },
      { name: 'branch', type: 'string', desc: 'Target branch name', required: false }
    ],
    aliases: ['git push', 'push changes', 'push to origin', 'upload commits'], sampleInput: 'git push to origin main'
  },
  {
    id: 'git.pull', folder: 'git/pull', domain: 'git', action: 'pull',
    name: 'Pull Remote Git Changes', desc: 'Fetches and merges latest upstream commit changes from remote repository.',
    category: 'Git', risk: 'LOW', params: [
      { name: 'remote', type: 'string', desc: 'Target remote name', required: false, default: 'origin' },
      { name: 'branch', type: 'string', desc: 'Target branch name', required: false }
    ],
    aliases: ['git pull', 'pull changes', 'fetch repository updates'], sampleInput: 'pull changes from origin develop'
  },
  {
    id: 'git.checkout', folder: 'git/checkout', domain: 'git', action: 'checkout',
    name: 'Checkout Git Branch or Commit', desc: 'Switches working tree to a target git branch, commit hash, or tag.',
    category: 'Git', risk: 'LOW', params: [
      { name: 'target', type: 'string', desc: 'Branch name, tag, or commit SHA to checkout', required: true },
      { name: 'create', type: 'boolean', desc: 'Create branch if non existent (-b)', required: false, default: false }
    ],
    aliases: ['git checkout', 'switch branch', 'change git branch'], sampleInput: 'switch branch to feature/auth'
  },
  {
    id: 'git.merge', folder: 'git/merge', domain: 'git', action: 'merge',
    name: 'Merge Git Branch', desc: 'Merges changes from specified source branch into current active branch.',
    category: 'Git', risk: 'MEDIUM', params: [{ name: 'branch', type: 'string', desc: 'Source branch to merge into current branch', required: true }],
    aliases: ['git merge', 'merge branch into current'], sampleInput: 'merge branch develop'
  },
  {
    id: 'git.stash', folder: 'git/stash', domain: 'git', action: 'stash',
    name: 'Stash Workspace Modifications', desc: 'Stashes uncommitted modified files or applies recently stored stash.',
    category: 'Git', risk: 'LOW', params: [{ name: 'operation', type: 'string', desc: 'Stash operation: save, pop, list, or clear', required: false, default: 'save' }],
    aliases: ['git stash', 'stash changes', 'pop git stash'], sampleInput: 'git stash save uncommitted work'
  },
  {
    id: 'git.branch', folder: 'git/branch', domain: 'git', action: 'branch',
    name: 'Manage Git Branches', desc: 'Lists existing branches, creates new branch, or deletes branch.',
    category: 'Git', risk: 'LOW', params: [
      { name: 'operation', type: 'string', desc: 'Branch action: list, create, or delete', required: false, default: 'list' },
      { name: 'name', type: 'string', desc: 'Target branch name for create or delete', required: false }
    ],
    aliases: ['git branch', 'list branches', 'show git branches'], sampleInput: 'list git branches'
  },
  {
    id: 'git.log', folder: 'git/log', domain: 'git', action: 'log',
    name: 'Inspect Git Commit History', desc: 'Displays recent commit log history and authorship metadata.',
    category: 'Git', risk: 'SAFE', params: [{ name: 'maxCount', type: 'number', desc: 'Maximum number of commit logs to retrieve', required: false, default: 15 }],
    aliases: ['git log', 'show git history', 'view recent commits'], sampleInput: 'show git log for last 10 commits'
  },
  {
    id: 'git.diff', folder: 'git/diff', domain: 'git', action: 'diff',
    name: 'View Git Workspace Diff', desc: 'Displays file modification differences between workspace, index, or branches.',
    category: 'Git', risk: 'SAFE', params: [{ name: 'target', type: 'string', desc: 'Optional branch or commit to diff against', required: false }],
    aliases: ['git diff', 'show git diff', 'check file changes'], sampleInput: 'show git diff for modified files'
  },

  // ─── 5. DOCKER DOMAIN ───
  {
    id: 'docker.ps', folder: 'docker/ps', domain: 'docker', action: 'ps',
    name: 'List Running Docker Containers', desc: 'Lists running and stopped Docker container instances and container statuses.',
    category: 'Docker', risk: 'SAFE', params: [{ name: 'all', type: 'boolean', desc: 'Include stopped containers (-a)', required: false, default: true }],
    aliases: ['docker ps', 'list docker containers', 'show running containers'], sampleInput: 'list running docker containers'
  },
  {
    id: 'docker.images', folder: 'docker/images', domain: 'docker', action: 'images',
    name: 'List Cached Docker Images', desc: 'Lists local cached Docker container images, tags, and sizes.',
    category: 'Docker', risk: 'SAFE', params: [],
    aliases: ['docker images', 'list docker images', 'show local images'], sampleInput: 'show local docker images'
  },
  {
    id: 'docker.logs', folder: 'docker/logs', domain: 'docker', action: 'logs',
    name: 'Retrieve Container Logs', desc: 'Retrieves stdout/stderr runtime logs from a specified Docker container.',
    category: 'Docker', risk: 'SAFE', params: [
      { name: 'container', type: 'string', desc: 'Container ID or name', required: true },
      { name: 'tail', type: 'number', desc: 'Number of recent log lines to show', required: false, default: 50 }
    ],
    aliases: ['docker logs', 'check container logs', 'view docker logs'], sampleInput: 'check logs for container redis_db'
  },
  {
    id: 'docker.exec', folder: 'docker/exec', domain: 'docker', action: 'exec',
    name: 'Execute Command inside Container', desc: 'Executes an interactive shell command or instruction inside a running Docker container.',
    category: 'Docker', risk: 'MEDIUM', params: [
      { name: 'container', type: 'string', desc: 'Target container ID or name', required: true },
      { name: 'command', type: 'string', desc: 'Shell command string to run inside container', required: true }
    ],
    aliases: ['docker exec', 'run in container', 'exec into container'], sampleInput: 'docker exec command "env" inside container api_server'
  },
  {
    id: 'docker.compose_up', folder: 'docker/compose_up', domain: 'docker', action: 'compose_up',
    name: 'Start Docker Compose Stack', desc: 'Starts multi-container application services defined in docker-compose.yml.',
    category: 'Docker', risk: 'MEDIUM', params: [
      { name: 'detach', type: 'boolean', desc: 'Run containers in background detached mode (-d)', required: false, default: true },
      { name: 'file', type: 'string', desc: 'Path to docker-compose file', required: false, default: 'docker-compose.yml' }
    ],
    aliases: ['docker compose up', 'start docker stack', 'compose up'], sampleInput: 'start docker compose up detached'
  },
  {
    id: 'docker.compose_down', folder: 'docker/compose_down', domain: 'docker', action: 'compose_down',
    name: 'Stop Docker Compose Stack', desc: 'Stops and removes containers, networks, and volumes created by Docker Compose.',
    category: 'Docker', risk: 'LOW', params: [
      { name: 'volumes', type: 'boolean', desc: 'Remove associated named volumes (-v)', required: false, default: false },
      { name: 'file', type: 'string', desc: 'Path to docker-compose file', required: false, default: 'docker-compose.yml' }
    ],
    aliases: ['docker compose down', 'stop docker stack', 'compose down'], sampleInput: 'docker compose down stack'
  },
  {
    id: 'docker.stop', folder: 'docker/stop', domain: 'docker', action: 'stop',
    name: 'Stop Running Container', desc: 'Gracefully stops an actively running Docker container instance.',
    category: 'Docker', risk: 'LOW', params: [{ name: 'container', type: 'string', desc: 'Container ID or name to stop', required: true }],
    aliases: ['docker stop', 'stop container', 'halt docker container'], sampleInput: 'stop docker container postgres_dev'
  },
  {
    id: 'docker.restart', folder: 'docker/restart', domain: 'docker', action: 'restart',
    name: 'Restart Docker Container', desc: 'Restarts a running or stopped Docker container service.',
    category: 'Docker', risk: 'LOW', params: [{ name: 'container', type: 'string', desc: 'Container ID or name to restart', required: true }],
    aliases: ['docker restart', 'reboot container', 'restart docker service'], sampleInput: 'restart docker container redis_db'
  },

  // ─── 6. NODE DOMAIN ───
  {
    id: 'node.npm_install', folder: 'node/npm_install', domain: 'node', action: 'npm_install',
    name: 'Install NPM Dependencies', desc: 'Installs project node_modules dependencies or specific NPM package.',
    category: 'Node', risk: 'LOW', params: [
      { name: 'package', type: 'string', desc: 'Optional package name to add (if omitted installs all from package.json)', required: false },
      { name: 'global', type: 'boolean', desc: 'Install package globally (-g)', required: false, default: false }
    ],
    aliases: ['npm install', 'install node packages', 'npm i'], sampleInput: 'npm install axios'
  },
  {
    id: 'node.npm_run', folder: 'node/npm_run', domain: 'node', action: 'npm_run',
    name: 'Execute NPM Script', desc: 'Runs script command defined in package.json (e.g. build, test, dev, lint).',
    category: 'Node', risk: 'LOW', params: [
      { name: 'script', type: 'string', desc: 'Script target name to run', required: true },
      { name: 'args', type: 'array', desc: 'Additional CLI flag arguments', required: false }
    ],
    aliases: ['npm run', 'run npm script', 'execute package script'], sampleInput: 'npm run build'
  },
  {
    id: 'node.pnpm', folder: 'node/pnpm', domain: 'node', action: 'pnpm',
    name: 'Run PNPM Operation', desc: 'Executes fast disk-efficient package management command via pnpm CLI.',
    category: 'Node', risk: 'LOW', params: [{ name: 'command', type: 'string', desc: 'pnpm command argument e.g. install, run build, add', required: true }],
    aliases: ['pnpm install', 'pnpm run', 'use pnpm'], sampleInput: 'pnpm install dependencies'
  },
  {
    id: 'node.bun', folder: 'node/bun', domain: 'node', action: 'bun',
    name: 'Execute via Bun Runtime', desc: 'Runs script, test runner, or rapid package installation using modern Bun runtime.',
    category: 'Node', risk: 'LOW', params: [{ name: 'command', type: 'string', desc: 'Bun argument command e.g. test, run index.ts, install', required: true }],
    aliases: ['bun run', 'bun install', 'use bun runtime'], sampleInput: 'bun run server.ts'
  },
  {
    id: 'node.yarn', folder: 'node/yarn', domain: 'node', action: 'yarn',
    name: 'Manage Packages with Yarn', desc: 'Executes package operations or script running via Yarn package manager.',
    category: 'Node', risk: 'LOW', params: [{ name: 'command', type: 'string', desc: 'Yarn command string e.g. add, install, build', required: true }],
    aliases: ['yarn install', 'yarn add', 'yarn build'], sampleInput: 'yarn install packages'
  },

  // ─── 7. PYTHON DOMAIN ───
  {
    id: 'python.create_venv', folder: 'python/create_venv', domain: 'python', action: 'create_venv',
    name: 'Create Python Virtual Environment', desc: 'Creates an isolated Python environment (python3 -m venv) in target directory.',
    category: 'Python', risk: 'SAFE', params: [{ name: 'directory', type: 'string', desc: 'Directory path for virtual environment folder', required: false, default: 'venv' }],
    aliases: ['create venv', 'make python virtualenv', 'python -m venv', 'setup venv'], sampleInput: 'create venv in directory .venv'
  },
  {
    id: 'python.pip_install', folder: 'python/pip_install', domain: 'python', action: 'pip_install',
    name: 'Install Python Pip Package', desc: 'Installs Python software libraries and dependencies via pip package installer.',
    category: 'Python', risk: 'LOW', params: [
      { name: 'package', type: 'string', desc: 'Package library name or requirements.txt path', required: true },
      { name: 'upgrade', type: 'boolean', desc: 'Upgrade package if already installed (-U)', required: false, default: false }
    ],
    aliases: ['pip install', 'install python library', 'pip add package'], sampleInput: 'pip install numpy'
  },
  {
    id: 'python.run_script', folder: 'python/run_script', domain: 'python', action: 'run_script',
    name: 'Execute Python Script', desc: 'Runs Python `.py` script file or code command using Python 3 interpreter.',
    category: 'Python', risk: 'LOW', params: [
      { name: 'script', type: 'string', desc: 'Path to python `.py` script file or code string', required: true },
      { name: 'args', type: 'array', desc: 'CLI arguments passed into script', required: false }
    ],
    aliases: ['run python script', 'python3 run', 'execute python code'], sampleInput: 'run python script generate_data.py'
  },
  {
    id: 'python.notebook', folder: 'python/notebook', domain: 'python', action: 'notebook',
    name: 'Launch Jupyter Notebook', desc: 'Starts Jupyter Notebook or Lab interactive data science server in current folder.',
    category: 'Python', risk: 'SAFE', params: [{ name: 'lab', type: 'boolean', desc: 'Launch modern JupyterLab UI instead of classic Notebook', required: false, default: true }],
    aliases: ['start jupyter notebook', 'run jupyter lab', 'open python notebook'], sampleInput: 'start jupyter lab'
  },

  // ─── 8. NETWORKING DOMAIN ───
  {
    id: 'network.wifi.scan', folder: 'network/wifi.scan', domain: 'network', action: 'wifi.scan',
    name: 'Scan Wi-Fi Networks', desc: 'Scans and lists nearby accessible wireless Wi-Fi SSID networks and signal strength.',
    category: 'Networking', risk: 'SAFE', params: [],
    aliases: ['scan wifi', 'show wireless networks', 'list wifi networks', 'find wifi', 'scan for wireless networks'], sampleInput: 'scan available wifi networks'
  },
  {
    id: 'network.wifi.connect', folder: 'network/wifi.connect', domain: 'network', action: 'wifi.connect',
    name: 'Connect to Wi-Fi Network', desc: 'Connects system wireless interface directly to specified Wi-Fi network SSID.',
    category: 'Networking', risk: 'LOW', params: [
      { name: 'ssid', type: 'string', desc: 'Wireless network SSID name', required: true },
      { name: 'password', type: 'string', desc: 'WPA network key password', required: false }
    ],
    aliases: ['connect wifi', 'join wifi network', 'wifi connect', 'connect me to', 'connect to network', 'join network', 'connect it to', 'connect to wifi'], sampleInput: 'connect wifi to Home-WiFi-5G'
  },
  {
    id: 'network.wifi.on', folder: 'network/wifi.on', domain: 'network', action: 'wifi.on',
    name: 'Turn Wi-Fi On', desc: 'Enables system Wi-Fi wireless networking radio interface.',
    category: 'Networking', risk: 'SAFE', params: [],
    aliases: ['turn on wifi', 'enable wifi', 'start wifi', 'turn my wifi on', 'wifi on', 'turn the wifi on', 'activate wifi'], sampleInput: 'turn the wifi on'
  },
  {
    id: 'network.wifi.off', folder: 'network/wifi.off', domain: 'network', action: 'wifi.off',
    name: 'Turn Wi-Fi Off', desc: 'Disables system Wi-Fi wireless networking radio interface to conserve power and disconnect from wireless networks.',
    category: 'Networking', risk: 'SAFE', params: [],
    aliases: ['turn off wifi', 'disable wifi', 'stop wifi', 'turn my wifi off', 'wifi off', 'turn the wifi off', 'disconnect wifi', 'turn wifi off'], sampleInput: 'turn the wifi off'
  },
  {
    id: 'network.bluetooth.list', folder: 'network/bluetooth.list', domain: 'network', action: 'bluetooth.list',
    name: 'List Bluetooth Devices', desc: 'Scans and lists all discoverable Bluetooth devices, including paired and connected devices.',
    category: 'Networking', risk: 'SAFE', params: [],
    aliases: ['list bluetooth devices', 'show bluetooth', 'bluetooth devices', 'show me all the bluetooth devices', 'what bt devices are nearby'], sampleInput: 'show me all the bluetooth devices',
    customWorkflowCapability: 'shell.core',
    customWorkflowParams: { command: "system_profiler", args: ["SPBluetoothDataType"] }
  },
  {
    id: 'network.bluetooth.on', folder: 'network/bluetooth.on', domain: 'network', action: 'bluetooth.on',
    name: 'Turn Bluetooth On', desc: 'Enables system Bluetooth hardware radio transmitter.',
    category: 'Networking', risk: 'SAFE', params: [],
    aliases: ['turn on bluetooth', 'enable bluetooth', 'start bluetooth', 'turn my bluetooth on', 'bluetooth on'], sampleInput: 'turn my bluetooth on'
  },
  {
    id: 'network.bluetooth.off', folder: 'network/bluetooth.off', domain: 'network', action: 'bluetooth.off',
    name: 'Turn Bluetooth Off', desc: 'Disables system Bluetooth hardware radio transmitter to conserve power.',
    category: 'Networking', risk: 'SAFE', params: [],
    aliases: ['turn off bluetooth', 'disable bluetooth', 'stop bluetooth', 'turn bluetooth off', 'bluetooth off'], sampleInput: 'turn bluetooth off'
  },
  {
    id: 'network.bluetooth.connect', folder: 'network/bluetooth.connect', domain: 'network', action: 'bluetooth.connect',
    name: 'Connect to Bluetooth Device', desc: 'Establishes wireless link to paired Bluetooth headphones, speakers, or peripheral device.',
    category: 'Networking', risk: 'LOW', params: [{ name: 'device', type: 'string', desc: 'Device name or MAC address', required: true }],
    aliases: ['connect bluetooth device', 'pair bluetooth headphones', 'connect airpods', 'connect bluetooth'], sampleInput: 'connect bluetooth device AirPods Pro'
  },
  {
    id: 'network.ping', folder: 'network/ping', domain: 'network', action: 'ping',
    name: 'Ping Network Host', desc: 'Sends ICMP echo packets to test network reachability and packet latency (ping).',
    category: 'Networking', risk: 'SAFE', params: [
      { name: 'host', type: 'string', desc: 'Target hostname or IP address', required: true },
      { name: 'count', type: 'number', desc: 'Number of ICMP packets to send', required: false, default: 4 }
    ],
    aliases: ['ping host', 'test connection to', 'check network ping', 'ping'], sampleInput: 'ping host google.com'
  },
  {
    id: 'network.traceroute', folder: 'network/traceroute', domain: 'network', action: 'traceroute',
    name: 'Traceroute Network Path', desc: 'Traces packet routing gateway hops across Internet to target destination host.',
    category: 'Networking', risk: 'SAFE', params: [{ name: 'host', type: 'string', desc: 'Target hostname or destination IP', required: true }],
    aliases: ['traceroute host', 'trace network path', 'trace hops to', 'traceroute'], sampleInput: 'traceroute host github.com'
  },
  {
    id: 'network.ports', folder: 'network/ports', domain: 'network', action: 'ports',
    name: 'Inspect Open Network Ports', desc: 'Lists open listening TCP/UDP network ports and binding process IDs (lsof/netstat).',
    category: 'Networking', risk: 'SAFE', params: [{ name: 'port', type: 'number', desc: 'Optional specific port number to check binding', required: false }],
    aliases: ['list listening ports', 'open ports', 'check port usage', 'what is using port', 'network ports'], sampleInput: 'check open network ports'
  },
  {
    id: 'network.interfaces', folder: 'network/interfaces', domain: 'network', action: 'interfaces',
    name: 'Inspect Network Interfaces', desc: 'Queries system physical and virtual network adapters, status, and MAC addresses.',
    category: 'Networking', risk: 'SAFE', params: [],
    aliases: ['list network interfaces', 'show adapters', 'ifconfig status', 'ip link show', 'network interfaces'], sampleInput: 'show network interfaces'
  },
  {
    id: 'network.dns', folder: 'network/dns', domain: 'network', action: 'dns',
    name: 'Query DNS Domain Records', desc: 'Performs DNS resolution lookup for A, CNAME, MX, and TXT records (dig/nslookup).',
    category: 'Networking', risk: 'SAFE', params: [
      { name: 'domain', type: 'string', desc: 'Target domain name to query', required: true },
      { name: 'recordType', type: 'string', desc: 'Record type A, AAAA, MX, CNAME, TXT, or ALL', required: false, default: 'ALL' }
    ],
    aliases: ['lookup dns', 'nslookup domain', 'dig domain records', 'check dns records', 'dns lookup'], sampleInput: 'lookup dns records for openai.com'
  },
  {
    id: 'network.ip', folder: 'network/ip', domain: 'network', action: 'ip',
    name: 'Resolve System IP Addresses', desc: 'Retrieves active local LAN IP addresses and public facing WAN internet IP.',
    category: 'Networking', risk: 'SAFE', params: [],
    aliases: ['my ip address', 'what is my public ip', 'show local ip', 'check ip address', 'what is my ip'], sampleInput: 'what is my public ip address'
  },

  // ─── 9. SYSTEM DIAGNOSTICS DOMAIN ───
  {
    id: 'system.info', folder: 'system/info', domain: 'system', action: 'info',
    name: 'Get System Diagnostic Info', desc: 'Retrieves OS platform, kernel version, machine architecture, computer specs and uptime metrics.',
    category: 'System', risk: 'SAFE', params: [],
    aliases: ['system info', 'show os version', 'machine diagnostics', 'uname status', 'sysinfo', 'what are my computer specs?', 'what are my computer specs', 'computer specs'], sampleInput: 'what are my computer specs?'
  },
  {
    id: 'system.battery', folder: 'system/battery', domain: 'system', action: 'battery',
    name: 'Check Battery Level & Power Status', desc: 'Queries internal laptop battery charging percentage, time remaining, and power source.',
    category: 'System', risk: 'SAFE', params: [],
    aliases: ['check battery', 'battery status', 'power level', 'how much battery left'], sampleInput: 'check battery status'
  },
  {
    id: 'system.cpu', folder: 'system/cpu', domain: 'system', action: 'cpu',
    name: 'Inspect CPU Utilization', desc: 'Monitors real-time processor core load percentages and frequency metrics.',
    category: 'System', risk: 'SAFE', params: [],
    aliases: ['cpu usage', 'processor load', 'check cpu load', 'show processor stats'], sampleInput: 'check cpu usage'
  },
  {
    id: 'system.gpu', folder: 'system/gpu', domain: 'system', action: 'gpu',
    name: 'Inspect GPU Acceleration Status', desc: 'Queries active graphics hardware model, video VRAM usage, and rendering utilization.',
    category: 'System', risk: 'SAFE', params: [],
    aliases: ['gpu usage', 'graphics card status', 'check gpu', 'video card diagnostics'], sampleInput: 'check gpu status'
  },
  {
    id: 'system.ram', folder: 'system/ram', domain: 'system', action: 'ram',
    name: 'Inspect RAM Memory Capacity', desc: 'Checks total physical system RAM capacity, actively allocated memory, and free cache.',
    category: 'System', risk: 'SAFE', params: [],
    aliases: ['ram usage', 'check memory left', 'free memory', 'how much ram available'], sampleInput: 'check ram usage'
  },
  {
    id: 'system.storage', folder: 'system/storage', domain: 'system', action: 'storage',
    name: 'Inspect Storage Health & Volumes', desc: 'Lists mounted disk partitions, filesystem volume formats, and SSD health status.',
    category: 'System', risk: 'SAFE', params: [],
    aliases: ['storage status', 'check disk health', 'mounted drives', 'list partitions'], sampleInput: 'check storage drives and health'
  },
  {
    id: 'system.processes', folder: 'system/processes', domain: 'system', action: 'processes',
    name: 'Monitor Active OS Processes', desc: 'Lists top CPU or memory consuming processes, daemons, and background services.',
    category: 'System', risk: 'SAFE', params: [
      { name: 'sort', type: 'string', desc: 'Sort criteria: cpu or ram', required: false, default: 'cpu' },
      { name: 'count', type: 'number', desc: 'Number of top processes to list', required: false, default: 15 }
    ],
    aliases: ['show running processes', 'top processes', 'list background tasks', 'activity monitor'], sampleInput: 'show top 10 processes by cpu usage'
  },
  {
    id: 'system.temperature', folder: 'system/temperature', domain: 'system', action: 'temperature',
    name: 'Check Thermal Sensors', desc: 'Queries CPU core thermal diode and fan cooling subsystem temperature metrics.',
    category: 'System', risk: 'SAFE', params: [],
    aliases: ['check computer temperature', 'cpu temp', 'thermal sensors', 'is computer running hot'], sampleInput: 'check system cpu temperature'
  },
  {
    id: 'system.uptime', folder: 'system/uptime', domain: 'system', action: 'uptime',
    name: 'Query System Uptime Duration', desc: 'Displays time elapsed since last operating system boot and average system loads.',
    category: 'System', risk: 'SAFE', params: [],
    aliases: ['system uptime', 'how long has computer been running', 'check boot duration'], sampleInput: 'check system uptime'
  },
  {
    id: 'system.kill_process', folder: 'system/kill_process', domain: 'system', action: 'kill_process',
    name: 'Kill System Process', desc: 'Terminates an active system process or background task by process name or PID.',
    category: 'System', risk: 'HIGH', params: [
      { name: 'process', type: 'string', desc: 'Process name or PID to terminate', required: true }
    ],
    aliases: ['kill process', 'kill any process', 'terminate process', 'stop process', 'end task', 'killall', 'pkill', 'force kill', 'kill'], sampleInput: 'kill process node'
  },

  // ─── 10. DEVELOPER TOOLING DOMAIN ───
  {
    id: 'shell.execute', folder: 'shell/execute', domain: 'shell', action: 'execute',
    name: 'Execute Terminal Shell Command', desc: 'Executes standard Unix command or shell instruction inside interactive terminal session.',
    category: 'Shell', risk: 'MEDIUM', params: [
      { name: 'command', type: 'string', desc: 'Command line parameter string to run', required: true },
      { name: 'cwd', type: 'string', desc: 'Working directory path', required: false }
    ],
    aliases: ['run command', 'execute shell', 'terminal exec', 'bash command'], sampleInput: 'run shell command ls -l'
  },
  {
    id: 'developer.vscode', folder: 'developer/vscode', domain: 'developer', action: 'vscode',
    name: 'Open in Visual Studio Code', desc: 'Launches VS Code IDE editor (`code`) opening specified project folder or file path.',
    category: 'Developer', risk: 'SAFE', params: [{ name: 'path', type: 'string', desc: 'Project directory or file path to open in VS Code', required: false, default: '.' }],
    aliases: ['open in vscode', 'code open', 'open visual studio code', 'launch vscode'], sampleInput: 'open current folder in vscode'
  },
  {
    id: 'developer.cursor', folder: 'developer/cursor', domain: 'developer', action: 'cursor',
    name: 'Open in Cursor AI IDE', desc: 'Launches Cursor AI Code Editor (`cursor`) on target repository workspace.',
    category: 'Developer', risk: 'SAFE', params: [{ name: 'path', type: 'string', desc: 'Workspace path to launch in Cursor', required: false, default: '.' }],
    aliases: ['open in cursor', 'launch cursor ai', 'cursor editor open'], sampleInput: 'open workspace in cursor'
  },
  {
    id: 'developer.xcode', folder: 'developer/xcode', domain: 'developer', action: 'xcode',
    name: 'Open in Apple Xcode IDE', desc: 'Opens Xcode workspace, project bundle, or Apple developer development suite (`xed`).',
    category: 'Developer', risk: 'SAFE', params: [{ name: 'path', type: 'string', desc: 'Path to .xcodeproj, .xcworkspace, or swift folder', required: false, default: '.' }],
    aliases: ['open in xcode', 'launch xcode ide', 'open ios project'], sampleInput: 'open ios project in xcode'
  },
  {
    id: 'developer.android_studio', folder: 'developer/android_studio', domain: 'developer', action: 'android_studio',
    name: 'Open in Android Studio', desc: 'Launches Google Android Studio IDE environment on target Android workspace.',
    category: 'Developer', risk: 'SAFE', params: [{ name: 'path', type: 'string', desc: 'Android project directory path', required: false, default: '.' }],
    aliases: ['open in android studio', 'launch android studio', 'open android project'], sampleInput: 'open mobile project in android studio'
  },
  {
    id: 'developer.terminal', folder: 'developer/terminal', domain: 'developer', action: 'terminal',
    name: 'Launch Standalone Terminal', desc: 'Spawns a new native GUI Terminal emulator window (Terminal.app, iTerm2, Alacritty) at path.',
    category: 'Developer', risk: 'SAFE', params: [{ name: 'path', type: 'string', desc: 'Starting working directory path for new terminal', required: false, default: '.' }],
    aliases: ['open terminal window', 'new terminal here', 'launch terminal at folder'], sampleInput: 'open terminal window at ./src'
  },
  {
    id: 'developer.ssh', folder: 'developer/ssh', domain: 'developer', action: 'ssh',
    name: 'Connect via SSH Remote Session', desc: 'Establishes secure shell (SSH) remote terminal connection to destination server host.',
    category: 'Developer', risk: 'LOW', params: [
      { name: 'target', type: 'string', desc: 'SSH connection string e.g. user@hostname', required: true },
      { name: 'port', type: 'number', desc: 'Remote SSH TCP server port', required: false, default: 22 }
    ],
    aliases: ['ssh connect', 'open ssh session', 'remote shell connect'], sampleInput: 'ssh connect to admin@production-server'
  },
  {
    id: 'developer.github', folder: 'developer/github', domain: 'developer', action: 'github',
    name: 'Interact with GitHub CLI', desc: 'Executes GitHub repository workflows via official `gh` CLI or opens repository in web.',
    category: 'Developer', risk: 'LOW', params: [{ name: 'command', type: 'string', desc: 'GitHub workflow command e.g. pr create, issue list, repo view', required: true }],
    aliases: ['github cli', 'gh command', 'check github pull requests', 'open repo on github'], sampleInput: 'github cli command pr list'
  },
];

console.log(`[build_tools] Beginning bundle generation for ${toolSpecs.length} tools across 10 priority domains...`);

let bundleImports = '';
let bundleElements = '';

toolSpecs.forEach((spec, index) => {
  const folderAbsPath = path.join(toolsDir, spec.folder);
  fs.mkdirSync(folderAbsPath, { recursive: true });

  const tagsSet = new Set([
    spec.domain,
    spec.action,
    ...spec.id.split('.'),
    ...spec.id.split('_'),
    ...spec.name.toLowerCase().split(' '),
    ...spec.aliases.map(a => a.split(' ')[0])
  ]);
  const tags = Array.from(tagsSet).filter(t => t.length > 1);

  // 1. tool.json
  const toolJson = {
    id: spec.id,
    version: "1.0.0",
    displayName: spec.name,
    description: spec.desc,
    domain: spec.domain,
    category: spec.category,
    tags: tags,
    aliases: spec.aliases,
    supportedPlatforms: ["macos", "windows", "linux"],
    requiredPermissions: spec.domain === 'filesystem' ? ["ReadFiles"] : ["ShellExecution"],
    securityRisk: spec.risk,
    parameters: spec.params.filter(p => p.required).map(p => ({
      name: p.name,
      type: p.type,
      description: p.desc,
      required: p.required,
      ...(p.default !== undefined ? { default: p.default } : {})
    })),
    optionalParameters: spec.params.filter(p => !p.required).map(p => ({
      name: p.name,
      type: p.type,
      description: p.desc,
      required: p.required,
      ...(p.default !== undefined ? { default: p.default } : {})
    })),
    estimatedExecutionTime: spec.risk === 'SAFE' ? "1s" : "2s",
    confirmationRequired: spec.risk === 'HIGH' || spec.risk === 'CRITICAL',
    rollbackAvailable: ['copy', 'move', 'rename', 'trash', 'duplicate'].includes(spec.action),
    verificationSupported: true,
    deprecationStatus: "stable"
  };
  fs.writeFileSync(path.join(folderAbsPath, 'tool.json'), JSON.stringify(toolJson, null, 2) + '\n');

  // 2. workflow.json
  const workflowParams = spec.customWorkflowParams || spec.params.reduce((acc, p) => {
    acc[p.name] = `{{${p.name}}}`;
    return acc;
  }, {});

  const workflowJson = {
    toolId: spec.id,
    version: "1.0.0",
    description: `Executes native driver for ${spec.name}.`,
    steps: [
      {
        id: "step_exec_main",
        name: `Execute ${spec.name}`,
        type: "ExecuteCapability",
        capabilityId: spec.customWorkflowCapability || spec.id,
        parameters: workflowParams,
        dependencies: [],
        onError: "fail"
      }
    ],
    successCondition: "step:step_exec_main:success",
    errorHandling: {
      strategy: "fail_fast",
      maxRetries: spec.domain === 'network' ? 1 : 0
    }
  };
  fs.writeFileSync(path.join(folderAbsPath, 'workflow.json'), JSON.stringify(workflowJson, null, 2) + '\n');

  // 3. knowledge.json
  const entityHints = {};
  spec.params.forEach(p => {
    entityHints[p.name] = [p.name === 'path' ? '/Users/shared/file.json' : 'test_value'];
  });
  
  const abbrev = {};
  if (spec.id.includes('bluetooth') || spec.aliases.some(a => a.includes('bluetooth') || a.includes('bt'))) {
    abbrev.bt = "bluetooth";
  }
  if (spec.id.includes('system.info') || spec.aliases.some(a => a.includes('sysinfo'))) {
    abbrev.sysinfo = "system info";
  }

  const knowledgeJson = {
    toolId: spec.id,
    aliases: spec.aliases,
    synonyms: spec.aliases.map(a => `please ${a}`),
    commonUserWording: [spec.sampleInput, `could you ${spec.sampleInput}`, ...spec.aliases],
    commonMistakes: [],
    entityHints,
    deviceNamingPatterns: [],
    commonAbbreviations: abbrev,
    languageVariations: [spec.sampleInput, ...spec.aliases],
    relatedTools: []
  };
  fs.writeFileSync(path.join(folderAbsPath, 'knowledge.json'), JSON.stringify(knowledgeJson, null, 2) + '\n');

  // 4. examples.json
  const exampleEntities = {};
  spec.params.filter(p => p.required).forEach(p => {
    exampleEntities[p.name] = p.name === 'path' || p.name === 'source' ? '/test/path.txt' : 'sample_val';
  });
  const examplesJson = {
    toolId: spec.id,
    examples: [
      {
        input: spec.sampleInput,
        expectedIntent: { domain: spec.domain, action: spec.action },
        expectedEntities: exampleEntities,
        description: `Example execution of ${spec.name}`
      }
    ]
  };
  fs.writeFileSync(path.join(folderAbsPath, 'examples.json'), JSON.stringify(examplesJson, null, 2) + '\n');

  // 5. tests.json
  const testsJson = {
    toolId: spec.id,
    tests: [
      {
        id: `${spec.domain}-${spec.action}-test-1`,
        userRequest: spec.sampleInput,
        expectedIntent: { domain: spec.domain, action: spec.action },
        expectedToolId: spec.id,
        expectedEntities: exampleEntities,
        description: `Automated test case for ${spec.name}`
      }
    ]
  };
  fs.writeFileSync(path.join(folderAbsPath, 'tests.json'), JSON.stringify(testsJson, null, 2) + '\n');

  // Add to BundledTools TypeScript mapping generator
  const varPrefix = `tool_${index}`;
  bundleImports += `import t_${index} from '../../../tools/${spec.folder}/tool.json';\n`;
  bundleImports += `import w_${index} from '../../../tools/${spec.folder}/workflow.json';\n`;
  bundleImports += `import k_${index} from '../../../tools/${spec.folder}/knowledge.json';\n`;
  bundleImports += `import e_${index} from '../../../tools/${spec.folder}/examples.json';\n`;
  bundleImports += `import s_${index} from '../../../tools/${spec.folder}/tests.json';\n`;

  bundleElements += `  {\n`;
  bundleElements += `    tool: t_${index} as any, workflow: w_${index} as any,\n`;
  bundleElements += `    knowledge: k_${index} as any, examples: e_${index} as any,\n`;
  bundleElements += `    tests: s_${index} as any, folderPath: 'tools/${spec.folder}'\n`;
  bundleElements += `  },\n`;
});

const bundledToolsContent = `/**
 * BundledTools.ts — Auto-generated Static Tool Bundler Map
 * 
 * Generates direct static import bindings for all ${toolSpecs.length} OS capabilities across 10 priority domains.
 * DO NOT EDIT MANUALLY. Generated by src/tools/loader/build_tools.mjs
 */

export interface RawToolBundle {
  tool: any;
  workflow: any;
  knowledge: any;
  examples: any;
  tests: any;
  folderPath: string;
}

${bundleImports}
export const BUNDLED_TOOLS: RawToolBundle[] = [
${bundleElements}];
`;

const loaderDir = path.join(rootDir, 'src', 'tools', 'loader');
fs.mkdirSync(loaderDir, { recursive: true });
fs.writeFileSync(path.join(loaderDir, 'BundledTools.ts'), bundledToolsContent);

console.log(`[build_tools] Successfully generated ${toolSpecs.length} tool bundle folders and src/tools/loader/BundledTools.ts!`);
