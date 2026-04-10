import { DaemonRepository } from './daemonRepository.js';

/**
 * Repository for sending commands to servers via the Wings daemon.
 * Mirrors app/Repositories/Wings/DaemonCommandRepository.php
 */
export class DaemonCommandRepository extends DaemonRepository {
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
   * Sends a command or multiple commands to a running server instance.
   */
  async send(command: string | string[]): Promise<Response> {
    if (!this.server) throw new Error('No server set on DaemonCommandRepository');

    const commands = Array.isArray(command) ? command : [command];

    return this.post(`/api/servers/${this.server.uuid}/commands`, {
      commands,
    });
  }
}
