import { DaemonRepository } from './daemonRepository.js';

/**
 * Repository for communicating with Wings daemon for server transfer operations.
 * Mirrors app/Repositories/Wings/DaemonTransferRepository.php
 */
export class DaemonTransferRepository extends DaemonRepository {
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
   * Notify the daemon about a server transfer.
   */
  async notify(targetNode: any, token: string): Promise<void> {
    const scheme = targetNode.scheme || 'https';
    const targetAddress = `${scheme}://${targetNode.fqdn}:${targetNode.daemonListen || 8080}`;

    await this.post(`/api/servers/${this.server.uuid}/transfer`, {
      server_id: this.server.uuid,
      url: `${targetAddress}/api/transfers`,
      token: `Bearer ${token}`,
      server: {
        uuid: this.server.uuid,
        start_on_completion: false,
      },
    });
  }
}
