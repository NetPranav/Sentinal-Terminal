import { LocalModel } from '../conversation/LocalModel';
import { ConversationResult, EntityType, NormalizedGoal } from '../conversation/ConversationTypes';
import { GoalNode, PlanningState } from './PlannerTypes';
import { GOAL_DECOMPOSITION_PROMPT } from './PlannerPrompts';
import { randomUUID } from 'crypto';
import { z } from 'zod';

export class TaskDecomposer {
  constructor(private model: LocalModel) {}

  /**
   * Decomposes a root GoalNode into an array of sub-GoalNodes.
   * Uses fast heuristic templates for known goals, falls back to LLM.
   */
  public async decompose(rootGoal: GoalNode, result: ConversationResult): Promise<GoalNode[]> {
    const heuristicNodes = this.tryHeuristicDecomposition(rootGoal);
    if (heuristicNodes) {
      return heuristicNodes;
    }

    return this.llmDecomposition(rootGoal, result);
  }

  private tryHeuristicDecomposition(root: GoalNode): GoalNode[] | null {
    const boundEntities = root.boundEntities;

    switch (root.goal) {
      case 'bluetooth.connect': {
        const checkBluetooth: GoalNode = {
          id: 'check-bt',
          title: 'Check Bluetooth State',
          description: 'Determine if Bluetooth is currently enabled',
          goal: 'bluetooth.status',
          dependencies: [],
          parentGoalId: root.id,
          requiredEntities: [],
          boundEntities,
          planningState: 'unsatisfied',
          reasoning: 'Need to ensure Bluetooth is on before connecting.',
          confidence: 1.0,
          platformIndependent: true,
        };
        const enableBluetooth: GoalNode = {
          id: 'enable-bt',
          title: 'Enable Bluetooth',
          description: 'Turn on the Bluetooth radio',
          goal: 'bluetooth.enable',
          dependencies: [{ nodeId: 'check-bt', required: true }],
          parentGoalId: root.id,
          requiredEntities: [],
          boundEntities,
          planningState: 'unsatisfied',
          reasoning: 'Bluetooth must be enabled to connect to a device.',
          confidence: 1.0,
          platformIndependent: true,
        };
        const scanDevices: GoalNode = {
          id: 'scan-bt',
          title: 'Scan Devices',
          description: 'Scan for available Bluetooth devices in range',
          goal: 'bluetooth.scan',
          dependencies: [{ nodeId: 'enable-bt', required: true }],
          parentGoalId: root.id,
          requiredEntities: [],
          boundEntities,
          planningState: 'unsatisfied',
          reasoning: 'Need to find the device before pairing.',
          confidence: 1.0,
          platformIndependent: true,
        };
        const locateDevice: GoalNode = {
          id: 'locate-bt',
          title: 'Locate Device',
          description: 'Find the specific device in the scan results',
          goal: 'bluetooth.find',
          dependencies: [{ nodeId: 'scan-bt', required: true }],
          parentGoalId: root.id,
          requiredEntities: ['bluetooth_device'],
          boundEntities,
          planningState: 'unsatisfied',
          reasoning: 'Identify the target device address.',
          confidence: 1.0,
          platformIndependent: true,
        };
        const connectDevice: GoalNode = {
          id: 'connect-bt',
          title: 'Connect Device',
          description: 'Establish a connection to the target Bluetooth device',
          goal: 'bluetooth.connect',
          dependencies: [{ nodeId: 'locate-bt', required: true }],
          parentGoalId: root.id,
          requiredEntities: ['bluetooth_device'],
          boundEntities,
          planningState: 'unsatisfied',
          reasoning: 'Final step to fulfill the user request.',
          confidence: 1.0,
          platformIndependent: true,
        };
        return [checkBluetooth, enableBluetooth, scanDevices, locateDevice, connectDevice];
      }

      case 'process.kill_by_port': {
        const findApp: GoalNode = {
          id: 'find-app',
          title: 'Find Application',
          description: 'Identify the application bound to the port',
          goal: 'application.find',
          dependencies: [],
          parentGoalId: root.id,
          requiredEntities: ['port'],
          boundEntities,
          planningState: 'unsatisfied',
          reasoning: 'Need to know which application is holding the port.',
          confidence: 1.0,
          platformIndependent: true,
        };
        const locateProc: GoalNode = {
          id: 'locate-proc',
          title: 'Locate Process',
          description: 'Find the process ID for the application',
          goal: 'process.locate',
          dependencies: [{ nodeId: 'find-app', required: true }],
          parentGoalId: root.id,
          requiredEntities: [],
          boundEntities,
          planningState: 'unsatisfied',
          reasoning: 'Process ID is required to terminate it.',
          confidence: 1.0,
          platformIndependent: true,
        };
        const killProc: GoalNode = {
          id: 'kill-proc',
          title: 'Kill Process',
          description: 'Terminate the identified process',
          goal: 'process.kill',
          dependencies: [{ nodeId: 'locate-proc', required: true }],
          parentGoalId: root.id,
          requiredEntities: [],
          boundEntities,
          planningState: 'unsatisfied',
          reasoning: 'Releases the port by stopping the process.',
          confidence: 1.0,
          platformIndependent: true,
        };
        return [findApp, locateProc, killProc];
      }
      
      case 'application.open': {
        const openApp: GoalNode = {
          id: 'open-app',
          title: 'Open Application',
          description: 'Launch the requested application',
          goal: 'application.open',
          dependencies: [],
          parentGoalId: root.id,
          requiredEntities: ['application'],
          boundEntities,
          planningState: 'unsatisfied',
          reasoning: 'Fulfills the user request to open the app.',
          confidence: 1.0,
          platformIndependent: true,
        };
        return [openApp];
      }
    }
    
    return null;
  }

  private async llmDecomposition(root: GoalNode, result: ConversationResult): Promise<GoalNode[]> {
    const prompt = GOAL_DECOMPOSITION_PROMPT
      .replace('{{goalId}}', root.goal)
      .replace('{{rawRequest}}', root.description);

    const schema = z.object({
      subGoals: z.array(z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
        goal: z.string(),
        dependsOn: z.array(z.string()),
        requiredEntities: z.array(z.string()),
        reasoning: z.string()
      }))
    });

    const response = await this.model.generateJSON<{
      subGoals: Array<{
        id: string;
        title: string;
        description: string;
        goal: string;
        dependsOn: string[];
        requiredEntities: string[];
        reasoning: string;
      }>
    }>(prompt, { maxRetries: 2, temperature: 0.1 });

    if (!response.data) {
      // If LLM fails completely, just return the root goal as a single node
      return [root];
    }

    const nodes: GoalNode[] = response.data.subGoals.map(sub => ({
      id: sub.id,
      title: sub.title,
      description: sub.description,
      goal: sub.goal as NormalizedGoal,
      dependencies: sub.dependsOn.map(depId => ({ nodeId: depId, required: true })),
      parentGoalId: root.id,
      requiredEntities: sub.requiredEntities as EntityType[],
      boundEntities: root.boundEntities, // Inherit bound entities
      planningState: 'unsatisfied',
      reasoning: sub.reasoning,
      confidence: 0.8, // LLM generated, slightly lower confidence
      platformIndependent: true,
    }));

    return nodes;
  }
}
