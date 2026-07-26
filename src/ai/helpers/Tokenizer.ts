export class Tokenizer {
  // A very basic approximation (e.g., 1 token ≈ 4 characters)
  public static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
