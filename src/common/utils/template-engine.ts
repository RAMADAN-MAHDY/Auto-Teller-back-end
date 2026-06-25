import { format } from 'date-fns';

/**
 * Template engine for replacing {{variable}} placeholders with actual values.
 *
 * @example
 * renderTemplate('Hello {{name}}, welcome to {{bank}}!', { name: 'Ahmed', bank: 'BankReach' });
 * // => 'Hello Ahmed, welcome to BankReach!'
 */
export function renderTemplate(
  body: string,
  variables: Record<string, string | number | Date>,
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = variables[key];
    if (value instanceof Date) {
      return format(value, 'yyyy-MM-dd'); // Format date as YYYY-MM-DD
    } else if (typeof value === 'number') {
      return value.toString();
    } else if (value !== undefined) {
      return value;
    } else {
      return match;
    }
  });
}

/**
 * Extract variable names from a template body.
 *
 * @example
 * extractVariables('Hello {{name}}, your balance is {{balance}}');
 * // => ['name', 'balance']
 */
export function extractVariables(body: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const variables: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(body)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }

  return variables;
}
