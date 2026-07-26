# Core Project Goals

1. **Security First**: All agent actions pass through a strict Execution Engine that checks permissions. No arbitrary bash injection vulnerabilities.
2. **AI First, Tool First**: The AI interacts with the OS via native SDKs and typed Capabilities whenever possible, falling back to shell only when necessary.
3. **100% Shell Compatibility**: The terminal must function flawlessly as a normal ZSH/Bash replacement even if AI is disabled.
4. **Cross-Platform**: Support macOS, Windows, and Linux via Tauri.
5. **Sub-10ms UI Latency**: All completions, theme switches, and basic interactions must occur in less than a frame.
6. **No Modes**: Users should not have to explicitly press a hotkey to switch between "Shell Mode" and "AI Mode." The router figures it out.
