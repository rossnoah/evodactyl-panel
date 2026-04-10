import { Request, Response } from 'express';
import { fractal } from '../../../../serializers/fractal.js';
import { FileObjectTransformer } from '../../../../transformers/client/fileObjectTransformer.js';
import { DaemonFileRepository } from '../../../../repositories/wings/daemonFileRepository.js';
import { activityFromRequest } from '../../../../services/activity/activityLogService.js';
import { signJwt } from '../../../../lib/jwt.js';
import { decrypt } from '../../../../lib/encryption.js';
import { config } from '../../../../config/index.js';

/**
 * File controller for the client API.
 * All file operations are proxied to Wings daemon via DaemonFileRepository.
 * Mirrors app/Http/Controllers/Api/Client/Servers/FileController.php
 */
export class FileController {
  /**
   * Returns a listing of files in a given directory.
   */
  async directory(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const fileRepo = this.getFileRepo(server);

    const directory = (req.query['directory'] as string) ?? '/';
    const contents = await fileRepo.getDirectory(directory);

    const transformer = new FileObjectTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .collection(contents)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  }

  /**
   * Return the contents of a specified file.
   */
  async contents(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const fileRepo = this.getFileRepo(server);

    const filePath = req.query['file'] as string;
    const content = await fileRepo.getContent(
      filePath,
      config.pterodactyl.files.maxEditSize
    );

    await activityFromRequest(req)
      .event('server:file.read')
      .property('file', filePath)
      .log();

    res.set('Content-Type', 'text/plain').status(200).send(content);
  }

  /**
   * Generates a one-time token with a link to download a file.
   */
  async download(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const user = (req as any).user;
    const node = server.nodes;

    const filePath = req.query['file'] as string;
    const secret = decrypt(node.daemon_token);

    const token = signJwt(
      {
        file_path: decodeURIComponent(filePath),
        server_uuid: server.uuid,
        unique_id: `${user.id}${server.uuid}`,
      },
      secret,
      {
        expiresIn: '15m',
        issuer: 'Pterodactyl Panel',
      }
    );

    await activityFromRequest(req)
      .event('server:file.download')
      .property('file', filePath)
      .log();

    const scheme = node.scheme || 'https';
    const connectionAddress = `${scheme}://${node.fqdn}:${node.daemonListen || 8080}`;

    res.json({
      object: 'signed_url',
      attributes: {
        url: `${connectionAddress}/download/file?token=${token}`,
      },
    });
  }

  /**
   * Writes the contents of the specified file to the server.
   */
  async write(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const fileRepo = this.getFileRepo(server);

    const filePath = req.query['file'] as string;
    const content = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    await fileRepo.putContent(filePath, content);

    await activityFromRequest(req)
      .event('server:file.write')
      .property('file', filePath)
      .log();

    res.status(204).json();
  }

  /**
   * Creates a new folder on the server.
   */
  async create(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const fileRepo = this.getFileRepo(server);

    await fileRepo.createDirectory(req.body.name, req.body.root ?? '/');

    await activityFromRequest(req)
      .event('server:file.create-directory')
      .property('name', req.body.name)
      .property('directory', req.body.root)
      .log();

    res.status(204).json();
  }

  /**
   * Renames a file on the remote machine.
   */
  async rename(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const fileRepo = this.getFileRepo(server);

    await fileRepo.renameFiles(req.body.root, req.body.files);

    await activityFromRequest(req)
      .event('server:file.rename')
      .property('directory', req.body.root)
      .property('files', req.body.files)
      .log();

    res.status(204).json();
  }

  /**
   * Copies a file on the server.
   */
  async copy(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const fileRepo = this.getFileRepo(server);

    await fileRepo.copyFile(req.body.location);

    await activityFromRequest(req)
      .event('server:file.copy')
      .property('file', req.body.location)
      .log();

    res.status(204).json();
  }

  /**
   * Compresses files or folders.
   */
  async compress(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const fileRepo = this.getFileRepo(server);

    const file = await fileRepo.compressFiles(req.body.root, req.body.files);

    await activityFromRequest(req)
      .event('server:file.compress')
      .property('directory', req.body.root)
      .property('files', req.body.files)
      .log();

    const transformer = new FileObjectTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .item(file)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  }

  /**
   * Decompresses a given archive file.
   */
  async decompress(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const fileRepo = this.getFileRepo(server);

    await fileRepo.decompressFile(req.body.root, req.body.file);

    await activityFromRequest(req)
      .event('server:file.decompress')
      .property('directory', req.body.root)
      .property('files', req.body.file)
      .log();

    res.status(204).json();
  }

  /**
   * Deletes files or folders.
   */
  async deleteFiles(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const fileRepo = this.getFileRepo(server);

    await fileRepo.deleteFiles(req.body.root, req.body.files);

    await activityFromRequest(req)
      .event('server:file.delete')
      .property('directory', req.body.root)
      .property('files', req.body.files)
      .log();

    res.status(204).json();
  }

  /**
   * Updates file permissions.
   */
  async chmod(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const fileRepo = this.getFileRepo(server);

    await fileRepo.chmodFiles(req.body.root, req.body.files);

    res.status(204).json();
  }

  /**
   * Requests that a file be downloaded from a remote location by Wings.
   */
  async pull(req: Request, res: Response): Promise<void> {
    const server = (req as any).server;
    const fileRepo = this.getFileRepo(server);

    await fileRepo.pull(req.body.url, req.body.directory, {
      filename: req.body.filename,
      use_header: req.body.use_header,
      foreground: req.body.foreground,
    });

    await activityFromRequest(req)
      .event('server:file.pull')
      .property('directory', req.body.directory)
      .property('url', req.body.url)
      .log();

    res.status(204).json();
  }

  /**
   * Create a DaemonFileRepository set for the given server.
   */
  private getFileRepo(server: any): DaemonFileRepository {
    const repo = new DaemonFileRepository();
    repo.setServer(server);
    return repo;
  }
}

export const fileController = new FileController();
