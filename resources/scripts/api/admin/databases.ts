import http, { FractalResponseData } from '@/api/http';

export interface DatabaseHost {
    id: number;
    name: string;
    host: string;
    port: number;
    username: string;
    maxDatabases: number;
    nodeId: number | null;
    createdAt: Date;
    updatedAt: Date;
    databasesCount?: number;
}

const rawDataToDatabaseHost = (data: any): DatabaseHost => ({
    id: data.id,
    name: data.name,
    host: data.host,
    port: data.port,
    username: data.username,
    maxDatabases: data.max_databases || 0,
    nodeId: data.node_id,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
    databasesCount: data.relationships?.databases?.data?.length,
});

export const getDatabaseHosts = (): Promise<DatabaseHost[]> => {
    return new Promise((resolve, reject) => {
        http.get('/api/application/databases', {
            params: { include: 'databases' },
        })
            .then(({ data }) =>
                resolve((data.data || []).map((d: FractalResponseData) => rawDataToDatabaseHost(d.attributes)))
            )
            .catch(reject);
    });
};

export const getDatabaseHost = (id: number): Promise<DatabaseHost> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/application/databases/${id}`)
            .then(({ data }) => resolve(rawDataToDatabaseHost(data.attributes)))
            .catch(reject);
    });
};

export const createDatabaseHost = (hostData: Record<string, any>): Promise<DatabaseHost> => {
    return new Promise((resolve, reject) => {
        http.post('/api/application/databases', hostData)
            .then(({ data }) => resolve(rawDataToDatabaseHost(data.attributes)))
            .catch(reject);
    });
};

export const updateDatabaseHost = (id: number, hostData: Record<string, any>): Promise<DatabaseHost> => {
    return new Promise((resolve, reject) => {
        http.patch(`/api/application/databases/${id}`, hostData)
            .then(({ data }) => resolve(rawDataToDatabaseHost(data.attributes)))
            .catch(reject);
    });
};

export const deleteDatabaseHost = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.delete(`/api/application/databases/${id}`)
            .then(() => resolve())
            .catch(reject);
    });
};
