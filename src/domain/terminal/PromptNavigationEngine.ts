/**
 * PromptNavigationEngine.ts — Terminal Line & Cursor Navigation vs History Guard
 * 
 * Issue 9 Specification:
 * 1. Default History Browsing:
 *    If the cursor is behind the last character (trailing space at end of line)
 *    or on the first character (first symbol, number, or alphabet), Up and Down
 *    arrow perform Default History Browsing through previous commands and prompts.
 * 2. In-Command Horizontal Navigation:
 *    Left and Right arrow navigate within the written command.
 * 3. In-Buffer Line Navigation in Long Prompts/Commands:
 *    Once the user has used the Left Arrow to move on or ahead of the last character
 *    (inside the text, cursorX <= lastCharCol) or used the Right Arrow to move behind
 *    the first character (inside the text, cursorX > firstCharCol), Up and Down arrows
 *    move between lines in the long prompt or command (totalRows > 1).
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
  isAlternateBuffer?: boolean;
}

export interface NavigationDecision {
  handled: boolean;
  action: 'move-up-line' | 'move-down-line' | 'move-to-start' | 'move-to-end' | 'pass-to-history';
  payload?: string;
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
      return { handled: false, action: 'pass-to-history' };
    }

    if (!input.lines || input.lines.length === 0) {
      return { handled: false, action: 'pass-to-history' };
    }

    const { startRow, endRow, totalRows, currentRowOffset } = this.getPromptRowRange(
      input.lines,
      input.cursorY
    );

    // Single-row commands: Up and Down arrow always navigate through previous commands and prompts
    if (totalRows <= 1) {
      return { handled: false, action: 'pass-to-history' };
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
      return { handled: false, action: 'pass-to-history' };
    }

    // Rule: "If the cursor is behind the last character or on the first character user should be able to perform the Default History Browsing using the up and down arrow."
    // 1. Behind the last character (trailing space after the last character on targetEndRow)
    if (input.cursorY === targetEndRow && input.cursorX > lastCharCol) {
      return { handled: false, action: 'pass-to-history' };
    }

    // 2. On or ahead of the first character on startRow
    if (input.cursorY === startRow && input.cursorX <= firstCharCol) {
      return { handled: false, action: 'pass-to-history' };
    }

    // Rule: "once the user has used the left arrow to move on or ahead of the last character or used the right arrow to move behind the first character, then user should be able to use the up and down arrows to move between lines in the long prompt or command."
    const cols = Math.max(1, input.cols);

    if (input.direction === 'up') {
      if (currentRowOffset > 0) {
        // Move up one visual line
        return {
          handled: true,
          action: 'move-up-line',
          payload: '\x1b[D'.repeat(cols),
        };
      } else {
        // On top line (startRow), move to start of text (onto first character)
        return {
          handled: true,
          action: 'move-to-start',
          payload: '\x01',
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
        };
      } else {
        // On bottom line (endRow), move to end of text (behind last character)
        return {
          handled: true,
          action: 'move-to-end',
          payload: '\x05',
        };
      }
    }
  }
}
