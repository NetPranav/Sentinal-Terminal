import { describe, it, expect } from 'vitest';
import { PromptNavigationEngine, BufferLineInfo } from './PromptNavigationEngine';

describe('PromptNavigationEngine', () => {
  describe('getPromptRowRange', () => {
    it('calculates single-line range correctly', () => {
      const lines: BufferLineInfo[] = [
        { text: 'user@host:~$ ls', isWrapped: false },
      ];
      const range = PromptNavigationEngine.getPromptRowRange(lines, 0);
      expect(range.startRow).toBe(0);
      expect(range.endRow).toBe(0);
      expect(range.totalRows).toBe(1);
      expect(range.currentRowOffset).toBe(0);
    });

    it('calculates multi-row wrapped range correctly', () => {
      const lines: BufferLineInfo[] = [
        { text: 'previous command output', isWrapped: false },
        { text: 'user@host:~$ > Create a temporary testing workspace', isWrapped: false }, // row 1
        { text: 'at /tmp/sentinel-workflow-test. Inside it: create', isWrapped: true },  // row 2
        { text: 'frontend.txt and backend.txt', isWrapped: true },                       // row 3
      ];

      // Cursor on row 3 (bottom line, offset 2)
      const rangeRow3 = PromptNavigationEngine.getPromptRowRange(lines, 3);
      expect(rangeRow3.startRow).toBe(1);
      expect(rangeRow3.endRow).toBe(3);
      expect(rangeRow3.totalRows).toBe(3);
      expect(rangeRow3.currentRowOffset).toBe(2);

      // Cursor on row 2 (middle line, offset 1)
      const rangeRow2 = PromptNavigationEngine.getPromptRowRange(lines, 2);
      expect(rangeRow2.startRow).toBe(1);
      expect(rangeRow2.endRow).toBe(3);
      expect(rangeRow2.totalRows).toBe(3);
      expect(rangeRow2.currentRowOffset).toBe(1);

      // Cursor on row 1 (top line, offset 0)
      const rangeRow1 = PromptNavigationEngine.getPromptRowRange(lines, 1);
      expect(rangeRow1.startRow).toBe(1);
      expect(rangeRow1.endRow).toBe(3);
      expect(rangeRow1.totalRows).toBe(3);
      expect(rangeRow1.currentRowOffset).toBe(0);
    });
  });

  describe('evaluateNavigation', () => {
    it('passes arrow keys directly when alternate screen buffer is active (vim/htop)', () => {
      const decision = PromptNavigationEngine.evaluateNavigation({
        direction: 'up',
        cursorX: 5,
        cursorY: 2,
        cols: 80,
        lines: [{ text: 'vim editing buffer', isWrapped: false }],
        isAlternateBuffer: true,
      });
      expect(decision.handled).toBe(false);
      expect(decision.action).toBe('pass-to-history');
    });

    it('passes arrow keys directly when prompt line is empty', () => {
      const decision = PromptNavigationEngine.evaluateNavigation({
        direction: 'up',
        cursorX: 13,
        cursorY: 0,
        cols: 80,
        lines: [{ text: 'user@host:~$ ', isWrapped: false }],
        isAlternateBuffer: false,
      });
      expect(decision.handled).toBe(false);
      expect(decision.action).toBe('pass-to-history');
    });

    it('moves up one visual row in multi-row prompt when cursor is on lower row', () => {
      const cols = 50;
      const lines: BufferLineInfo[] = [
        { text: 'user@host:~$ > Create a test workspace', isWrapped: false }, // row 0
        { text: 'with three files inside', isWrapped: true },                 // row 1
      ];

      const decision = PromptNavigationEngine.evaluateNavigation({
        direction: 'up',
        cursorX: 15,
        cursorY: 1, // row 1
        cols,
        lines,
        isAlternateBuffer: false,
      });

      expect(decision.handled).toBe(true);
      expect(decision.action).toBe('move-up-line');
      expect(decision.payload).toBe('\x1b[D'.repeat(cols));
    });

    it('moves to beginning of prompt when Up arrow is pressed on top row of multi-row prompt', () => {
      const cols = 50;
      const lines: BufferLineInfo[] = [
        { text: 'user@host:~$ > Create a test workspace', isWrapped: false }, // row 0
        { text: 'with three files inside', isWrapped: true },                 // row 1
      ];

      const decision = PromptNavigationEngine.evaluateNavigation({
        direction: 'up',
        cursorX: 30,
        cursorY: 0, // row 0 (top line)
        cols,
        lines,
        isAlternateBuffer: false,
      });

      expect(decision.handled).toBe(true);
      expect(decision.action).toBe('move-to-start');
      expect(decision.payload).toBe('\x01');
    });

    it('moves down one visual row in multi-row prompt when cursor is on upper row', () => {
      const cols = 50;
      const lines: BufferLineInfo[] = [
        { text: 'user@host:~$ > Create a test workspace', isWrapped: false }, // row 0
        { text: 'with three files inside', isWrapped: true },                 // row 1
      ];

      const decision = PromptNavigationEngine.evaluateNavigation({
        direction: 'down',
        cursorX: 20,
        cursorY: 0, // row 0
        cols,
        lines,
        isAlternateBuffer: false,
      });

      expect(decision.handled).toBe(true);
      expect(decision.action).toBe('move-down-line');
      expect(decision.payload).toBe('\x1b[C'.repeat(cols));
    });

    it('moves to end of prompt when Down arrow is pressed on bottom row of multi-row prompt', () => {
      const cols = 50;
      const lines: BufferLineInfo[] = [
        { text: 'user@host:~$ > Create a test workspace', isWrapped: false }, // row 0
        { text: 'with three files inside', isWrapped: true },                 // row 1
      ];

      const decision = PromptNavigationEngine.evaluateNavigation({
        direction: 'down',
        cursorX: 10,
        cursorY: 1, // row 1 (bottom line)
        cols,
        lines,
        isAlternateBuffer: false,
      });

      expect(decision.handled).toBe(true);
      expect(decision.action).toBe('move-to-end');
      expect(decision.payload).toBe('\x05');
    });

    it('prevents history overwrite on single line when user has navigated left into text', () => {
      const lines: BufferLineInfo[] = [
        { text: 'user@host:~$ git commit -m "fix typos"', isWrapped: false },
      ];

      // Cursor moved to col 18 (inside the text)
      const decision = PromptNavigationEngine.evaluateNavigation({
        direction: 'up',
        cursorX: 18,
        cursorY: 0,
        cols: 80,
        lines,
        hasNavigatedCursorInLine: true,
        isAlternateBuffer: false,
      });

      expect(decision.handled).toBe(true);
      expect(decision.action).toBe('move-to-start');
      expect(decision.payload).toBe('\x01');
    });

    it('allows normal history cycling on single line when user is at end and has not navigated inside', () => {
      const lines: BufferLineInfo[] = [
        { text: 'user@host:~$ git status', isWrapped: false },
      ];

      // Cursor is at end of line (col 23) and hasNavigatedCursorInLine is false
      const decision = PromptNavigationEngine.evaluateNavigation({
        direction: 'up',
        cursorX: 23,
        cursorY: 0,
        cols: 80,
        lines,
        hasNavigatedCursorInLine: false,
        isAlternateBuffer: false,
      });

      expect(decision.handled).toBe(false);
      expect(decision.action).toBe('pass-to-history');
    });

    it('always protects AI prompt (">") from accidental history overwrite on single line', () => {
      const lines: BufferLineInfo[] = [
        { text: 'user@host:~$ > list files in project', isWrapped: false },
      ];

      const decision = PromptNavigationEngine.evaluateNavigation({
        direction: 'up',
        cursorX: 36,
        cursorY: 0,
        cols: 80,
        lines,
        hasNavigatedCursorInLine: false,
        isAlternateBuffer: false,
      });

      expect(decision.handled).toBe(true);
      expect(decision.action).toBe('move-to-start');
      expect(decision.payload).toBe('\x01');
    });

    it('allows normal history cycling for shell command with output redirect when cursor is at end', () => {
      const lines: BufferLineInfo[] = [
        { text: 'user@host:~$ echo "hello" > output.txt', isWrapped: false },
      ];

      const decision = PromptNavigationEngine.evaluateNavigation({
        direction: 'up',
        cursorX: 38,
        cursorY: 0,
        cols: 80,
        lines,
        hasNavigatedCursorInLine: false,
        isAlternateBuffer: false,
      });

      expect(decision.handled).toBe(false);
      expect(decision.action).toBe('pass-to-history');
    });
  });
});
