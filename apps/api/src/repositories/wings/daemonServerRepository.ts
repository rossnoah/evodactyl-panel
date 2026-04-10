import { DaemonRepository } from './daemonRepository.js';

/**
 * Repository for managing server operations on the Wings daemon.
 * Mirrors app/Repositories/Wings/DaemonServerRepository.php
 */
export class DaemonServerRepository extends DaemonRepository {
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
   * Returns details about a server from the daemon instance.
   */
  async getDetails(): Promise<any> {
    if (!this.server) throw new Error('No server set on DaemonServerRepository');

    const response = await this.get(`/api/servers/${this.server.uuid}`);
    return response.json();
  }

  /**
   * Creates a new server on the Wings daemon.
   */
  async create(startOnCompletion: boolean = true): Promise<void> {
    if (!this.server) throw new Error('No server set on DaemonServerRepository');

    await this.post('/api/servers', {
      uuid: this.server.uuid,
      start_on_completion: startOnCompletion,
    });
  }

  /**
   * Triggers a server sync on Wings.
   */
  async sync(): Promise<void> {
    if (!this.server) throw new Error('No server set on DaemonServerRepository');

    await this.post(`/api/servers/${this.server.uuid}/sync`);
  }

  /**
   * Delete a server from the daemon.
   */
  async deleteServer(): Promise<void> {
    if (!this.server) throw new Error('No server set on DaemonServerRepository');

    await this.delete(`/api/servers/${this.server.uuid}`);
  }

  /**
   * Reinstall a server on the daemon.
   */
  async reinstall(): Promise<void> {
    if (!this.server) throw new Error('No server set on DaemonServerRepository');

    await this.post(`/api/servers/${this.server.uuid}/reinstall`);
  }

  /**
   * Request the daemon to create a full archive of the server.
   */
  async requestArchive(): Promise<void> {
    if (!this.server) throw new Error('No server set on DaemonServerRepository');

    await this.post(`/api/servers/${this.server.uuid}/archive`);
  }

  /**
   * Revoke a single user's JTI.
   */
  async revokeUserJTI(userId: number): Promise<void> {
    if (!this.server) throw new Error('No server set on DaemonServerRepository');

    const crypto = await import('node:crypto');
    const jti = crypto.createHash('md5').update(`${userId}${this.server.uuid}`).digest('hex');
    await this.revokeJTIs([jti]);
  }

  /**
   * Revoke an array of JWT JTIs on the Wings instance.
   */
  private async revokeJTIs(jtis: string[]): Promise<void> {
    if (!this.server) throw new Error('No server set on DaemonServerRepository');

    await this.post(`/api/servers/${this.server.uuid}/ws/deny`, {
      jtis,
    });
  }
}
