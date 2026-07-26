export class StringNormalizer {
  public static normalize(input: string): string {
    return input.toLowerCase().replace(/[^\w\s-]/gi, '').trim();
  }
}
