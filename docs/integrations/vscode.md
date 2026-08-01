# Visual Studio Code Terminal Integration

Configure Sentinel Terminal as your integrated desktop terminal emulator inside Visual Studio Code.

## Automated Wizard Configuration
1. Open Sentinel Terminal.
2. If greeted by the Initial Setup Wizard, toggle **Enable IDE Profiles**. Otherwise, access the wizard via the **Personalization** menu.
3. Sentinel automatically edits your global VS Code user settings at `~/Library/Application Support/Code/User/settings.json`.

## Manual Settings Injection
Add the profile directly to your VS Code user configurations:

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

## Developer Workflow
When integrated, opening a terminal panel in VS Code (`Control+~`) spins up a high-speed Sentinel PTY session inheriting your TrueColor themes and dotfile settings.
