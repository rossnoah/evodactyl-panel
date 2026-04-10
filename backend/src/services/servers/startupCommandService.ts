/**
 * Service for generating the startup command for a server.
 * Mirrors app/Services/Servers/StartupCommandService.php
 */
export class StartupCommandService {
  /**
   * Generates a startup command for a given server instance.
   * Replaces template variables with actual values.
   */
  handle(server: any, hideAllValues: boolean = false): string {
    let startup = server.startup ?? '';
    const allocation = server.allocation || (server.allocations || []).find((a: any) => a.id === server.allocation_id) || {};

    // Replace built-in variables
    startup = startup.replace(/\{\{SERVER_MEMORY\}\}/g, String(server.memory ?? ''));
    startup = startup.replace(/\{\{SERVER_IP\}\}/g, allocation.ip ?? '0.0.0.0');
    startup = startup.replace(/\{\{SERVER_PORT\}\}/g, String(allocation.port ?? ''));

    // Replace egg variables
    const variables = server.variables || [];
    for (const variable of variables) {
      const envVar = variable.env_variable;
      let value: string;

      if (variable.user_viewable && !hideAllValues) {
        value = variable.server_value ?? variable.default_value ?? '';
      } else {
        value = '[hidden]';
      }

      startup = startup.replace(new RegExp(`\\{\\{${envVar}\\}\\}`, 'g'), String(value));
    }

    return startup;
  }
}
