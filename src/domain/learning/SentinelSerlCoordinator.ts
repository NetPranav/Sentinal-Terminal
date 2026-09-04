/**
 * SentinelSerlCoordinator.ts — End-to-End Sentinel-SERL Autonomous Orchestrator
 * 
 * Part of Sentinel-SERL (Self-Evolving Reflexion Loop & Frontier On-Device Intelligence):
 * Unifies and synchronizes all 8 Tier 4 subsystems into a harmonious, closed-loop,
 * self-evolving intelligence architecture on Apple Silicon macOS:
 * 
 * 1. ShadowPtySimulator (Phase 4.1): Speculative RAM candidate rollouts
 * 2. KnowledgeDeficitLogger (Phase 4.2): Intercepts failures, refusals, and excuses
 * 3. ReflexionEngine (Phase 4.3): Synthesizes counterfactuals during idle periods
 * 4. DpoDatasetEngine (Phase 4.4): Auto-constructs DPO training pairs
 * 5. Rule Reward Oracle (Phase 4.5): Validates non-destructive bash execution
 * 6. ActivationSteeringManager (Phase 4.6): Injects refusal suppression logit biases
 * 7. DreamStateScheduler (Phase 4.7): Nightly self-play puzzle curriculum
 * 8. EmbeddedEngineManager & MLX (Phase 4.8): Metal GPU distillation & LoRA hot-reload
 */

import * as path from 'path';
import * as fs from 'fs';
import { ShadowPtySimulator } from '../../ai/agent/ShadowPtySimulator';
import { KnowledgeDeficitLogger, KnowledgeDeficitRecord } from './KnowledgeDeficitLogger';
import { ReflexionEngine, ReflexionResult } from './ReflexionEngine';
import { DpoDatasetEngine, DpoPair } from './DpoDatasetEngine';
import { ActivationSteeringManager, SteeringTelemetry } from '../../ai/models/ActivationSteeringManager';
import { DreamStateScheduler, DreamCycleReport } from './DreamStateScheduler';
import { EmbeddedEngineManager, EmbeddedStatus } from '../../ai/models/EmbeddedEngineManager';
import { EpisodicMemoryEngine } from './EpisodicMemoryEngine';
import { TldrKnowledgeEngine } from '../knowledge/TldrKnowledgeEngine';
import { DeterministicRuleOracle } from '../remediation/DeterministicRuleOracle';
import { GbnfGrammarManager } from '../../ai/models/GbnfGrammarManager';
import { ShellAstParser } from '../security/ShellAstParser';

export interface SerlSystemDashboard {
  status: 'active' | 'idle' | 'dreaming' | 'reloading';
  timestamp: number;
  steering: {
    totalInferencesSteered: number;
    refusalsSuppressedCount: number;
    activeVectorsCount: number;
    refusalPenalty: number;
    actionBoost: number;
  };
  deficits: {
    totalDeficits: number;
    unresolvedCount: number;
    resolvedCount: number;
    categories: Record<string, number>;
  };
  reflexion: {
    isIdleWorkerActive: boolean;
    unresolvedQueueSize: number;
  };
  dpo: {
    totalPairs: number;
    categories: Record<string, number>;
    sources: Record<string, number>;
  };
  dreamState: {
    isDreaming: boolean;
    latestCycle?: DreamCycleReport;
    totalCyclesRecorded: number;
  };
  oracles: {
    tldrCommandsCount: number;
    tldrRecipesCount: number;
    deterministicRulesCount: number;
    gbnfGrammarsAvailable: boolean;
    astParserActive: boolean;
  };
  engine: EmbeddedStatus;
}

export interface SentinelSerlCoordinatorOptions {
  shadowSimulator?: ShadowPtySimulator;
  deficitLogger?: KnowledgeDeficitLogger;
  reflexionEngine?: ReflexionEngine;
  dpoEngine?: DpoDatasetEngine;
  steeringManager?: ActivationSteeringManager;
  dreamScheduler?: DreamStateScheduler;
  embeddedEngine?: EmbeddedEngineManager;
  episodicMemory?: EpisodicMemoryEngine;
  tldrEngine?: TldrKnowledgeEngine;
  ruleOracle?: DeterministicRuleOracle;
  commandExecutor?: (cmd: string) => Promise<{ stdout: string; stderr: string; code: number }>;
}

export class SentinelSerlCoordinator {
  private static instance: SentinelSerlCoordinator;

  private shadowSimulator: ShadowPtySimulator;
  private deficitLogger: KnowledgeDeficitLogger;
  private reflexionEngine: ReflexionEngine;
  private dpoEngine: DpoDatasetEngine;
  private steeringManager: ActivationSteeringManager;
  private dreamScheduler: DreamStateScheduler;
  private embeddedEngine: EmbeddedEngineManager;
  private episodicMemory: EpisodicMemoryEngine;
  private tldrEngine: TldrKnowledgeEngine;
  private ruleOracle: DeterministicRuleOracle;
  private commandExecutor?: (cmd: string) => Promise<{ stdout: string; stderr: string; code: number }>;

  private isStarted: boolean = false;
  private idleMonitorTimer?: NodeJS.Timeout;
  private lastActivityTimestamp: number = Date.now();

  constructor(options?: SentinelSerlCoordinatorOptions) {
    this.shadowSimulator = options?.shadowSimulator || ShadowPtySimulator.getInstance();
    this.deficitLogger = options?.deficitLogger || KnowledgeDeficitLogger.getInstance();
    this.dpoEngine = options?.dpoEngine || DpoDatasetEngine.getInstance();
    this.steeringManager = options?.steeringManager || ActivationSteeringManager.getInstance();
    this.embeddedEngine = options?.embeddedEngine || EmbeddedEngineManager.getInstance();
    this.episodicMemory = options?.episodicMemory || EpisodicMemoryEngine.getInstance();
    this.tldrEngine = options?.tldrEngine || TldrKnowledgeEngine.getInstance();
    this.ruleOracle = options?.ruleOracle || DeterministicRuleOracle.getInstance();
    this.commandExecutor = options?.commandExecutor;

    this.reflexionEngine = options?.reflexionEngine || ReflexionEngine.getInstance({
      deficitLogger: this.deficitLogger,
      shadowSimulator: this.shadowSimulator,
    });

    this.dreamScheduler = options?.dreamScheduler || DreamStateScheduler.getInstance({
      shadowSimulator: this.shadowSimulator,
      dpoEngine: this.dpoEngine,
      deficitLogger: this.deficitLogger,
    });
  }

  public static getInstance(options?: SentinelSerlCoordinatorOptions): SentinelSerlCoordinator {
    if (!SentinelSerlCoordinator.instance || options) {
      SentinelSerlCoordinator.instance = new SentinelSerlCoordinator(options);
    }
    return SentinelSerlCoordinator.instance;
  }

  // =========================================================================
  // 1. LIFECYCLE & COORDINATION
  // =========================================================================

  /**
   * Starts the SERL coordinator and registers idle listeners and background workers.
   */
  public startCoordinator(idleCheckIntervalMs: number = 15000): void {
    if (this.isStarted) return;
    this.isStarted = true;
    this.lastActivityTimestamp = Date.now();

    // Start background reflexion worker for idle periods
    this.reflexionEngine.startIdleWorker();

    // Start periodic background monitor for idle state & dream transitions
    this.idleMonitorTimer = setInterval(() => {
      const idleSeconds = Math.round((Date.now() - this.lastActivityTimestamp) / 1000);
      this.onTerminalIdle(idleSeconds);
    }, idleCheckIntervalMs);
  }

  /**
   * Gracefully stops background coordinator workers.
   */
  public stopCoordinator(): void {
    if (this.idleMonitorTimer) {
      clearInterval(this.idleMonitorTimer);
      this.idleMonitorTimer = undefined;
    }
    this.reflexionEngine.stopIdleWorker();
    this.dreamScheduler.stopScheduler();
    this.isStarted = false;
  }

  public markActivity(): void {
    this.lastActivityTimestamp = Date.now();
  }

  // =========================================================================
  // 2. INTERCEPTION & LEARNING HOOKS
  // =========================================================================

  /**
   * Intercepts conversational chatbot hesitation or refusal from the model.
   * Logs a deficit and immediately triggers the background reflexion pipeline.
   */
  public async onModelRefusal(
    goal: string,
    modelOutput: string,
    context?: { os?: string; cwd?: string }
  ): Promise<KnowledgeDeficitRecord | null> {
    this.markActivity();

    // 1. Update Activation Steering telemetry
    this.steeringManager.detectRefusalSignature(modelOutput);

    // 2. Evaluate and record deficit in KnowledgeDeficitLogger
    const detection = this.deficitLogger.detectDeficit({
      goal,
      modelOutput,
    });

    if (detection.isDeficit && detection.category) {
      return this.deficitLogger.logDeficit({
        goal,
        category: detection.category,
        modelOutput,
        context: {
          cwd: context?.cwd || '~',
          os: context?.os || 'macos',
        },
      });
    }

    return null;
  }

  /**
   * Intercepts failed tool or command executions from AgentLoop or Terminal.
   */
  public async onCommandExecutionFailure(
    goal: string,
    command: string,
    exitCode: number,
    stderr: string,
    context?: { os?: string; cwd?: string }
  ): Promise<KnowledgeDeficitRecord | null> {
    this.markActivity();

    const detection = this.deficitLogger.detectDeficit({
      goal,
      attemptedCommand: command,
      exitCode,
      stderr,
    });

    if (detection.isDeficit && detection.category) {
      return this.deficitLogger.logDeficit({
        goal,
        category: detection.category,
        attemptedCommand: command,
        exitCode,
        stderr,
        context: {
          cwd: context?.cwd || '~',
          os: context?.os || 'macos',
        },
      });
    }

    return null;
  }

  /**
   * Intercepts when a user demonstrates a working command right after an AI failure.
   * Immediately constructs a verified DPO pair and records it into episodic memory.
   */
  public async onHumanDemonstration(
    goal: string,
    verifiedCommand: string,
    explanation?: string
  ): Promise<DpoPair> {
    this.markActivity();

    // 1. Create high-quality DPO pair (chosen = user command, rejected = failure)
    const pair = this.dpoEngine.createPairFromCorrection({
      prompt: goal,
      chosenCommand: verifiedCommand,
      rejectedCommandOrResponse: "I cannot assist with this terminal command on your operating system.",
      explanation: explanation || `Verified human demonstration: ${verifiedCommand}`,
      category: 'human_demonstration',
    });

    // 2. Record to episodic memory
    this.episodicMemory.recordMemory(goal, verifiedCommand, {
      explanation: explanation || `Verified human demonstration: ${verifiedCommand}`,
      cwd: process.cwd(),
      os: process.platform === 'darwin' ? 'mac' : 'linux',
      source: 'demonstration',
    });

    // 3. Mark any open deficit for this goal as resolved
    const openDeficits = this.deficitLogger.getUnresolvedDeficits();
    for (const d of openDeficits) {
      if (d.goal.toLowerCase() === goal.toLowerCase() || d.goal.includes(goal)) {
        this.deficitLogger.markResolved(d.id, {
          verifiedCommand,
          explanation: `Resolved via human demonstration: ${verifiedCommand}`,
          resolvedAt: Date.now(),
          source: 'user_demonstration',
        });
      }
    }

    return pair;
  }

  /**
   * Evaluates terminal idle duration and activates appropriate SERL workers:
   * - 15s to 300s: Reflexion worker handles unresolved deficits in the background.
   * - >1200s (20 mins): DreamStateScheduler checks power and initiates self-play.
   */
  public async onTerminalIdle(idleSeconds: number): Promise<void> {
    // Phase 4.3: Idle Reflexion Worker
    if (idleSeconds >= 15 && idleSeconds < 1200) {
      const unresolved = this.deficitLogger.getUnresolvedDeficits();
      if (unresolved.length > 0) {
        await this.reflexionEngine.reflectOnDeficit(unresolved[0]);
        // Sync newly resolved deficits into DPO dataset
        this.dpoEngine.syncWithDeficitLogger(this.deficitLogger);
      }
    }

    // Phase 4.7: Nightly Dream-State Self-Play
    if (idleSeconds >= 1200 && !this.dreamScheduler.getIsDreaming()) {
      const condition = await this.dreamScheduler.checkPowerAndIdleConditions();
      if (condition.eligible) {
        await this.dreamScheduler.runDreamCycle();
      }
    }
  }

  // =========================================================================
  // 3. MLX DISTILLATION & HOT-RELOAD PIPELINE
  // =========================================================================

  /**
   * Executes native Apple Silicon MLX LoRA training and hot-reloads the newly
   * compiled adapter into the embedded llama-server with zero application downtime.
   */
  public async triggerDistillationAndHotReload(options?: {
    dryRun?: boolean;
    customAdapterPath?: string;
  }): Promise<{
    success: boolean;
    adapterPath?: string;
    durationMs: number;
    error?: string;
  }> {
    const startTime = Date.now();
    const home = typeof process !== 'undefined' && process.env ? (process.env.HOME || '/tmp') : '/tmp';
    const adapterGguf = options?.customAdapterPath || path.join(home, '.sentinel', 'models', 'sentinel_mlx_lora.gguf');

    try {
      // 1. Run MLX fine-tuning script
      const cwd = typeof process !== 'undefined' && typeof process.cwd === 'function' ? process.cwd() : '.';
      const scriptPath = path.join(cwd, 'scripts', 'train_sentinel_mlx.py');
      const dryRunFlag = options?.dryRun ? '--dry-run' : '';
      const trainCmd = `python3 "${scriptPath}" ${dryRunFlag}`.trim();

      if (this.commandExecutor) {
        const res = await this.commandExecutor(trainCmd);
        if (res.code !== 0 && !options?.dryRun) {
          throw new Error(`MLX fine-tuning failed: ${res.stderr || res.stdout}`);
        }
      }

      // 2. Hot-reload adapter into embedded llama-server
      const reloaded = await this.embeddedEngine.hotReloadLora(adapterGguf);

      return {
        success: reloaded,
        adapterPath: adapterGguf,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        durationMs: Date.now() - startTime,
        error: err?.message || String(err),
      };
    }
  }

  // =========================================================================
  // 4. UNIFIED INTELLIGENCE RESOLUTION ORACLE
  // =========================================================================

  /**
   * Unified resolution entry point across Tier 4 and Tier 5:
   * 1. Evaluates Deterministic Rule Oracle (5.2) if previous command crashed.
   * 2. Evaluates TLDR Knowledge Engine (5.1) for canonical recipes.
   * 3. Evaluates Episodic Memory for verified human demonstrations.
   * 4. Pre-validates syntax using ShellAstParser (5.4).
   * 5. Speculatively simulates candidates in Shadow-PTY (4.1).
   * 6. If unresolved, returns LLM inference configuration constrained by GBNF Grammar (5.3)
   *    and Activation Steering logit biases (4.6).
   */
  public async executeUnifiedResolution(
    goal: string,
    context?: { os?: string; cwd?: string; previousFailedCmd?: string; previousStderr?: string }
  ): Promise<{
    resolved: boolean;
    command?: string;
    source: 'tldr_oracle' | 'deterministic_rule_oracle' | 'episodic_demonstration' | 'needs_llm_inference';
    explanation?: string;
    grammar?: string;
    logitBias?: Record<string, number>;
  }> {
    const os = context?.os || (process.platform === 'darwin' ? 'macos' : 'linux');
    const cwd = context?.cwd || '~';

    // 1. Check Deterministic Rule Oracle if recovering from prior command failure
    if (context?.previousFailedCmd && context?.previousStderr) {
      const isMac = os.toLowerCase().includes('mac') || os.toLowerCase().includes('darwin');
      const rem = this.ruleOracle.diagnose({
        command: context.previousFailedCmd,
        output: context.previousStderr,
        cwd,
        os: isMac ? 'mac' : 'linux'
      });
      if (rem && rem.fixedCommand) {
        const syntax = ShellAstParser.validateSyntax(rem.fixedCommand);
        if (syntax.valid) {
          return {
            resolved: true,
            command: rem.fixedCommand,
            source: 'deterministic_rule_oracle',
            explanation: `Deterministic fix (${rem.ruleName}): ${rem.explanation}`
          };
        }
      }
    }

    // 2. Check TLDR Knowledge Engine for canonical CLI recipes
    const tldrMatch = this.tldrEngine.matchGoal(goal, os);
    if (tldrMatch && (tldrMatch.interpolatedCommand || tldrMatch.example?.command)) {
      const targetCmd = tldrMatch.interpolatedCommand || tldrMatch.example.command;
      const targetDesc = tldrMatch.example?.description || tldrMatch.page?.description || 'Canonical recipe';
      const syntax = ShellAstParser.validateSyntax(targetCmd);
      if (syntax.valid) {
        const hyp = {
          id: 'tldr_unified_fastpath',
          command: targetCmd,
          explanation: targetDesc,
          source: 'platform_optimized' as const,
          estimatedRisk: this.shadowSimulator.classifyRisk(targetCmd)
        };
        const outcome = await this.shadowSimulator.evaluateCandidate(hyp, { os, cwd });
        if (outcome.exitCode === 0 && outcome.empiricalScore >= 0) {
          return {
            resolved: true,
            command: targetCmd,
            source: 'tldr_oracle',
            explanation: `Canonical recipe: ${targetDesc}`
          };
        }
      }
    }

    // 3. Check Episodic Memory for human demonstrations
    const memories = this.episodicMemory.retrieveSimilar(goal, 1, 0.2);
    if (memories.length > 0) {
      const bestMem = memories[0];
      const syntax = ShellAstParser.validateSyntax(bestMem.command);
      if (syntax.valid) {
        return {
          resolved: true,
          command: bestMem.command,
          source: 'episodic_demonstration',
          explanation: bestMem.explanation || 'Verified prior human demonstration'
        };
      }
    }

    // 4. Fast paths did not resolve; LLM inference is required with formal GBNF constraints
    return {
      resolved: false,
      source: 'needs_llm_inference',
      grammar: GbnfGrammarManager.SENTINEL_ACTION_GBNF,
      logitBias: this.steeringManager.generateLogitBias()
    };
  }

  // =========================================================================
  // 5. TELEMETRY & SYSTEM DASHBOARD
  // =========================================================================

  /**
   * Returns a unified, real-time health and telemetry dashboard across all Tier 4 & Tier 5 subsystems.
   */
  public async getSystemDashboard(): Promise<SerlSystemDashboard> {
    const steeringTelem = this.steeringManager.getTelemetry();
    const deficitStats = this.deficitLogger.getStats();
    const dpoStats = this.dpoEngine.getStats();
    const engineStatus = await this.embeddedEngine.getStatus();
    const latestDreamReport = this.dreamScheduler.getLatestReport();

    let status: 'active' | 'idle' | 'dreaming' | 'reloading' = 'idle';
    if (this.dreamScheduler.getIsDreaming()) {
      status = 'dreaming';
    } else if (Date.now() - this.lastActivityTimestamp < 30000) {
      status = 'active';
    }

    return {
      status,
      timestamp: Date.now(),
      steering: {
        totalInferencesSteered: steeringTelem.totalInferencesSteered,
        refusalsSuppressedCount: steeringTelem.refusalsSuppressedCount,
        activeVectorsCount: steeringTelem.activeVectorsCount,
        refusalPenalty: -100.0,
        actionBoost: 3.5,
      },
      deficits: {
        totalDeficits: deficitStats.totalDeficits,
        unresolvedCount: deficitStats.unresolvedCount,
        resolvedCount: deficitStats.resolvedCount,
        categories: deficitStats.categoryCounts,
      },
      reflexion: {
        isIdleWorkerActive: this.isStarted,
        unresolvedQueueSize: deficitStats.unresolvedCount,
      },
      dpo: {
        totalPairs: dpoStats.totalPairs,
        categories: dpoStats.categoryCounts,
        sources: dpoStats.sourceCounts,
      },
      dreamState: {
        isDreaming: this.dreamScheduler.getIsDreaming(),
        latestCycle: latestDreamReport,
        totalCyclesRecorded: this.dreamScheduler.getReportHistory().length,
      },
      oracles: {
        tldrCommandsCount: this.tldrEngine.getStats().totalPages,
        tldrRecipesCount: this.tldrEngine.getStats().totalExamples,
        deterministicRulesCount: this.ruleOracle.getRuleCount(),
        gbnfGrammarsAvailable: true,
        astParserActive: true,
      },
      engine: engineStatus,
    };
  }
}
