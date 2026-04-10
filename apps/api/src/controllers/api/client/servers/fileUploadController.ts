import { Request, Response } from 'express';
import { NodeJWTService } from '../../../../services/nodes/nodeJwtService.js';
import { getConnectionAddress } from '../../../../lib/node.js';

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

    const token = new NodeJWTService()
      .setExpiresAt(new Date(Date.now() + 15 * 60 * 1000))
      .setUser(user)
      .setClaims({ server_uuid: server.uuid })
      .handle(node, `${user.id}${server.uuid}`);

    return `${getConnectionAddress(node)}/upload/file?token=${token}`;
  }
}

export const fileUploadController = new FileUploadController();
