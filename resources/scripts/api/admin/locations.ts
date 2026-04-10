import http, { FractalResponseData, getPaginationSet, PaginatedResult } from '@/api/http';

export interface AdminLocation {
    id: number;
    short: string;
    long: string | null;
    createdAt: string;
    updatedAt: string;
    nodeCount?: number;
    nodes?: AdminLocationNode[];
}

export interface AdminLocationNode {
    id: number;
    name: string;
    fqdn: string;
    scheme: string;
    memory: number;
    disk: number;
}

export const rawDataToAdminLocation = ({ attributes }: FractalResponseData): AdminLocation => {
    const location: AdminLocation = {
        id: attributes.id,
        short: attributes.short,
        long: attributes.long,
        createdAt: attributes.created_at,
        updatedAt: attributes.updated_at,
    };

    if (attributes.relationships?.nodes) {
        const nodesData = attributes.relationships.nodes;
        if (nodesData.object === 'list' && Array.isArray(nodesData.data)) {
            location.nodes = nodesData.data.map((node: FractalResponseData) => ({
                id: node.attributes.id,
                name: node.attributes.name,
                fqdn: node.attributes.fqdn,
                scheme: node.attributes.scheme,
                memory: node.attributes.memory,
                disk: node.attributes.disk,
            }));
            location.nodeCount = location.nodes!.length;
        }
    }

    return location;
};

interface GetLocationsParams {
    page?: number;
}

export const getLocations = ({ page }: GetLocationsParams = {}): Promise<PaginatedResult<AdminLocation>> => {
    return new Promise((resolve, reject) => {
        http.get('/api/application/locations', {
            params: {
                page,
                include: 'nodes',
            },
        })
            .then(({ data }) =>
                resolve({
                    items: (data.data || []).map((datum: any) => rawDataToAdminLocation(datum)),
                    pagination: getPaginationSet(data.meta.pagination),
                })
            )
            .catch(reject);
    });
};

export const getLocation = (id: number): Promise<AdminLocation> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/application/locations/${id}`, {
            params: { include: 'nodes' },
        })
            .then(({ data }) => resolve(rawDataToAdminLocation(data)))
            .catch(reject);
    });
};

export interface CreateLocationData {
    short: string;
    long?: string;
}

export const createLocation = (data: CreateLocationData): Promise<AdminLocation> => {
    return new Promise((resolve, reject) => {
        http.post('/api/application/locations', data)
            .then(({ data }) => resolve(rawDataToAdminLocation(data)))
            .catch(reject);
    });
};

export const updateLocation = (id: number, data: CreateLocationData): Promise<AdminLocation> => {
    return new Promise((resolve, reject) => {
        http.patch(`/api/application/locations/${id}`, data)
            .then(({ data }) => resolve(rawDataToAdminLocation(data)))
            .catch(reject);
    });
};

export const deleteLocation = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.delete(`/api/application/locations/${id}`)
            .then(() => resolve())
            .catch(reject);
    });
};
