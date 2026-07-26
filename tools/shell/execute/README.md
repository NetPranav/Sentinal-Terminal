# shell.execute

## Purpose
General-purpose fallback for executing arbitrary shell commands. Used when no specific tool matches the user's intent.

## Workflow
1. Confirm with user before executing
2. Run the command via `shell.core` capability
3. Return stdout/stderr/exit code

## Permissions
- `ShellExecution`

## Limitations
- Always requires user confirmation (security risk: MEDIUM)
- No rollback support
- No verification support

## Edge Cases
- Long-running commands may timeout (30s default)
- Interactive commands are not supported
