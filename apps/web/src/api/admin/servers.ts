import http, {
    FractalPaginatedResponse,
    FractalResponseData,
    getPaginationSet,
    PaginatedResult,
    withQueryBuilderParams,
    QueryBuilderParams,
} from '@/api/http';

export interface AdminServer {
    id: number;
    externalId: string | null;
    uuid: string;
    identifier: string;
    name: string;
    description: string;
    status: string | null;
    suspended: boolean;
    limits: {
        memory: number;
        swap: number;
        disk: number;
        io: number;
        cpu: number;
        threads: string | null;
        oomDisabled: boolean;
    };
    featureLimits: {
        databases: number;
        allocations: number;
        backups: number;
    };
    userId: number;
    nodeId: number;
    allocationId: number;
    nestId: number;
    eggId: number;
    container: {
        startupCommand: string;
        image: string;
        environment: Record<string, string>;
    };
    createdAt: string;
    updatedAt: string;
    // Relationships (optional, loaded via include)
    user?: { id: number; username: string; email: string };
    node?: { id: number; name: string; fqdn: string };
    allocation?: { id: number; ip: string; port: number; alias: string | null };
    nest?: { id: number; name: string };
    egg?: { id: number; name: string };
}

export interface AdminNode {
    id: number;
    name: string;
    fqdn: string;
}

export interface AdminNest {
    id: number;
    name: string;
    eggs: AdminEgg[];
}

export interface AdminEgg {
    id: number;
    name: string;
    dockerImages: Record<string, string>;
    startup: string;
    variables: AdminEggVariable[];
}

export interface AdminEggVariable {
    name: string;
    description: string;
    envVariable: string;
    defaultValue: string;
    isEditable: boolean;
    rules: string;
}

export interface AdminAllocation {
    id: number;
    ip: string;
    port: number;
    alias: string | null;
    assigned: boolean;
}

function rawDataToAdminServer(data: FractalResponseData): AdminServer {
    const attr = data.attributes;
    const relationships = attr.relationships || {};

    const server: AdminServer = {
        id: attr.id,
        externalId: attr.external_id,
        uuid: attr.uuid,
        identifier: attr.identifier,
        name: attr.name,
        description: attr.description,
        status: attr.status,
        suspended: attr.suspended,
        limits: {
            memory: attr.limits.memory,
            swap: attr.limits.swap,
            disk: attr.limits.disk,
            io: attr.limits.io,
            cpu: attr.limits.cpu,
            threads: attr.limits.threads,
            oomDisabled: attr.limits.oom_disabled,
        },
        featureLimits: {
            databases: attr.feature_limits.databases,
            allocations: attr.feature_limits.allocations,
            backups: attr.feature_limits.backups,
        },
        userId: attr.user,
        nodeId: attr.node,
        allocationId: attr.allocation,
        nestId: attr.nest,
        eggId: attr.egg,
        container: {
            startupCommand: attr.container.startup_command,
            image: attr.container.image,
            environment: attr.container.environment,
        },
        createdAt: attr.created_at,
        updatedAt: attr.updated_at,
    };

    if (relationships.user?.attributes) {
        const u = relationships.user.attributes;
        server.user = { id: u.id, username: u.username, email: u.email };
    }
    if (relationships.node?.attributes) {
        const n = relationships.node.attributes;
        server.node = { id: n.id, name: n.name, fqdn: n.fqdn };
    }
    if (relationships.allocations?.data?.[0]?.attributes) {
        const a = relationships.allocations.data[0].attributes;
        server.allocation = { id: a.id, ip: a.ip, port: a.port, alias: a.alias };
    }
    if (relationships.nest?.attributes) {
        const n = relationships.nest.attributes;
        server.nest = { id: n.id, name: n.name };
    }
    if (relationships.egg?.attributes) {
        const e = relationships.egg.attributes;
        server.egg = { id: e.id, name: e.name };
    }

    return server;
}

type ServerFilterKeys = 'name' | 'uuid' | 'external_id';
type ServerSortKeys = 'id' | 'uuid' | 'name';

export const getServers = (
    params?: QueryBuilderParams<ServerFilterKeys, ServerSortKeys>,
    include?: string[]
): Promise<PaginatedResult<AdminServer>> => {
    return new Promise((resolve, reject) => {
        http.get('/api/application/servers', {
            params: {
                ...withQueryBuilderParams(params),
                include: include?.join(','),
            },
        })
            .then(({ data }) =>
                resolve({
                    items: (data as FractalPaginatedResponse).data.map(rawDataToAdminServer),
                    pagination: getPaginationSet(data.meta.pagination),
                })
            )
            .catch(reject);
    });
};

export const getServer = (id: number, include?: string[]): Promise<AdminServer> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/application/servers/${id}`, {
            params: { include: include?.join(',') },
        })
            .then(({ data }) => resolve(rawDataToAdminServer(data)))
            .catch(reject);
    });
};

export interface CreateServerData {
    name: string;
    description?: string;
    user: number;
    egg: number;
    docker_image: string;
    startup: string;
    environment: Record<string, string>;
    limits: {
        memory: number;
        swap: number;
        disk: number;
        io: number;
        cpu: number;
        threads?: string | null;
        oom_disabled?: boolean;
    };
    feature_limits: {
        databases: number;
        allocations: number;
        backups: number;
    };
    allocation: {
        default: number;
        additional?: number[];
    };
    external_id?: string | null;
}

export const createServer = (data: CreateServerData): Promise<AdminServer> => {
    return new Promise((resolve, reject) => {
        http.post('/api/application/servers', data)
            .then(({ data }) => resolve(rawDataToAdminServer(data)))
            .catch(reject);
    });
};

export interface UpdateServerDetailsData {
    name: string;
    description?: string;
    user: number;
    external_id?: string | null;
}

export const updateServerDetails = (id: number, data: UpdateServerDetailsData): Promise<AdminServer> => {
    return new Promise((resolve, reject) => {
        http.patch(`/api/application/servers/${id}/details`, data)
            .then(({ data }) => resolve(rawDataToAdminServer(data)))
            .catch(reject);
    });
};

export interface UpdateServerBuildData {
    allocation: number;
    memory: number;
    swap: number;
    disk: number;
    io: number;
    cpu: number;
    threads?: string | null;
    oom_disabled?: boolean;
    feature_limits: {
        databases: number;
        allocations: number;
        backups: number;
    };
    add_allocations?: number[];
    remove_allocations?: number[];
}

export const updateServerBuild = (id: number, data: UpdateServerBuildData): Promise<AdminServer> => {
    return new Promise((resolve, reject) => {
        http.patch(`/api/application/servers/${id}/build`, data)
            .then(({ data }) => resolve(rawDataToAdminServer(data)))
            .catch(reject);
    });
};

export interface UpdateServerStartupData {
    startup: string;
    environment: Record<string, string>;
    egg: number;
    image: string;
}

export const updateServerStartup = (id: number, data: UpdateServerStartupData): Promise<AdminServer> => {
    return new Promise((resolve, reject) => {
        http.patch(`/api/application/servers/${id}/startup`, data)
            .then(({ data }) => resolve(rawDataToAdminServer(data)))
            .catch(reject);
    });
};

export const suspendServer = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/application/servers/${id}/suspend`)
            .then(() => resolve())
            .catch(reject);
    });
};

export const unsuspendServer = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/application/servers/${id}/unsuspend`)
            .then(() => resolve())
            .catch(reject);
    });
};

export const reinstallServer = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/application/servers/${id}/reinstall`)
            .then(() => resolve())
            .catch(reject);
    });
};

export const deleteServer = (id: number, force?: boolean): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.delete(`/api/application/servers/${id}${force ? '/force' : ''}`)
            .then(() => resolve())
            .catch(reject);
    });
};

export const toggleInstallStatus = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/application/servers/${id}/toggle-install`)
            .then(() => resolve())
            .catch(reject);
    });
};

export const transferServer = (id: number, data: { node_id: number; allocation_id: number; allocation_additional?: number[] }): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/application/servers/${id}/transfer`, data)
            .then(() => resolve())
            .catch(reject);
    });
};

export const searchUsers = (email: string): Promise<Array<{ id: number; username: string; email: string }>> => {
    return new Promise((resolve, reject) => {
        http.get('/api/application/users', {
            params: { 'filter[email]': email },
        })
            .then(({ data }) =>
                resolve(
                    (data.data || []).map((item: FractalResponseData) => ({
                        id: item.attributes.id,
                        username: item.attributes.username,
                        email: item.attributes.email,
                    }))
                )
            )
            .catch(reject);
    });
};

export const getNodes = (): Promise<AdminNode[]> => {
    return new Promise((resolve, reject) => {
        http.get('/api/application/nodes')
            .then(({ data }) =>
                resolve(
                    (data.data || []).map((item: FractalResponseData) => ({
                        id: item.attributes.id,
                        name: item.attributes.name,
                        fqdn: item.attributes.fqdn,
                    }))
                )
            )
            .catch(reject);
    });
};

export const getNodeAllocations = (nodeId: number): Promise<AdminAllocation[]> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/application/nodes/${nodeId}/allocations`)
            .then(({ data }) =>
                resolve(
                    (data.data || []).map((item: FractalResponseData) => ({
                        id: item.attributes.id,
                        ip: item.attributes.ip,
                        port: item.attributes.port,
                        alias: item.attributes.alias,
                        assigned: item.attributes.assigned,
                    }))
                )
            )
            .catch(reject);
    });
};

export const getNests = (): Promise<AdminNest[]> => {
    return new Promise((resolve, reject) => {
        http.get('/api/application/nests', {
            params: { include: 'eggs' },
        })
            .then(({ data }) =>
                resolve(
                    (data.data || []).map((item: FractalResponseData) => {
                        const eggs = item.attributes.relationships?.eggs?.data || [];
                        return {
                            id: item.attributes.id,
                            name: item.attributes.name,
                            eggs: eggs.map((egg: FractalResponseData) => ({
                                id: egg.attributes.id,
                                name: egg.attributes.name,
                                dockerImages: egg.attributes.docker_images || {},
                                startup: egg.attributes.startup,
                                variables: (egg.attributes.relationships?.variables?.data || []).map(
                                    (v: FractalResponseData) => ({
                                        name: v.attributes.name,
                                        description: v.attributes.description,
                                        envVariable: v.attributes.env_variable,
                                        defaultValue: v.attributes.default_value,
                                        isEditable: v.attributes.user_editable,
                                        rules: v.attributes.rules,
                                    })
                                ),
                            })),
                        };
                    })
                )
            )
            .catch(reject);
    });
};
