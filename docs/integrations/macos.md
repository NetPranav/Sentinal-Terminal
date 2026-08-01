# macOS Native OS Integration Architecture

Sentinel Terminal is structured as a first-class native desktop terminal emulator on macOS, adhering to established conventions pioneered by Terminal.app, iTerm2, and Ghostty.

## Application Registration
In `src-tauri/tauri.conf.json`, Sentinel registers:
- **Application Category**: `public.app-category.developer-tools`
- **Custom Protocol Scheme**: `sentinel://`
- **Minimum OS Compatibility**: macOS 12.0 Monterey

## PTY Spawning & Login Shells
When a terminal tab opens, Sentinel utilizes `ShellAdapter` to detect the user's default login shell (e.g., `/bin/zsh`, `/usr/local/bin/fish`). 
Spawns are executed with the login shell flag (`-l` or `--login`), ensuring environment initialization scripts (`.zprofile`, `.bash_profile`, `.config/fish/config.fish`) are properly sourced.

## Environment Variables
Every interactive session spawned by Sentinel exports standard terminal emulation identifiers:
- `TERM=xterm-256color`
- `COLORTERM=truecolor`
- `TERM_PROGRAM=Sentinel Terminal`
- `TERM_PROGRAM_VERSION=0.1.0`
- `SENTINEL_TERMINAL=1`
- `LANG=en_US.UTF-8`
- `LC_ALL=en_US.UTF-8`

## Protocol Routing & Deep-Link Reception
Via Tauri v2 `RunEvent::Opened`, any folder or URI launched via Launch Services (`open -a "Sentinel Terminal" <path>`) is immediately received by the Rust backend and routed to React views via `"sentinel-url"` events.
