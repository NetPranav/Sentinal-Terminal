/**
 * DocumentationGenerator.ts — Auto-generated architecture docs
 */

export class DocumentationGenerator {
  public generateActionReference(actions: any[]): string {
    let md = '# Action Reference\n\n';
    
    actions.forEach(a => {
      md += `## ${a.id}\n- **Description**: ${a.description}\n- **Requires**: ${a.permissions?.join(', ')}\n\n`;
    });
    
    return md;
  }
}
