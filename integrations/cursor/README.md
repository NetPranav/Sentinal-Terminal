# Sentinel Terminal — Cursor IDE Integration

Integrate **Sentinel Terminal** as your default modern terminal emulator inside Cursor IDE on macOS.

## Automated Setup via Setup Wizard

In Sentinel Terminal, open the **Installer Setup Wizard** and toggle **Enable IDE Profiles**. Sentinel automatically discovers and configures your Cursor user preferences at:
`~/Library/Application Support/Cursor/User/settings.json`

## Manual Profile Installation

Copy the contents of `cursor-profile.json` directly into your Cursor `settings.json` file:

```json
{
  "terminal.integrated.profiles.osx": {
    "Sentinel Terminal": {
      "path": "/Applications/Sentinel Terminal.app/Contents/MacOS/Sentinel Terminal",
      "icon": "terminal",
      "overrideName": true
    }
  },
  "terminal.integrated.defaultProfile.osx": "Sentinel Terminal"
}
```

## Benefits in Cursor
- **AI Intent Parity**: Consistent terminal environment variables (`SENTINEL_TERMINAL=1`).
- **High-Performance PTY**: Smooth scrolling with a 100,000-line scrollback capacity.
- **Auto-Detection**: Works out of the box with custom `zsh`, `bash`, `fish`, and `nushell` dotfile themes.
