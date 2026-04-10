import { DaemonRepository } from './daemonRepository.js';

/**
 * Repository for sending power actions to servers via the Wings daemon.
 * Mirrors app/Repositories/Wings/DaemonPowerRepository.php
 */
export class DaemonPowerRepository extends DaemonRepository {
  protected server: any;

  /**
   * Set the server to operate on.
   */
  setServer(server: any): this {
    this.server = server;
    if (server.nodes) {
      this.setNode(server.nodes);
    }
    return this;
  }

  /**
   * Sends a power action to the server instance.
   */
  async send(action: string): Promise<Response> {
    if (!this.server) throw new Error('No server set on DaemonPowerRepository');

    return this.post(`/api/servers/${this.server.uuid}/power`, {
      action,
    });
  }
}
