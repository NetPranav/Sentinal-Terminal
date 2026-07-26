import { Terminal } from '@xterm/xterm';

export class GhostTextRenderer {
  private terminal: Terminal;
  private overlayElement: HTMLDivElement | null = null;
  private currentSuggestion: string = '';

  constructor(terminal: Terminal) {
    this.terminal = terminal;
  }

  public attach(container: HTMLElement) {
    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'sentinel-ghost-text';
    this.overlayElement.style.position = 'absolute';
    this.overlayElement.style.pointerEvents = 'none';
    this.overlayElement.style.whiteSpace = 'pre';
    // Match theme CSS variables
    this.overlayElement.style.color = 'var(--sentinel-fg)';
    this.overlayElement.style.opacity = '0.4';
    this.overlayElement.style.fontFamily = 'var(--sentinel-font)';
    this.overlayElement.style.fontSize = 'var(--sentinel-font-size)';
    this.overlayElement.style.zIndex = '10';

    container.appendChild(this.overlayElement);
  }

  public render(suggestion: string, currentInput: string) {
    if (!this.overlayElement || !suggestion) {
      this.clear();
      return;
    }

    // Only render the part of the suggestion that hasn't been typed yet
    // E.g., if input is "git s" and suggestion is "git status", ghost text is "tatus"
    if (!suggestion.toLowerCase().startsWith(currentInput.toLowerCase())) {
      this.clear();
      return;
    }

    this.currentSuggestion = suggestion;
    const ghostPart = suggestion.substring(currentInput.length);

    // Calculate cursor position from xterm
    const buffer = this.terminal.buffer.active;
    const cursorX = buffer.cursorX;
    const cursorY = buffer.cursorY;

    // Use xterm's internal cell dimensions to position the overlay exactly over the cursor
    const core = (this.terminal as any)._core;
    const cellWidth = core._renderService?.dimensions?.actualCellWidth || 9;
    const cellHeight = core._renderService?.dimensions?.actualCellHeight || 17;

    const top = cursorY * cellHeight;
    const left = cursorX * cellWidth;

    this.overlayElement.style.top = `\${top}px`;
    this.overlayElement.style.left = `\${left}px`;
    this.overlayElement.textContent = ghostPart;
  }

  public clear() {
    this.currentSuggestion = '';
    if (this.overlayElement) {
      this.overlayElement.textContent = '';
    }
  }

  public getSuggestion(): string {
    return this.currentSuggestion;
  }
}
