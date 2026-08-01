# Sentinel Command Line Launcher (`sentinel`)

The `sentinel` CLI executable allows developers to interact with the Sentinel Terminal desktop application directly from standard macOS command shells.

## Installation
The standalone launcher is installed automatically to `/usr/local/bin/sentinel` (or fallback `~/.local/bin/sentinel`) when completing the **Initial Setup Wizard** inside Sentinel Terminal.

## Command Reference

| Command | Description |
| :--- | :--- |
| `sentinel` or `sentinel .` | Open a new Sentinel Terminal window at current working directory |
| `sentinel /path/to/project` | Open Sentinel at the specified folder |
| `sentinel --new-tab [path]` | Spawn a new tab inside the current active window |
| `sentinel --split [path]` | Split the active pane horizontally/vertically |
| `sentinel --run "<command>"` | Launch Sentinel and immediately execute an interactive instruction |
| `sentinel --help`, `-h` | Print summary of available commands |

## Technical Mechanism
Under the hood, the `sentinel` command line interface encodes target filesystem paths and commands into the `sentinel://` custom macOS protocol handler, resulting in instant application activation without spawning extraneous processes.
