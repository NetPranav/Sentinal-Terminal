import { RetryPolicy } from '../workflow/types';

export class RetryEngine {
  public static shouldRetry(policy: RetryPolicy | undefined, currentAttempt: number): boolean {
    if (!policy) return false;
    if (policy.type === 'none') return false;
    if (currentAttempt >= policy.maxAttempts) return false;
    return true;
  }

  public static async waitDelay(policy: RetryPolicy, currentAttempt: number): Promise<void> {
    if (policy.type === 'fixed') {
      await new Promise(r => setTimeout(r, policy.delayMs));
    } else if (policy.type === 'exponential') {
      const delay = policy.delayMs * Math.pow(2, currentAttempt);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}
