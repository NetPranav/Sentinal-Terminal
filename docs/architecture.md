# Sentinel Terminal Architecture

## Overview
Sentinel Terminal is a cross-platform, AI-powered terminal designed to behave exactly like a native terminal, but with deep natural language routing and deterministic UI workflows built in.

## Core Modules
1. **Frontend (Vite + React + xterm.js)**: 
   - Renders the GPU-accelerated terminal.
   - Manages Theme Engine (CSS variables).
   - Manages Autocomplete Engine (History, Capabilities).
2. **Backend (Tauri + Rust)**:
   - Spawns and manages PTYs (Pseudo-terminals).
   - Secures environment variables.
3. **Execution Engine & Security**:
   - Single gateway for all commands.
   - Permission management.
4. **Workflow Engine**:
   - Executes multi-step DAG workflows JSON structures.
5. **AI Planner**:
   - Translates goals into Workflows.
