import { prisma } from '../../prisma/client.js';
import { config } from '../../config/index.js';

/**
 * Service for building the environment variable map for a server.
 * Mirrors app/Services/Servers/EnvironmentService.php
 */
export class EnvironmentService {
  private additional: Record<string, (server: any) => unknown> = {};

  /**
   * Dynamically configure additional environment variables.
   */
  setEnvironmentKey(key: string, closure: (server: any) => unknown): void {
    this.additional[key] = closure;
  }

  /**
   * Return the dynamically added additional keys.
   */
  getEnvironmentKeys(): Record<string, (server: any) => unknown> {
    return this.additional;
  }

  /**
   * Resolve a dotted property path on an object (mirrors PHP's object_get).
   */
  private resolveProperty(obj: any, path: string): unknown {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }
    return current;
  }

  /**
   * Build the complete environment variable map for a server.
   */
  async handle(server: any): Promise<Record<string, string>> {
    const variables: Record<string, string> = {};

    // Load server variables with their egg variable definitions
    const serverVars = server.variables ?? await prisma.egg_variables.findMany({
      where: { egg_id: server.egg_id },
    });

    // If server variables include server_value (from a join), use them
    const serverVarValues = await prisma.server_variables.findMany({
      where: { server_id: server.id },
    });

    const serverVarMap = new Map(serverVarValues.map((sv: any) => [sv.variable_id, sv.variable_value]));

    for (const variable of serverVars) {
      const envKey = variable.env_variable;
      const value = serverVarMap.get(variable.id) ?? variable.server_value ?? variable.default_value ?? '';
      variables[envKey] = String(value);
    }

    // Built-in environment mappings (matches getEnvironmentMappings() in PHP)
    variables['STARTUP'] = server.startup ?? '';
    variables['P_SERVER_UUID'] = server.uuid ?? '';

    // Load location — always fetch to match PHP's object_get($server, 'location.short')
    try {
      const node = server.nodes ?? await prisma.nodes.findUnique({ where: { id: server.node_id } });
      if (node) {
        const location = (node as any).locations ?? await prisma.locations.findUnique({ where: { id: node.location_id } });
        if (location) {
          variables['P_SERVER_LOCATION'] = location.short;
        }
      }
    } catch {
      // Location not available
    }

    // Process variables set in the configuration file
    // Mirrors: foreach (config('pterodactyl.environment_variables', []) as $key => $object)
    const envVars = config.pterodactyl.environmentVariables;
    for (const [key, objectPath] of Object.entries(envVars)) {
      const value = this.resolveProperty(server, objectPath);
      variables[key] = value ?? '';
    }

    // Process dynamically included environment variables
    for (const [key, closure] of Object.entries(this.additional)) {
      variables[key] = String(closure(server));
    }

    return variables;
  }
}
