export class VariableEngine {
  /**
   * Interpolates variables within a string or object.
   * Syntaxes supported: {{var_name}}
   */
  public interpolate(input: any, variables: Record<string, any>): any {
    if (typeof input === 'string') {
      return this.interpolateString(input, variables);
    }
    
    if (Array.isArray(input)) {
      return input.map(item => this.interpolate(item, variables));
    }
    
    if (typeof input === 'object' && input !== null) {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(input)) {
        result[key] = this.interpolate(value, variables);
      }
      return result;
    }

    return input;
  }

  private interpolateString(str: string, variables: Record<string, any>): any {
    // If the entire string is just a single variable, e.g., "{{user.id}}"
    // we return the actual type (number, object, etc.) rather than coercing to string.
    const exactMatch = /^\{\{([\w.]+)\}\}$/.exec(str);
    if (exactMatch) {
      const path = exactMatch[1];
      return this.resolvePath(variables, path);
    }

    // Otherwise do standard string replacement
    return str.replace(/\{\{([\w.]+)\}\}/g, (match, path) => {
      const val = this.resolvePath(variables, path);
      return val !== undefined ? String(val) : match;
    });
  }

  private resolvePath(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }
}
