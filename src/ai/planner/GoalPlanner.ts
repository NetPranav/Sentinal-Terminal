import { ConversationResult } from '../conversation/ConversationTypes';
import { ExecutionPlan, CurrentSystemState, GoalNode } from './PlannerTypes';
import { GoalResolver } from './GoalResolver';
import { TaskDecomposer } from './TaskDecomposer';
import { DependencyResolver } from './DependencyResolver';
import { PlanningStrategy } from './PlanningStrategy';
import { PlanValidator } from './PlanValidator';
import { PlannerContext } from './PlannerContext';
import { PlannerMemory } from './PlannerMemory';
import { TelemetryTracker } from './PlannerTelemetry';
import { LocalModel } from '../conversation/LocalModel';

export class GoalPlanner {
  private goalResolver = new GoalResolver();
  private decomposer: TaskDecomposer;
  private dependencyResolver = new DependencyResolver();
  private validator = new PlanValidator();
  private memory = new PlannerMemory();

  constructor(model: LocalModel) {
    this.decomposer = new TaskDecomposer(model);
  }

  /**
   * Translates a ConversationResult into a structured ExecutionPlan.
   * Completely platform and execution independent.
   */
  public async plan(
    result: ConversationResult,
    systemState?: CurrentSystemState
  ): Promise<ExecutionPlan> {
    const telemetry = new TelemetryTracker();
    telemetry.start();

    // 1. Context Setup
    const context = new PlannerContext(systemState);
    const strategy = new PlanningStrategy(context);

    // 2. Goal Resolution (Normalization to canonical root goal)
    const rootGoal = this.goalResolver.resolve(result);

    // If goal is totally unknown or blocked immediately, return empty plan
    if (rootGoal.planningState === 'unknown' || rootGoal.planningState === 'blocked') {
      const emptyPlan: ExecutionPlan = {
        nodes: [rootGoal],
        topologicalOrder: [rootGoal.id],
        parallelGroups: [[rootGoal.id]],
        overallConfidence: rootGoal.confidence,
        missingEntities: [],
        isComplete: false,
        telemetry: telemetry.end(1, rootGoal.confidence)
      };
      // Validator might populate missing entities
      this.validator.validate(emptyPlan);
      return emptyPlan;
    }

    // 3. Memory Lookup
    let nodes = this.memory.get(rootGoal.goal);

    // 4. Task Decomposition (if not in memory)
    if (!nodes) {
      nodes = await this.decomposer.decompose(rootGoal, result);
      
      // Save to memory if highly confident
      this.memory.set(rootGoal.goal, nodes);
    } else {
      // Re-bind entities for cached nodes
      for (const n of nodes) {
        n.boundEntities = [...result.entities];
      }
    }

    // 5. Planning Strategy (Conditional skipping, hierarchy)
    nodes = strategy.applyStrategy(nodes);

    // 6. Dependency Resolution (DAG, cycles, parallel tiers)
    const { topologicalOrder, parallelGroups } = this.dependencyResolver.resolve(nodes);

    const plan: ExecutionPlan = {
      nodes,
      topologicalOrder,
      parallelGroups,
      overallConfidence: result.confidence,
      missingEntities: [],
      isComplete: false,
      telemetry: telemetry.end(nodes.length, result.confidence)
    };

    // 7. Validation
    this.validator.validate(plan);

    return plan;
  }
}
