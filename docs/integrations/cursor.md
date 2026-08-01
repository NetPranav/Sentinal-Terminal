# Cursor IDE Integration Guide

Sentinel Terminal smoothly interfaces with Cursor IDE to offer state-of-the-art terminal emulation right inside your code editor.

## Why Use Sentinel in Cursor?
- **Consistent AI Context**: Your integrated terminal inherits identical variables (`SENTINEL_TERMINAL=1`) and PATH environments.
- **Enhanced Scrollback**: Retain up to 100,000 lines of terminal output across complex LLM generation flows.
- **Native Login Profiles**: Transparently executes your login shell (`zsh`, `bash`, `fish`, or `nushell`).

## Auto-Configure via Sentinel Setup Wizard
Launch Sentinel Terminal and click **Enable IDE Profiles** in the Setup Wizard. This injects the custom profile directly into Cursor user preferences:
`~/Library/Application Support/Cursor/User/settings.json`

## Manual JSON Settings
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
