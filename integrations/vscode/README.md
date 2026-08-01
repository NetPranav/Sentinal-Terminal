# Sentinel Terminal — VS Code Integration

This integration enables **Sentinel Terminal** as a first-class integrated desktop terminal profile inside Visual Studio Code on macOS.

## Quick Setup via Sentinel Installer

When launching Sentinel Terminal for the first time, simply click **"Enable IDE Profiles"** in the **Setup Wizard** (or accessible via **Personalization → AI & Shell Settings**).

Sentinel will automatically configure your global VS Code user settings (`~/Library/Application Support/Code/User/settings.json`).

## Manual Configuration

To manually configure Sentinel as your primary VS Code terminal profile, add the following entry to your `settings.json`:

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

## Features
- **TrueColor Support**: Automatically exports `TERM=xterm-256color` and `COLORTERM=truecolor`.
- **Login Shell Integration**: Respects `-l` and `--login` profiles across `zsh`, `bash`, `fish`, and `nushell`.
- **Context Menu Integration**: Right-click any folder in VS Code File Explorer and select **"Open in Sentinel Terminal"**.
