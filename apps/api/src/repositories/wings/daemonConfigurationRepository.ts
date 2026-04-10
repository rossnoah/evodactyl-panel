import { DaemonRepository } from './daemonRepository.js';

/**
 * Repository for managing Wings daemon configuration.
 * Mirrors app/Repositories/Wings/DaemonConfigurationRepository.php
 */
export class DaemonConfigurationRepository extends DaemonRepository {
  /**
   * Returns system information from the Wings instance.
   */
  async getSystemInformation(version?: number): Promise<any> {
    const query = version !== undefined ? { v: String(version) } : undefined;
    const response = await this.get('/api/system', query);
    return response.json();
  }

  /**
   * Updates the configuration information for a daemon.
   * Uses the node's configuration data to update Wings.
   */
  async update(nodeConfiguration: Record<string, unknown>): Promise<Response> {
    return this.post('/api/update', nodeConfiguration);
  }
}
