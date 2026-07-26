import { WorkflowStep } from './types';

export interface QueuedTask {
  id: string;
  workflowId: string;
  step: WorkflowStep;
  priority: number;
}

export class TaskQueue {
  private queue: QueuedTask[] = [];
  private isPaused = false;

  public enqueue(task: QueuedTask) {
    this.queue.push(task);
    this.sortQueue();
  }

  public dequeue(): QueuedTask | undefined {
    if (this.isPaused) return undefined;
    return this.queue.shift();
  }

  public peek(): QueuedTask | undefined {
    return this.queue[0];
  }

  public removeByWorkflowId(workflowId: string) {
    this.queue = this.queue.filter(t => t.workflowId !== workflowId);
  }

  public pause() {
    this.isPaused = true;
  }

  public resume() {
    this.isPaused = false;
  }

  public get length() {
    return this.queue.length;
  }

  private sortQueue() {
    // Higher priority number = executes first
    this.queue.sort((a, b) => b.priority - a.priority);
  }
}
