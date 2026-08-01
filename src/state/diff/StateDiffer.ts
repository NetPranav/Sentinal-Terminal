/**
 * StateDiffer.ts — Structural Before/After Delta Analyzer for World Model Snapshots
 *
 * Computes exact modifications between any two historical snapshots so the Planner
 * and Verification engines can accurately ascertain side effects of executed actions.
 */

import { WorldModel } from '../models/WorldModel';
import { StateDiffItem, StateDiffReport } from '../models/StateTypes';

export class StateDiffer {
  /**
   * Compare previous snapshot against current snapshot and report structural differences.
   */
  public diff(prev: WorldModel, next: WorldModel): StateDiffReport {
    const changes: StateDiffItem[] = [];

    const domains: Array<keyof WorldModel> = [
      'applications',
      'processes',
      'windows',
      'filesystem',
      'network',
      'wifi',
      'bluetooth',
      'volumes',
      'displays',
      'audio',
      'battery',
      'docker',
      'git',
      'node',
      'python',
      'developerTools',
      'environmentVariables',
      'terminalSessions',
    ];

    for (const domain of domains) {
      const pNode = prev[domain] as any;
      const nNode = next[domain] as any;

      if (!pNode && !nNode) continue;
      if (!pNode && nNode) {
        changes.push({ domain: String(domain), key: String(domain), type: 'added', after: nNode.data });
        continue;
      }
      if (pNode && !nNode) {
        changes.push({ domain: String(domain), key: String(domain), type: 'deleted', before: pNode.data });
        continue;
      }

      const pData = pNode.data;
      const nData = nNode.data;

      if (JSON.stringify(pData) !== JSON.stringify(nData)) {
        // Deep drill into objects/arrays for more granular reporting
        if (typeof pData === 'object' && pData !== null && typeof nData === 'object' && nData !== null) {
          const allKeys = new Set([...Object.keys(pData), ...Object.keys(nData)]);
          for (const k of allKeys) {
            const vPrev = pData[k];
            const vNext = nData[k];
            if (vPrev === undefined && vNext !== undefined) {
              changes.push({ domain: String(domain), key: k, type: 'added', after: vNext });
            } else if (vPrev !== undefined && vNext === undefined) {
              changes.push({ domain: String(domain), key: k, type: 'deleted', before: vPrev });
            } else if (JSON.stringify(vPrev) !== JSON.stringify(vNext)) {
              changes.push({ domain: String(domain), key: k, type: 'modified', before: vPrev, after: vNext });
            } else {
              changes.push({ domain: String(domain), key: k, type: 'unchanged', before: vPrev, after: vNext });
            }
          }
        } else {
          changes.push({ domain: String(domain), key: String(domain), type: 'modified', before: pData, after: nData });
        }
      } else {
        changes.push({ domain: String(domain), key: String(domain), type: 'unchanged', before: pData, after: nData });
      }
    }

    const meaningfulChanges = changes.filter(c => c.type !== 'unchanged');

    return {
      timestamp: Date.now(),
      previousSnapshotId: prev.snapshotId,
      currentSnapshotId: next.snapshotId,
      changes: meaningfulChanges.length > 0 ? meaningfulChanges : changes.slice(0, 5), // return some unchanged if purely identical
      hasModifications: meaningfulChanges.length > 0,
    };
  }
}

export const globalStateDiffer = new StateDiffer();
