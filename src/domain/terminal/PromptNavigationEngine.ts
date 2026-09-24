/**
 * PromptNavigationEngine.ts — Terminal Line & Cursor Navigation vs History Guard
 * 
 * Issue 9 Specification:
 * 1. Top and down arrow move through previous commands and prompts.
 * 2. Left and right arrow navigate within the command.
 * 3. In order to move through lines in the prompt, user must use the right arrow once
 *    to move the cursor ahead of the last character:
 *    - If cursor is ahead of the last character: Up and Down arrow move up and down in lines.
 *    - If cursor is on or behind the last character: Up and Down arrow navigate through previous commands and prompts.
 *    - If cursor is ahead or on the first character: Up and Down arrow navigate through previous commands and prompts.
 * 
 * By last and first character: the last or first symbol, number or alphabet present in the command or prompt.
 */

export interface BufferLineInfo {
  text: string;
  isWrapped: boolean;
}

export interface NavigationEvaluationInput {
  direction: 'up' | 'down';
  cursorX: number;
  cursorY: number;
  cols: number;
  lines: BufferLineInfo[];
  baseY?: number;
  hasPressedRightArrow?: boolean;
  isLineNavigating?: boolean;
  isAlternateBuffer?: boolean;
}

export interface NavigationDecision {
  handled: boolean;
  action: 'move-up-line' | 'move-down-line' | 'pass-to-history';
  payload?: string;
  setLineNavigating?: boolean;
}

export class PromptNavigationEngine {
  /**
   * Determine boundaries of the current command/prompt in the terminal buffer.
   */
  public static getPromptRowRange(
    lines: BufferLineInfo[],
    cursorY: number
  ): {
    startRow: number;
    endRow: number;
    totalRows: number;
    currentRowOffset: number;
  } {
    const safeCursorY = Math.max(0, Math.min(cursorY, lines.length - 1));

    // Walk backwards while current row is a wrapped continuation of previous row
    let startRow = safeCursorY;
    while (startRow > 0 && lines[startRow]?.isWrapped) {
      startRow--;
    }

    // Walk forwards while next row is a wrapped continuation
    let endRow = safeCursorY;
    while (endRow < lines.length - 1 && lines[endRow + 1]?.isWrapped) {
      endRow++;
    }

    const totalRows = Math.max(1, endRow - startRow + 1);
    const currentRowOffset = Math.max(0, safeCursorY - startRow);

    return {
      startRow,
      endRow,
      totalRows,
      currentRowOffset,
    };
  }

  /**
   * Evaluates an arrow key event (Up or Down) and determines whether to perform
   * in-buffer line navigation or allow standard shell history cycling.
   */
  public static evaluateNavigation(input: NavigationEvaluationInput): NavigationDecision {
    // 1. TUI / Full-screen alternate buffer guard (vim, nano, htop, less)
    if (input.isAlternateBuffer) {
      return { handled: false, action: 'pass-to-history', setLineNavigating: false };
    }

    if (!input.lines || input.lines.length === 0) {
      return { handled: false, action: 'pass-to-history', setLineNavigating: false };
    }

    const { startRow, endRow, totalRows, currentRowOffset } = this.getPromptRowRange(
      input.lines,
      input.cursorY
    );

    // Single-row commands: Up and Down arrow always navigate through previous commands and prompts
    if (totalRows <= 1) {
      return { handled: false, action: 'pass-to-history', setLineNavigating: false };
    }

    // Find first character of the prompt/command on startRow
    // The command/prompt starts after any standard shell prompt prefix (e.g. "user@host:~$ ")
    const startLineRaw = input.lines[startRow]?.text || '';
    const promptMatch = startLineRaw.match(/.*(?:[$%#❯])\s*/);
    const prefixLen = promptMatch ? promptMatch[0].length : 0;
    const commandPart = startLineRaw.substring(prefixLen);
    const firstCharRelIdx = commandPart.search(/\S/);
    const firstCharCol = firstCharRelIdx !== -1 ? prefixLen + firstCharRelIdx : prefixLen;

    // Find last character of the prompt/command across endRow (walking backwards if empty)
    let lastCharCol = -1;
    let targetEndRow = endRow;
    while (targetEndRow >= startRow && lastCharCol === -1) {
      const endLineText = input.lines[targetEndRow]?.text || '';
      for (let c = endLineText.length - 1; c >= 0; c--) {
        if (/\S/.test(endLineText[c])) {
          lastCharCol = c;
          break;
        }
      }
      if (lastCharCol === -1) {
        targetEndRow--;
      }
    }

    // If completely empty prompt, allow normal history cycling
    if (lastCharCol === -1) {
      return { handled: false, action: 'pass-to-history', setLineNavigating: false };
    }

    // Check if cursor is ahead or on the first character
    // "Also if the cursor is ahead or on the first character user should be able to move to the previous ran commands and prompts using the up and down arrow."
    if (input.cursorY === startRow && input.cursorX <= firstCharCol) {
      return { handled: false, action: 'pass-to-history', setLineNavigating: false };
    }

    const cols = Math.max(1, input.cols);

    // If line navigation mode is currently active:
    if (input.isLineNavigating) {
      if (input.direction === 'up') {
        if (currentRowOffset > 0) {
          // Move up one visual line
          return {
            handled: true,
            action: 'move-up-line',
            payload: '\x1b[D'.repeat(cols),
            setLineNavigating: true,
          };
        } else {
          // Reached the top line of prompt: switch to previous ran commands and prompts
          return {
            handled: false,
            action: 'pass-to-history',
            setLineNavigating: false,
          };
        }
      } else {
        // direction === 'down'
        if (currentRowOffset < totalRows - 1) {
          // Move down one visual line
          return {
            handled: true,
            action: 'move-down-line',
            payload: '\x1b[C'.repeat(cols),
            setLineNavigating: true,
          };
        } else {
          // Reached the bottom line: switch to history
          return {
            handled: false,
            action: 'pass-to-history',
            setLineNavigating: false,
          };
        }
      }
    }

    // If line navigation is NOT yet active:
    // User must have used the right arrow once to move the cursor ahead of the last character
    const isAheadOfLastChar =
      input.cursorY === targetEndRow && input.cursorX > lastCharCol;

    if (input.hasPressedRightArrow && isAheadOfLastChar) {
      if (input.direction === 'up') {
        // Enter line navigation mode and move up one visual line
        return {
          handled: true,
          action: 'move-up-line',
          payload: '\x1b[D'.repeat(cols),
          setLineNavigating: true,
        };
      } else {
        // Already at bottom line: pass down arrow to history
        return {
          handled: false,
          action: 'pass-to-history',
          setLineNavigating: false,
        };
      }
    }

    // In all other cases (cursor is on or behind the last character, or right arrow wasn't pressed):
    // "if the cursor is on or behind the last character user should be able to navigate through previous commands and prompts."
    return {
      handled: false,
      action: 'pass-to-history',
      setLineNavigating: false,
    };
  }
}
