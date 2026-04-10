import http, { FractalResponseData } from '@/api/http';

export interface ApplicationApiKey {
    identifier: string;
    description: string;
    allowedIps: string[];
    permissions: Record<string, number>;
    createdAt: Date;
    lastUsedAt: Date | null;
}

const rawDataToApplicationApiKey = (data: any): ApplicationApiKey => ({
    identifier: data.identifier,
    description: data.description,
    allowedIps: data.allowed_ips || [],
    permissions: {
        r_servers: data.r_servers ?? 0,
        r_nodes: data.r_nodes ?? 0,
        r_allocations: data.r_allocations ?? 0,
        r_users: data.r_users ?? 0,
        r_locations: data.r_locations ?? 0,
        r_nests: data.r_nests ?? 0,
        r_eggs: data.r_eggs ?? 0,
        r_database_hosts: data.r_database_hosts ?? 0,
        r_server_databases: data.r_server_databases ?? 0,
    },
    createdAt: new Date(data.created_at),
    lastUsedAt: data.last_used_at ? new Date(data.last_used_at) : null,
});

export const getApplicationApiKeys = (): Promise<ApplicationApiKey[]> => {
    return new Promise((resolve, reject) => {
        http.get('/api/application/api-keys')
            .then(({ data }) =>
                resolve((data.data || []).map((d: FractalResponseData) => rawDataToApplicationApiKey(d.attributes)))
            )
            .catch(reject);
    });
};

export const createApplicationApiKey = (
    description: string,
    allowedIps: string[],
    permissions: Record<string, number>
): Promise<ApplicationApiKey & { secretToken: string }> => {
    return new Promise((resolve, reject) => {
        http.post('/api/application/api-keys', {
            description,
            allowed_ips: allowedIps,
            ...permissions,
        })
            .then(({ data }) =>
                resolve({
                    ...rawDataToApplicationApiKey(data.attributes),
                    secretToken: data.meta?.secret_token ?? '',
                })
            )
            .catch(reject);
    });
};

export const deleteApplicationApiKey = (identifier: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.delete(`/api/application/api-keys/${identifier}`)
            .then(() => resolve())
            .catch(reject);
    });
};

export const API_PERMISSION_KEYS = [
    { key: 'r_servers', label: 'Servers' },
    { key: 'r_nodes', label: 'Nodes' },
    { key: 'r_allocations', label: 'Allocations' },
    { key: 'r_users', label: 'Users' },
    { key: 'r_locations', label: 'Locations' },
    { key: 'r_nests', label: 'Nests' },
    { key: 'r_eggs', label: 'Eggs' },
    { key: 'r_database_hosts', label: 'Database Hosts' },
    { key: 'r_server_databases', label: 'Server Databases' },
] as const;
