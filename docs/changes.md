# Changelog

## [Unreleased]
### Added
- **Command Palette**: `Cmd+Shift+P` UI for searching commands and capabilities.
- **Status Bar**: Live tracking of current shell, git branch, and memory/CPU usage.
- **Theme Engine**: JSON-based dynamic theming with sub-millisecond hot reloading via CSS variables.
- **Autocomplete Engine**: Supports multiple providers (History, Capabilities) with a strict 15ms latency budget.
- **Ghost Text**: `GhostText.ts` overlay for rendering inline intelligent completions inside `xterm.js`.
- **AI Planner**: Defined schemas for goal-to-workflow generation.

### Fixed
- Fixed unmount memory leak in `TerminalView.tsx` where dangling callbacks caused terminal output failures.
- Fixed click-through UI bug by correctly initializing CSS variables on startup.
- Fixed `App.tsx` keyboard event listeners crashing on undefined keys.
