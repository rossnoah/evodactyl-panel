import http, { FractalResponseData } from '@/api/http';

export interface Mount {
    id: number;
    uuid: string;
    name: string;
    description: string | null;
    source: string;
    target: string;
    readOnly: boolean;
    userMountable: boolean;
}

const rawDataToMount = (data: any): Mount => ({
    id: data.id,
    uuid: data.uuid,
    name: data.name,
    description: data.description,
    source: data.source,
    target: data.target,
    readOnly: data.read_only,
    userMountable: data.user_mountable,
});

export const getMounts = (): Promise<Mount[]> => {
    return new Promise((resolve, reject) => {
        http.get('/api/application/mounts')
            .then(({ data }) =>
                resolve((data.data || []).map((d: FractalResponseData) => rawDataToMount(d.attributes)))
            )
            .catch(reject);
    });
};

export const getMount = (id: number): Promise<Mount> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/application/mounts/${id}`)
            .then(({ data }) => resolve(rawDataToMount(data.attributes)))
            .catch(reject);
    });
};

export const createMount = (mountData: Record<string, any>): Promise<Mount> => {
    return new Promise((resolve, reject) => {
        http.post('/api/application/mounts', mountData)
            .then(({ data }) => resolve(rawDataToMount(data.attributes)))
            .catch(reject);
    });
};

export const updateMount = (id: number, mountData: Record<string, any>): Promise<Mount> => {
    return new Promise((resolve, reject) => {
        http.patch(`/api/application/mounts/${id}`, mountData)
            .then(({ data }) => resolve(rawDataToMount(data.attributes)))
            .catch(reject);
    });
};

export const deleteMount = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.delete(`/api/application/mounts/${id}`)
            .then(() => resolve())
            .catch(reject);
    });
};

export const addMountEggs = (id: number, eggs: number[]): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/application/mounts/${id}/eggs`, { eggs })
            .then(() => resolve())
            .catch(reject);
    });
};

export const addMountNodes = (id: number, nodes: number[]): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/application/mounts/${id}/nodes`, { nodes })
            .then(() => resolve())
            .catch(reject);
    });
};

export const removeMountEgg = (id: number, eggId: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.delete(`/api/application/mounts/${id}/eggs/${eggId}`)
            .then(() => resolve())
            .catch(reject);
    });
};

export const removeMountNode = (id: number, nodeId: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.delete(`/api/application/mounts/${id}/nodes/${nodeId}`)
            .then(() => resolve())
            .catch(reject);
    });
};
