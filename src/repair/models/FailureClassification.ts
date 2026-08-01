/**
 * FailureClassification.ts — Structured Taxonomy & Diagnosis for Runtime Execution Failures
 *
 * Every failure encountered during execution or verification is classified into a structured
 * domain category to power appropriate repair strategy selection and long-term adaptive learning.
 */

export type FailureCategory =
  | 'Permission'
  | 'Network'
  | 'Timeout'
  | 'Dependency'
  | 'MissingResource'
  | 'ApplicationState'
  | 'RaceCondition'
  | 'UserCancellation'
  | 'Unknown';

export interface FailureDiagnosis {
  readonly id: string;
  readonly category: FailureCategory;
  readonly actionId: string;
  readonly errorMessage: string;
  readonly timestamp: number;
  readonly recoverable: boolean;
  readonly remedyHint: string;
  readonly details?: Record<string, unknown>;
}

export class FailureClassifier {
  /**
   * Evaluates raw error strings, verification failures, and system symptoms to produce
   * an authoritative, structured failure diagnosis.
   */
  public static classify(
    actionId: string,
    errorOrWarning: string | Error,
    details?: Record<string, unknown>
  ): FailureDiagnosis {
    const rawMsg = typeof errorOrWarning === 'string' ? errorOrWarning : errorOrWarning.message || String(errorOrWarning);
    const msg = rawMsg.toLowerCase();
    const timestamp = Date.now();
    const id = `fail-${timestamp}-${Math.random().toString(36).substring(2, 6)}`;

    if (msg.includes('permission') || msg.includes('access denied') || msg.includes('eacces') || msg.includes('unauthorized') || msg.includes('accessibility')) {
      return {
        id,
        category: 'Permission',
        actionId,
        errorMessage: rawMsg,
        timestamp,
        recoverable: true,
        remedyHint: 'Invoke PermissionRecoveryStrategy or prompt user for Full Disk Access / Accessibility authorization.',
        details,
      };
    }

    if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('etimedout')) {
      return {
        id,
        category: 'Timeout',
        actionId,
        errorMessage: rawMsg,
        timestamp,
        recoverable: true,
        remedyHint: 'Execute RetryStrategy with delayed backoff or increase action execution allowance.',
        details,
      };
    }

    if (msg.includes('network') || msg.includes('wifi') || msg.includes('offline') || msg.includes('enotfound') || msg.includes('econnrefused') || msg.includes('ssid')) {
      return {
        id,
        category: 'Network',
        actionId,
        errorMessage: rawMsg,
        timestamp,
        recoverable: true,
        remedyHint: 'Execute logical repair graph to check WiFi interface power, re-authenticate SSID, or switch connection.',
        details,
      };
    }

    if (msg.includes('dependency') || msg.includes('not installed') || msg.includes('command not found') || msg.includes('binary') || msg.includes('which: no')) {
      return {
        id,
        category: 'Dependency',
        actionId,
        errorMessage: rawMsg,
        timestamp,
        recoverable: true,
        remedyHint: 'Execute DependencyRepairStrategy to stage required packages or binaries via package manager.',
        details,
      };
    }

    if (msg.includes('noent') || msg.includes('not found') || msg.includes('does not exist') || msg.includes('missing file') || msg.includes('directory missing')) {
      return {
        id,
        category: 'MissingResource',
        actionId,
        errorMessage: rawMsg,
        timestamp,
        recoverable: true,
        remedyHint: 'Execute alternative filesystem creation action or substitute target volume/folder path.',
        details,
      };
    }

    if (msg.includes('not running') || msg.includes('deadlock') || msg.includes('app closed') || msg.includes('foreground') || msg.includes('bundle id') || msg.includes('process terminated')) {
      return {
        id,
        category: 'ApplicationState',
        actionId,
        errorMessage: rawMsg,
        timestamp,
        recoverable: true,
        remedyHint: 'Execute logical application relaunch or terminate stuck PID before resuming workflow.',
        details,
      };
    }

    if (msg.includes('race') || msg.includes('busy') || msg.includes('locked') || msg.includes('temporarily unavailable') || msg.includes('resource lock')) {
      return {
        id,
        category: 'RaceCondition',
        actionId,
        errorMessage: rawMsg,
        timestamp,
        recoverable: true,
        remedyHint: 'Apply settling delay and trigger retry via MultiStageVerifier.',
        details,
      };
    }

    if (msg.includes('cancel') || msg.includes('aborted') || msg.includes('cancellationtoken') || msg.includes('user aborted')) {
      return {
        id,
        category: 'UserCancellation',
        actionId,
        errorMessage: rawMsg,
        timestamp,
        recoverable: false,
        remedyHint: 'Halt execution safely without attempting automated repair.',
        details,
      };
    }

    return {
      id,
      category: 'Unknown',
      actionId,
      errorMessage: rawMsg,
      timestamp,
      recoverable: true,
      remedyHint: 'Attempt AlternativeActionStrategy or escalate structured failure diagnosis to user.',
      details,
    };
  }
}
