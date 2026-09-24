import { describe, it, expect } from 'vitest';
import { PromptNavigationEngine, BufferLineInfo } from './PromptNavigationEngine';

describe('PromptNavigationEngine (Issue 9 Behavioral Rules)', () => {
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
    // Rule 1: By default, top and down arrow move through previous commands and prompts
    it('passes arrow keys directly to history on single-line commands', () => {
      const lines: BufferLineInfo[] = [
        { text: 'user@host:~$ ls -la', isWrapped: false },
      ];
      const decision = PromptNavigationEngine.evaluateNavigation({
        direction: 'up',
        cursorX: 20,
        cursorY: 0,
        cols: 80,
        lines,
        hasPressedRightArrow: false,
      });
      expect(decision.handled).toBe(false);
      expect(decision.action).toBe('pass-to-history');
    });

    it('passes arrow keys directly to history on empty prompt line', () => {
      const decision = PromptNavigationEngine.evaluateNavigation({
        direction: 'up',
        cursorX: 13,
        cursorY: 0,
        cols: 80,
        lines: [{ text: 'user@host:~$ ', isWrapped: false }],
        hasPressedRightArrow: false,
      });
      expect(decision.handled).toBe(false);
      expect(decision.action).toBe('pass-to-history');
    });

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

    // Rule 3: If cursor is on or behind the last character, user navigates through previous commands and prompts
    it('passes to history if cursor is on or behind the last character in multi-row prompt', () => {
      const lines: BufferLineInfo[] = [
        { text: 'user@host:~$ > Create test workspace', isWrapped: false }, // row 0
        { text: 'with three files inside.', isWrapped: true },              // row 1 (last char '.' is at index 23)
      ];

      // Cursor is at col 15 (behind '.' at col 23)
      const decisionBehind = PromptNavigationEngine.evaluateNavigation({
        direction: 'up',
        cursorX: 15,
        cursorY: 1,
        cols: 50,
        lines,
        hasPressedRightArrow: false,
      });
      expect(decisionBehind.handled).toBe(false);
      expect(decisionBehind.action).toBe('pass-to-history');

      // Cursor is at col 23 (ON the last character '.')
      const decisionOn = PromptNavigationEngine.evaluateNavigation({
        direction: 'up',
        cursorX: 23,
        cursorY: 1,
        cols: 50,
        lines,
        hasPressedRightArrow: false,
      });
      expect(decisionOn.handled).toBe(false);
      expect(decisionOn.action).toBe('pass-to-history');
    });

    // Rule 3: If cursor is ahead or on the first character, user moves to previous ran commands and prompts
    it('passes to history if cursor is ahead or on the first character', () => {
      const lines: BufferLineInfo[] = [
        { text: 'user@host:~$ > Create test workspace', isWrapped: false }, // row 0 (prefix len 14, '>' at col 14)
        { text: 'with three files inside.', isWrapped: true },              // row 1
      ];

      // Cursor on first character '>' (col 14)
      const decisionOnFirst = PromptNavigationEngine.evaluateNavigation({
        direction: 'up',
        cursorX: 14,
        cursorY: 0,
        cols: 50,
        lines,
        hasPressedRightArrow: false,
      });
      expect(decisionOnFirst.handled).toBe(false);
      expect(decisionOnFirst.action).toBe('pass-to-history');

      // Cursor ahead/before first character (col 5)
      const decisionBeforeFirst = PromptNavigationEngine.evaluateNavigation({
        direction: 'up',
        cursorX: 5,
        cursorY: 0,
        cols: 50,
        lines,
        hasPressedRightArrow: false,
      });
      expect(decisionBeforeFirst.handled).toBe(false);
      expect(decisionBeforeFirst.action).toBe('pass-to-history');
    });

    // Rule 3: User uses right arrow once to move ahead of the last character -> allows moving up and down lines
    it('moves up one line when user pressed right arrow and cursor is ahead of last character', () => {
      const cols = 50;
      const lines: BufferLineInfo[] = [
        { text: 'user@host:~$ > Create test workspace', isWrapped: false }, // row 0
        { text: 'with three files inside.', isWrapped: true },              // row 1 (last char '.' at col 23)
      ];

      // Cursor is at col 24 (ahead of last character '.') and hasPressedRightArrow is true
      const decision = PromptNavigationEngine.evaluateNavigation({
        direction: 'up',
        cursorX: 24,
        cursorY: 1,
        cols,
        lines,
        hasPressedRightArrow: true,
      });

      expect(decision.handled).toBe(true);
      expect(decision.action).toBe('move-up-line');
      expect(decision.payload).toBe('\x1b[D'.repeat(cols));
      expect(decision.setLineNavigating).toBe(true);
    });

    it('passes to history if cursor is ahead of last character but right arrow was NOT pressed', () => {
      const cols = 50;
      const lines: BufferLineInfo[] = [
        { text: 'user@host:~$ > Create test workspace', isWrapped: false }, // row 0
        { text: 'with three files inside.', isWrapped: true },              // row 1
      ];

      // Cursor is at col 24, but user did NOT use right arrow (e.g. loaded from history)
      const decision = PromptNavigationEngine.evaluateNavigation({
        direction: 'up',
        cursorX: 24,
        cursorY: 1,
        cols,
        lines,
        hasPressedRightArrow: false,
      });

      expect(decision.handled).toBe(false);
      expect(decision.action).toBe('pass-to-history');
    });

    // Line navigation mode transitions
    it('continues moving up and down lines while isLineNavigating is active', () => {
      const cols = 50;
      const lines: BufferLineInfo[] = [
        { text: 'user@host:~$ > First line of prompt', isWrapped: false }, // row 0
        { text: 'Second line of prompt', isWrapped: true },                // row 1
        { text: 'Third line of prompt.', isWrapped: true },                // row 2
      ];

      // On row 1 moving up while line navigation is active
      const moveUpDecision = PromptNavigationEngine.evaluateNavigation({
        direction: 'up',
        cursorX: 10,
        cursorY: 1, // row 1
        cols,
        lines,
        isLineNavigating: true,
      });
      expect(moveUpDecision.handled).toBe(true);
      expect(moveUpDecision.action).toBe('move-up-line');
      expect(moveUpDecision.payload).toBe('\x1b[D'.repeat(cols));
      expect(moveUpDecision.setLineNavigating).toBe(true);

      // On row 1 moving down while line navigation is active
      const moveDownDecision = PromptNavigationEngine.evaluateNavigation({
        direction: 'down',
        cursorX: 10,
        cursorY: 1, // row 1
        cols,
        lines,
        isLineNavigating: true,
      });
      expect(moveDownDecision.handled).toBe(true);
      expect(moveDownDecision.action).toBe('move-down-line');
      expect(moveDownDecision.payload).toBe('\x1b[C'.repeat(cols));
      expect(moveDownDecision.setLineNavigating).toBe(true);
    });

    it('switches back to history when Up arrow is pressed at the top line during line navigation', () => {
      const cols = 50;
      const lines: BufferLineInfo[] = [
        { text: 'user@host:~$ > First line of prompt', isWrapped: false }, // row 0 (top line)
        { text: 'Second line of prompt.', isWrapped: true },               // row 1
      ];

      // On row 0 (top line) moving up while line navigation is active
      const decision = PromptNavigationEngine.evaluateNavigation({
        direction: 'up',
        cursorX: 20,
        cursorY: 0, // row 0
        cols,
        lines,
        isLineNavigating: true,
      });

      expect(decision.handled).toBe(false);
      expect(decision.action).toBe('pass-to-history');
      expect(decision.setLineNavigating).toBe(false);
    });

    it('switches back to history when Down arrow is pressed at the bottom line during line navigation', () => {
      const cols = 50;
      const lines: BufferLineInfo[] = [
        { text: 'user@host:~$ > First line of prompt', isWrapped: false }, // row 0
        { text: 'Second line of prompt.', isWrapped: true },               // row 1 (bottom line)
      ];

      // On row 1 (bottom line) moving down while line navigation is active
      const decision = PromptNavigationEngine.evaluateNavigation({
        direction: 'down',
        cursorX: 20,
        cursorY: 1, // row 1
        cols,
        lines,
        isLineNavigating: true,
      });

      expect(decision.handled).toBe(false);
      expect(decision.action).toBe('pass-to-history');
      expect(decision.setLineNavigating).toBe(false);
    });
  });
});
