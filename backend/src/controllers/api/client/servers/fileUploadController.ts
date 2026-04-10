import { Request, Response } from 'express';
import { signJwt } from '../../../../lib/jwt.js';
import { decrypt } from '../../../../lib/encryption.js';

/**
 * File upload controller for the client API.
 * Returns a signed URL that the client uses to upload directly to Wings.
 * Mirrors app/Http/Controllers/Api/Client/Servers/FileUploadController.php
 */
export class FileUploadController {
  /**
   * Returns a URL where files can be uploaded to.
   */
  async handle(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const user = (req as any).user;

    const url = this.getUploadUrl(server, user);

    res.json({
      object: 'signed_url',
      attributes: { url },
    });
  }

  /**
   * Generates a signed upload URL for the Wings daemon.
   */
  private getUploadUrl(server: any, user: any): string {
    const node = server.nodes;
    const secret = decrypt(node.daemon_token);

    const token = signJwt(
      {
        server_uuid: server.uuid,
        unique_id: `${user.id}${server.uuid}`,
      },
      secret,
      {
        expiresIn: '15m',
        issuer: 'Pterodactyl Panel',
      }
    );

    const scheme = node.scheme || 'https';
    const connectionAddress = `${scheme}://${node.fqdn}:${node.daemonListen || 8080}`;

    return `${connectionAddress}/upload/file?token=${token}`;
  }
}

export const fileUploadController = new FileUploadController();
