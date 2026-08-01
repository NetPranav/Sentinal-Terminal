/**
 * ProgressEngine.ts — Multi-stage execution feedback
 */

export type ExecutionStage = 
  | 'Understanding' 
  | 'Planning' 
  | 'Resolving' 
  | 'Executing' 
  | 'Verifying' 
  | 'Learning' 
  | 'Complete';

export class ProgressEngine {
  private currentStage: ExecutionStage = 'Understanding';
  private subscribers: Set<(stage: ExecutionStage) => void> = new Set();

  public setStage(stage: ExecutionStage): void {
    this.currentStage = stage;
    this.subscribers.forEach(sub => sub(stage));
  }

  public getStage(): ExecutionStage {
    return this.currentStage;
  }

  public subscribe(cb: (stage: ExecutionStage) => void): void {
    this.subscribers.add(cb);
  }
}
