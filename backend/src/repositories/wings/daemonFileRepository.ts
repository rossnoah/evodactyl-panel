import { DaemonRepository } from './daemonRepository.js';
import { DaemonConnectionException } from '../../errors/index.js';

/**
 * Repository for communicating with Wings daemon for file operations.
 * Mirrors app/Repositories/Wings/DaemonFileRepository.php
 */
export class DaemonFileRepository extends DaemonRepository {
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
   * Return the contents of a given file.
   */
  async getContent(path: string, notLargerThan?: number): Promise<string> {
    const response = await this.get(
      `/api/servers/${this.server.uuid}/files/contents`,
      { file: path }
    );

    if (!response.ok) {
      throw new DaemonConnectionException(
        `Failed to get file contents: ${response.status} ${response.statusText}`
      );
    }

    if (notLargerThan) {
      const contentLength = parseInt(response.headers.get('content-length') ?? '0', 10);
      if (contentLength > notLargerThan) {
        throw new Error('The file is too large to be opened in the editor.');
      }
    }

    return response.text();
  }

  /**
   * Save new contents to a given file.
   */
  async putContent(path: string, content: string): Promise<Response> {
    // putContent uses raw body, not JSON, but Wings expects the file query param
    const baseUrl = this.getBaseUrl();
    const token = this.getAuthToken();
    const url = `${baseUrl}/api/servers/${this.server.uuid}/files/write?file=${encodeURIComponent(path)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
      body: content,
    });

    if (!response.ok) {
      throw new DaemonConnectionException(
        `Failed to write file: ${response.status} ${response.statusText}`
      );
    }

    return response;
  }

  /**
   * Return a directory listing for a given path.
   */
  async getDirectory(path: string): Promise<any[]> {
    const response = await this.get(
      `/api/servers/${this.server.uuid}/files/list-directory`,
      { directory: path }
    );

    if (!response.ok) {
      throw new DaemonConnectionException(
        `Failed to list directory: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Creates a new directory for the server in the given path.
   */
  async createDirectory(name: string, path: string): Promise<Response> {
    return this.post(`/api/servers/${this.server.uuid}/files/create-directory`, {
      name,
      path,
    });
  }

  /**
   * Renames or moves a file on the remote machine.
   */
  async renameFiles(root: string | null, files: any[]): Promise<Response> {
    return this.put(`/api/servers/${this.server.uuid}/files/rename`, {
      root: root ?? '/',
      files,
    });
  }

  /**
   * Copy a given file and give it a unique name.
   */
  async copyFile(location: string): Promise<Response> {
    return this.post(`/api/servers/${this.server.uuid}/files/copy`, {
      location,
    });
  }

  /**
   * Delete files or folders for the server.
   */
  async deleteFiles(root: string | null, files: string[]): Promise<Response> {
    return this.post(`/api/servers/${this.server.uuid}/files/delete`, {
      root: root ?? '/',
      files,
    });
  }

  /**
   * Compress the given files or folders in the given root.
   */
  async compressFiles(root: string | null, files: string[]): Promise<any> {
    const response = await this.request('POST', `/api/servers/${this.server.uuid}/files/compress`, {
      body: {
        root: root ?? '/',
        files,
      },
      timeout: 60 * 15, // 15 minutes for compression
    });

    if (!response.ok) {
      throw new DaemonConnectionException(
        `Failed to compress files: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Decompresses a given archive file.
   */
  async decompressFile(root: string | null, file: string): Promise<Response> {
    return this.request('POST', `/api/servers/${this.server.uuid}/files/decompress`, {
      body: {
        root: root ?? '/',
        file,
      },
      timeout: 60 * 15, // 15 minutes for decompression
    });
  }

  /**
   * Chmods the given files.
   */
  async chmodFiles(root: string | null, files: any[]): Promise<Response> {
    return this.post(`/api/servers/${this.server.uuid}/files/chmod`, {
      root: root ?? '/',
      files,
    });
  }

  /**
   * Pulls a file from the given URL and saves it to the disk.
   */
  async pull(
    url: string,
    directory: string | null,
    params: { filename?: string; use_header?: boolean; foreground?: boolean } = {}
  ): Promise<Response> {
    const attributes: Record<string, unknown> = {
      url,
      root: directory ?? '/',
    };

    if (params.filename !== undefined) attributes.file_name = params.filename;
    if (params.use_header !== undefined) attributes.use_header = params.use_header;
    if (params.foreground !== undefined) attributes.foreground = params.foreground;

    return this.post(`/api/servers/${this.server.uuid}/files/pull`, attributes);
  }
}
