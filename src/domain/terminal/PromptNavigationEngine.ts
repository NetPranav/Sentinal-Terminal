/**
 * PromptNavigationEngine.ts — Terminal Line & Cursor Navigation vs History Guard
 * 
 * Part of Issue 9:
 * Prevents GNU Readline from discarding user-drafted multi-line or edited prompts
 * when pressing Up/Down arrow keys.
 * 
 * - If editing a multi-row prompt (wrapped across visual terminal lines):
 *   Moves the cursor visually UP / DOWN one line within the prompt buffer
 *   using column-offset navigation sequences.
 * - If the cursor has navigated horizontally inside a draft prompt:
 *   Moves the cursor to the beginning / end of the draft instead of wiping the buffer with history.
 * - If at an empty prompt line:
 *   Passes Up/Down arrows to the shell to allow normal history cycling.
 * - If inside an alternate screen buffer (vim, htop, less):
 *   Never intercepts; passes all arrow keys directly to the active TUI.
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
  hasNavigatedCursorInLine?: boolean;
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

    // Reconstruct full prompt text across all participating rows
    let fullText = '';
    for (let r = startRow; r <= endRow; r++) {
      if (input.lines[r]) {
        fullText += input.lines[r].text;
      }
    }

    // Strip shell prompt prefix (e.g. "user@host:~$ ", "❯ ", etc.)
    const promptMatch = fullText.match(/.*(?:[$%#❯])\s*/);
    const rawInput = promptMatch ? fullText.substring(promptMatch[0].length) : fullText;
    const trimmedInput = rawInput.trim();

    // 2. Empty input at prompt: Allow normal shell history cycling
    if (trimmedInput.length === 0) {
      return { handled: false, action: 'pass-to-history' };
    }

    const isAiPrompt = trimmedInput.startsWith('>');
    const cols = Math.max(1, input.cols);

    // 3. Multi-row prompt navigation (wrapped across 2 or more visual terminal rows)
    if (totalRows > 1) {
      if (input.direction === 'up') {
        if (currentRowOffset > 0) {
          // Move up one visual row in the text
          return {
            handled: true,
            action: 'move-up-line',
            payload: '\x1b[D'.repeat(cols),
          };
        } else {
          // Already on top line of multi-row prompt: Move to start of text
          return {
            handled: true,
            action: 'move-to-start',
            payload: '\x01', // Beginning-of-line (Ctrl+A)
          };
        }
      } else {
        // direction === 'down'
        if (currentRowOffset < totalRows - 1) {
          // Move down one visual row in the text
          return {
            handled: true,
            action: 'move-down-line',
            payload: '\x1b[C'.repeat(cols),
          };
        } else {
          // Already on bottom line of multi-row prompt: Move to end of text
          return {
            handled: true,
            action: 'move-to-end',
            payload: '\x05', // End-of-line (Ctrl+E)
          };
        }
      }
    }

    // 4. Single-row line handling (totalRows === 1)
    const endOfTextCol = input.lines[input.cursorY]?.text.trimEnd().length ?? 0;
    const isCursorNavigatedInside = input.hasNavigatedCursorInLine || input.cursorX < endOfTextCol;

    if (input.direction === 'up') {
      if (isAiPrompt || isCursorNavigatedInside) {
        // User is editing or composing text: Move to start rather than wiping with history
        return {
          handled: true,
          action: 'move-to-start',
          payload: '\x01',
        };
      }
      // User is at end of line without manual horizontal navigation: allow history
      return { handled: false, action: 'pass-to-history' };
    } else {
      // direction === 'down'
      if (isAiPrompt || isCursorNavigatedInside) {
        // Move to end of text
        return {
          handled: true,
          action: 'move-to-end',
          payload: '\x05',
        };
      }
      return { handled: false, action: 'pass-to-history' };
    }
  }
}
