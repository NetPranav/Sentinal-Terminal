# Style and Design Guidelines

## Philosophy
Elegant, Minimal, Transparent, GPU Accelerated, Highly Customizable.

## Visual Design
- **Glassmorphism**: Heavy use of `backdrop-filter: blur(20px)` and semi-transparent backgrounds to integrate seamlessly with the user's desktop wallpaper.
- **Typography**: Uses modern coding fonts like `Fira Code` or `JetBrains Mono` with ligatures enabled.
- **Animations**: Subtle, high-performance CSS transitions. Zero UI freezing.

## UI Components
- **Terminal Area**: Unobstructed, edge-to-edge xterm.js instance.
- **Command Palette**: Centered overlay matching modern IDEs (VSCode style) but frosted.
- **Status Bar**: Low profile, icon-heavy status indicators at the bottom.
- **Ghost Text**: Faded inline completions rendered ahead of the cursor.

## Theme Engine
- Themes must be JSON format.
- Modifying a theme must update the UI instantly without React state thrashing (via DOM CSS variables).
