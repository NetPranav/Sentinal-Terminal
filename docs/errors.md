# Known Errors and Troubleshooting

## 1. Terminal Disposed Error on HMR (Hot Module Replacement)
- **Symptom**: Terminal accepts keystrokes but does not echo text back to the screen after a Vite hot reload.
- **Cause**: The `SessionManager` singleton held onto old output listener callbacks. When the component unmounted and the terminal was disposed, the old callback threw an error, breaking the callback loop.
- **Resolution**: Implemented cleanup logic in `TerminalView.tsx` `useEffect` return to correctly call `sessionManager.offOutput(currentSessionId, outputCallback)`.

## 2. Transparent Window Click-Through (macOS)
- **Symptom**: Clicks pass through the terminal window directly to the desktop; unable to focus terminal.
- **Cause**: The ThemeManager was missing a call to `injectCSSVariables` on startup, causing `#root` to have no background color while `body` had `transparent`.
- **Resolution**: Enforced initialization of CSS variables during ThemeManager instantiation.

## 3. WebGL Addon Failure
- **Symptom**: Warning logged: `WebGL addon could not be loaded`.
- **Cause**: Occurs occasionally depending on the environment's hardware acceleration constraints.
- **Resolution**: Falls back gracefully to xterm's Canvas/DOM renderer. No breaking action required.
