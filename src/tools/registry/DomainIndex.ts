/**
 * DomainIndex.ts
 * 
 * Groups tools by their domain (network, filesystem, system, shell, etc.).
 * Enables fast lookup of all tools within a domain.
 */

import { LoadedTool } from '../schemas/ToolDefinitionSchema';

export class DomainIndex {
  private domains: Map<string, Set<string>> = new Map();

  public add(tool: LoadedTool): void {
    const domain = tool.definition.domain;
    if (!this.domains.has(domain)) {
      this.domains.set(domain, new Set());
    }
    this.domains.get(domain)!.add(tool.definition.id);
  }

  public getToolIds(domain: string): string[] {
    return Array.from(this.domains.get(domain) || []);
  }

  public getAllDomains(): string[] {
    return Array.from(this.domains.keys());
  }

  public hasDomain(domain: string): boolean {
    return this.domains.has(domain);
  }

  public remove(toolId: string, domain: string): void {
    this.domains.get(domain)?.delete(toolId);
  }

  public clear(): void {
    this.domains.clear();
  }
}
