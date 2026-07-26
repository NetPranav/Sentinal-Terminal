# 🎬 Sentinel Terminal Demo Media & Screenshot Gallery

This folder is designed to host your demonstration GIFs, videos, and high-resolution screenshots for GitHub presentations and documentation displays.

## 🖼️ Required Demo Files & Placeholders

To populate the visual sections of the root `README.md`, save your recorded demo files in this directory using the suggested filenames below:

1. **`sentinel-demo-hero.gif`**  
   - **Where it appears**: Main hero header in `README.md`.  
   - **Recommended content**: A fast-paced 45-60 second animation showing Sentinel starting up, running standard bash/zsh commands, and performing conversational commands like `"take me to Downloads folder"` and `"tell me all the png files in the Downloads folder"`.

2. **`split-screen-workspace.png`**  
   - **Where it appears**: "Why Sentinel Terminal?" highlights section in `README.md`.  
   - **Recommended content**: High-resolution screenshot of Sentinel displaying horizontal and vertical split terminal screens, showing the minimal classic glassmorphism theme, dynamic directory hierarchies, and the system clock in the bottom status bar.

3. **`app-management-demo.gif`**  
   - **Where it appears**: Conversational Interaction section in `README.md`.  
   - **Recommended content**: Demonstration showing commands like `"open youtube.com in safari"`, launching the browser directly to YouTube, followed by typing `"stop safari"` or `"kill antigravity"` to show automated process elimination.

4. **`security-engine-prompt.png`**  
   - **Where it appears**: Architecture & Security section in `README.md`.  
   - **Recommended content**: Screenshot showing the zero-trust Security Engine evaluation logs or an interactive administrative permission prompt blocking a destructive action.

---

## 🛠️ How to Enable Media in your README.md

Once you add your files to this directory, open the root `README.md` and simply uncomment or replace the bracketed text with standard markdown image syntax:

```markdown
<!-- Replace this placeholder text in README.md: -->
[ 🎥 Insert Main Hero Demonstration GIF / Video Here: e.g. ./docs/images/sentinel-demo-hero.gif ]

<!-- With actual markdown syntax: -->
![Sentinel Hero Demo](./docs/images/sentinel-demo-hero.gif)
```

For large demonstration videos (MP4), you can also drag-and-drop the `.mp4` video files directly into the GitHub web README editor, and GitHub will automatically embed an interactive video player!
