import { prisma } from '../../prisma/client.js';
import { ValidationException } from '../../errors/index.js';

const USER_LEVEL_ADMIN = 'admin';
const USER_LEVEL_USER = 'user';

/**
 * Service for validating egg variable values for a server.
 * Mirrors app/Services/Servers/VariableValidatorService.php
 */
export class VariableValidatorService {
  private userLevel: string = USER_LEVEL_USER;

  /**
   * Set the user level for validation context.
   */
  setUserLevel(level: string): this {
    this.userLevel = level;
    return this;
  }

  /**
   * Validate all passed data against the given egg variables.
   */
  async handle(eggId: number, fields: Record<string, any> = {}): Promise<Array<{ id: number; key: string; value: any }>> {
    const whereClause: any = { egg_id: eggId };

    if (this.userLevel !== USER_LEVEL_ADMIN) {
      whereClause.user_editable = 1;
      whereClause.user_viewable = 1;
    }

    const variables = await prisma.egg_variables.findMany({
      where: whereClause,
    });

    const errors: Array<{ sourceField: string; rule: string; detail: string }> = [];

    for (const variable of variables) {
      const value = fields[variable.env_variable];
      const rules = variable.rules ?? '';

      // Basic validation based on rules string
      if (rules.includes('required') && (value === undefined || value === null || value === '')) {
        errors.push({
          sourceField: `environment.${variable.env_variable}`,
          rule: 'required',
          detail: `The ${variable.name} field is required.`,
        });
      }

      // Validate numeric rules
      if (rules.includes('numeric') && value !== undefined && value !== null && value !== '') {
        if (isNaN(Number(value))) {
          errors.push({
            sourceField: `environment.${variable.env_variable}`,
            rule: 'numeric',
            detail: `The ${variable.name} field must be a number.`,
          });
        }
      }

      // Validate string rules
      if (rules.includes('string') && value !== undefined && value !== null && typeof value !== 'string') {
        errors.push({
          sourceField: `environment.${variable.env_variable}`,
          rule: 'string',
          detail: `The ${variable.name} field must be a string.`,
        });
      }

      // Validate regex rules
      const regexMatch = rules.match(/regex:\/(.+?)\//);
      if (regexMatch && value !== undefined && value !== null && value !== '') {
        try {
          const regex = new RegExp(regexMatch[1]);
          if (!regex.test(String(value))) {
            errors.push({
              sourceField: `environment.${variable.env_variable}`,
              rule: 'regex',
              detail: `The ${variable.name} field format is invalid.`,
            });
          }
        } catch {
          // Skip invalid regex patterns
        }
      }

      // Validate max length
      const maxMatch = rules.match(/max:(\d+)/);
      if (maxMatch && value !== undefined && value !== null) {
        const maxLen = parseInt(maxMatch[1], 10);
        if (String(value).length > maxLen) {
          errors.push({
            sourceField: `environment.${variable.env_variable}`,
            rule: 'max',
            detail: `The ${variable.name} field must not be greater than ${maxLen} characters.`,
          });
        }
      }

      // Validate in:values
      const inMatch = rules.match(/in:([^|]+)/);
      if (inMatch && value !== undefined && value !== null && value !== '') {
        const allowedValues = inMatch[1].split(',');
        if (!allowedValues.includes(String(value))) {
          errors.push({
            sourceField: `environment.${variable.env_variable}`,
            rule: 'in',
            detail: `The selected ${variable.name} is invalid.`,
          });
        }
      }
    }

    if (errors.length > 0) {
      throw new ValidationException(errors);
    }

    return variables.map((variable) => ({
      id: variable.id,
      key: variable.env_variable,
      value: fields[variable.env_variable] ?? null,
    }));
  }
}
