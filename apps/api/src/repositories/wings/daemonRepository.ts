import { DaemonConnectionException } from '../../errors/index.js';
import { decrypt } from '../../lib/encryption.js';
import { getGuzzleTimeouts } from '../../services/settings/resolvedConfig.js';

/**
 * Base HTTP client for communicating with Wings daemon nodes.
 * Mirrors app/Repositories/Wings/DaemonRepository.php
 */
export class DaemonRepository {
    protected node: any;

    /**
     * Set the node to communicate with.
     */
    setNode(node: any): this {
        this.node = node;
        return this;
    }

    /**
     * Get the base URL for the daemon on this node.
     */
    protected getBaseUrl(): string {
        if (!this.node) {
            throw new Error('No node set on DaemonRepository');
        }
        const scheme = this.node.scheme || 'https';
        const fqdn = this.node.fqdn;
        const port = this.node.daemonListen || 8080;
        return `${scheme}://${fqdn}:${port}`;
    }

    /**
     * Get the decrypted daemon token for authorization.
     */
    protected getAuthToken(): string {
        if (!this.node) {
            throw new Error('No node set on DaemonRepository');
        }
        return decrypt(this.node.daemon_token);
    }

    /**
     * Make an HTTP request to the Wings daemon.
     */
    protected async request(
        method: string,
        path: string,
        options: {
            body?: unknown;
            query?: Record<string, string>;
            timeout?: number;
        } = {},
    ): Promise<Response> {
        const baseUrl = this.getBaseUrl();
        const token = this.getAuthToken();

        let url = `${baseUrl}${path}`;
        if (options.query) {
            const params = new URLSearchParams(options.query);
            url += `?${params.toString()}`;
        }

        const timeout = (options.timeout ?? getGuzzleTimeouts().timeout) * 1000;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const fetchOptions: RequestInit = {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                signal: controller.signal,
            };

            if (options.body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                fetchOptions.body = JSON.stringify(options.body);
            }

            const response = await fetch(url, fetchOptions);
            clearTimeout(timeoutId);

            return response;
        } catch (error: any) {
            if (error.name === 'AbortError') {
                throw new DaemonConnectionException(
                    `Request to daemon at ${this.node.fqdn} timed out after ${timeout}ms.`,
                );
            }
            throw new DaemonConnectionException(
                `Failed to communicate with daemon at ${this.node.fqdn}: ${error.message}`,
            );
        }
    }

    /**
     * Make a GET request to the Wings daemon.
     */
    protected async get(path: string, query?: Record<string, string>): Promise<Response> {
        return this.request('GET', path, { query });
    }

    /**
     * Make a POST request to the Wings daemon.
     */
    protected async post(path: string, body?: unknown): Promise<Response> {
        return this.request('POST', path, { body });
    }

    /**
     * Make a PUT request to the Wings daemon.
     */
    protected async put(path: string, body?: unknown): Promise<Response> {
        return this.request('PUT', path, { body });
    }

    /**
     * Make a DELETE request to the Wings daemon.
     */
    protected async delete(path: string, body?: unknown): Promise<Response> {
        return this.request('DELETE', path, { body });
    }
}
