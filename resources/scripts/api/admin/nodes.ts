import http, { FractalResponseData, FractalResponseList, getPaginationSet, PaginatedResult } from '@/api/http';

export interface Node {
    id: number;
    uuid: string;
    public: boolean;
    name: string;
    description: string | null;
    locationId: number;
    fqdn: string;
    scheme: string;
    behindProxy: boolean;
    maintenanceMode: boolean;
    memory: number;
    memoryOverallocate: number;
    disk: number;
    diskOverallocate: number;
    uploadSize: number;
    daemonListen: number;
    daemonSftp: number;
    daemonBase: string;
    createdAt: Date;
    updatedAt: Date;
    allocations?: Allocation[];
    location?: { id: number; short: string; long: string };
    servers?: Array<{
        id: number;
        name: string;
        uuid: string;
        identifier?: string;
        owner?: { id: number; username: string };
        nest?: { id: number; name: string };
        egg?: { id: number; name: string };
    }>;
    allocatedMemory?: number;
    allocatedDisk?: number;
}

export interface DaemonInfo {
    version: string;
    system: {
        type: string;
        arch: string;
        release: string;
        cpus: number;
    };
}

export interface Allocation {
    id: number;
    ip: string;
    alias: string | null;
    port: number;
    serverId: number | null;
    assigned: boolean;
}

const rawDataToNode = (data: any): Node => ({
    id: data.id,
    uuid: data.uuid,
    public: data.public,
    name: data.name,
    description: data.description,
    locationId: data.location_id,
    fqdn: data.fqdn,
    scheme: data.scheme,
    behindProxy: data.behind_proxy,
    maintenanceMode: data.maintenance_mode,
    memory: data.memory,
    memoryOverallocate: data.memory_overallocate,
    disk: data.disk,
    diskOverallocate: data.disk_overallocate,
    uploadSize: data.upload_size,
    daemonListen: data.daemon_listen,
    daemonSftp: data.daemon_sftp,
    daemonBase: data.daemon_base,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
    allocatedMemory: data.allocated_resources?.memory,
    allocatedDisk: data.allocated_resources?.disk,
    allocations: data.relationships?.allocations?.data?.map((a: FractalResponseData) => rawDataToAllocation(a.attributes)),
    location: data.relationships?.location
        ? {
              id: data.relationships.location.attributes.id,
              short: data.relationships.location.attributes.short,
              long: data.relationships.location.attributes.long,
          }
        : undefined,
    servers: data.relationships?.servers?.data?.map((s: FractalResponseData) => ({
        id: s.attributes.id,
        name: s.attributes.name,
        uuid: s.attributes.uuid,
        identifier: s.attributes.identifier,
        owner: s.attributes.owner,
        nest: s.attributes.nest,
        egg: s.attributes.egg,
    })),
});

const rawDataToAllocation = (data: any): Allocation => ({
    id: data.id,
    ip: data.ip,
    alias: data.alias,
    port: data.port,
    serverId: data.server_id,
    assigned: !!data.server_id,
});

export const getNodes = (page = 1, filter?: string): Promise<PaginatedResult<Node>> => {
    return new Promise((resolve, reject) => {
        http.get('/api/application/nodes', {
            params: {
                page,
                'filter[name]': filter || undefined,
                include: 'location',
            },
        })
            .then(({ data }) =>
                resolve({
                    items: (data.data || []).map((d: FractalResponseData) => rawDataToNode(d.attributes)),
                    pagination: getPaginationSet(data.meta.pagination),
                })
            )
            .catch(reject);
    });
};

export const getNode = (id: number): Promise<Node> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/application/nodes/${id}`, {
            params: { include: 'allocations,location,servers' },
        })
            .then(({ data }) => resolve(rawDataToNode(data.attributes)))
            .catch(reject);
    });
};

export const createNode = (nodeData: Record<string, any>): Promise<Node> => {
    return new Promise((resolve, reject) => {
        http.post('/api/application/nodes', nodeData)
            .then(({ data }) => resolve(rawDataToNode(data.attributes)))
            .catch(reject);
    });
};

export const updateNode = (id: number, nodeData: Record<string, any>): Promise<Node> => {
    return new Promise((resolve, reject) => {
        http.patch(`/api/application/nodes/${id}`, nodeData)
            .then(({ data }) => resolve(rawDataToNode(data.attributes)))
            .catch(reject);
    });
};

export const deleteNode = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.delete(`/api/application/nodes/${id}`)
            .then(() => resolve())
            .catch(reject);
    });
};

export const getNodeConfiguration = (id: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/application/nodes/${id}/configuration`)
            .then(({ data }) => resolve(typeof data === 'string' ? data : JSON.stringify(data, null, 2)))
            .catch(reject);
    });
};

export const getAllocations = (nodeId: number, page = 1): Promise<PaginatedResult<Allocation>> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/application/nodes/${nodeId}/allocations`, {
            params: { page },
        })
            .then(({ data }) =>
                resolve({
                    items: (data.data || []).map((d: FractalResponseData) => rawDataToAllocation(d.attributes)),
                    pagination: getPaginationSet(data.meta.pagination),
                })
            )
            .catch(reject);
    });
};

export const createAllocations = (nodeId: number, ip: string, ports: string[], alias?: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/application/nodes/${nodeId}/allocations`, {
            ip,
            ports,
            alias: alias || undefined,
        })
            .then(() => resolve())
            .catch(reject);
    });
};

export const deleteAllocation = (nodeId: number, allocationId: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.delete(`/api/application/nodes/${nodeId}/allocations/${allocationId}`)
            .then(() => resolve())
            .catch(reject);
    });
};

export const updateAllocationAlias = (nodeId: number, allocationId: number, alias: string | null): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.patch(`/api/application/nodes/${nodeId}/allocations/${allocationId}`, { alias })
            .then(() => resolve())
            .catch(reject);
    });
};

export const bulkDeleteAllocations = (nodeId: number, ids: number[]): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.delete(`/api/application/nodes/${nodeId}/allocations`, { data: { ids } })
            .then(() => resolve())
            .catch(reject);
    });
};

export const generateDeployToken = (id: number): Promise<{ node: number; token: string }> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/application/nodes/${id}/deploy-token`)
            .then(({ data }) => resolve(data))
            .catch(reject);
    });
};

export const getNodeSystemInfo = (id: number): Promise<DaemonInfo> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/application/nodes/${id}/system-information`)
            .then(({ data }) => resolve(data))
            .catch(reject);
    });
};
