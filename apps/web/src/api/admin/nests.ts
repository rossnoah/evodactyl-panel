import http, { FractalResponseData, getPaginationSet, PaginatedResult } from '@/api/http';

export interface Nest {
    id: number;
    uuid: string;
    author: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    eggs?: Egg[];
    serversCount?: number;
}

export interface Egg {
    id: number;
    uuid: string;
    nestId: number;
    author: string;
    name: string;
    description: string | null;
    dockerImages: Record<string, string>;
    startup: string;
    stopCommand: string | null;
    configFrom: number | null;
    configStartup: string | null;
    configFiles: string | null;
    configLogs: string | null;
    configStop: string | null;
    scriptContainer: string | null;
    scriptEntry: string | null;
    scriptInstall: string | null;
    createdAt: Date;
    updatedAt: Date;
    variables?: EggVariable[];
}

export interface EggVariable {
    id: number;
    eggId: number;
    name: string;
    description: string;
    envVariable: string;
    defaultValue: string;
    userViewable: boolean;
    userEditable: boolean;
    rules: string;
    createdAt: Date;
    updatedAt: Date;
}

const rawDataToNest = (data: any): Nest => ({
    id: data.id,
    uuid: data.uuid,
    author: data.author,
    name: data.name,
    description: data.description,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
    eggs: data.relationships?.eggs?.data?.map((e: FractalResponseData) => rawDataToEgg(e.attributes)),
    serversCount: data.relationships?.servers?.data?.length,
});

const rawDataToEgg = (data: any): Egg => ({
    id: data.id,
    uuid: data.uuid,
    nestId: data.nest_id,
    author: data.author,
    name: data.name,
    description: data.description,
    dockerImages: data.docker_images || {},
    startup: data.startup,
    stopCommand: data.stop,
    configFrom: data.config_from,
    configStartup: data.config_startup,
    configFiles: data.config_files,
    configLogs: data.config_logs,
    configStop: data.config_stop,
    scriptContainer: data.script_container,
    scriptEntry: data.script_entry,
    scriptInstall: data.script_install,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
    variables: data.relationships?.variables?.data?.map((v: FractalResponseData) => rawDataToEggVariable(v.attributes)),
});

const rawDataToEggVariable = (data: any): EggVariable => ({
    id: data.id,
    eggId: data.egg_id,
    name: data.name,
    description: data.description,
    envVariable: data.env_variable,
    defaultValue: data.default_value,
    userViewable: data.user_viewable,
    userEditable: data.user_editable,
    rules: data.rules,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
});

export const getNests = (): Promise<Nest[]> => {
    return new Promise((resolve, reject) => {
        http.get('/api/application/nests', {
            params: { include: 'eggs,servers' },
        })
            .then(({ data }) =>
                resolve((data.data || []).map((d: FractalResponseData) => rawDataToNest(d.attributes)))
            )
            .catch(reject);
    });
};

export const getNest = (id: number): Promise<Nest> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/application/nests/${id}`, {
            params: { include: 'eggs,servers' },
        })
            .then(({ data }) => resolve(rawDataToNest(data.attributes)))
            .catch(reject);
    });
};

export const getEggs = (nestId: number): Promise<Egg[]> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/application/nests/${nestId}/eggs`)
            .then(({ data }) =>
                resolve((data.data || []).map((d: FractalResponseData) => rawDataToEgg(d.attributes)))
            )
            .catch(reject);
    });
};

export const getEgg = (nestId: number, eggId: number): Promise<Egg> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/application/nests/${nestId}/eggs/${eggId}`, {
            params: { include: 'variables' },
        })
            .then(({ data }) => resolve(rawDataToEgg(data.attributes)))
            .catch(reject);
    });
};

export const createNest = (nestData: { name: string; description?: string }): Promise<Nest> => {
    return new Promise((resolve, reject) => {
        http.post('/api/application/nests', nestData)
            .then(({ data }) => resolve(rawDataToNest(data.attributes)))
            .catch(reject);
    });
};

export const updateNest = (id: number, nestData: { name?: string; description?: string | null }): Promise<Nest> => {
    return new Promise((resolve, reject) => {
        http.patch(`/api/application/nests/${id}`, nestData)
            .then(({ data }) => resolve(rawDataToNest(data.attributes)))
            .catch(reject);
    });
};

export const deleteNest = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.delete(`/api/application/nests/${id}`)
            .then(() => resolve())
            .catch(reject);
    });
};

export const createEgg = (nestId: number, eggData: Record<string, any>): Promise<Egg> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/application/nests/${nestId}/eggs`, eggData)
            .then(({ data }) => resolve(rawDataToEgg(data.attributes)))
            .catch(reject);
    });
};

export const updateEgg = (nestId: number, eggId: number, eggData: Record<string, any>): Promise<Egg> => {
    return new Promise((resolve, reject) => {
        http.patch(`/api/application/nests/${nestId}/eggs/${eggId}`, eggData)
            .then(({ data }) => resolve(rawDataToEgg(data.attributes)))
            .catch(reject);
    });
};

export const deleteEgg = (nestId: number, eggId: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.delete(`/api/application/nests/${nestId}/eggs/${eggId}`)
            .then(() => resolve())
            .catch(reject);
    });
};

export const updateEggScript = (nestId: number, eggId: number, scriptData: Record<string, any>): Promise<Egg> => {
    return new Promise((resolve, reject) => {
        http.patch(`/api/application/nests/${nestId}/eggs/${eggId}/script`, scriptData)
            .then(({ data }) => resolve(rawDataToEgg(data.attributes)))
            .catch(reject);
    });
};

export const importEgg = (nestId: number, jsonContent: string): Promise<Egg> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/application/nests/${nestId}/eggs/import`, { json_content: jsonContent })
            .then(({ data }) => resolve(rawDataToEgg(data.attributes)))
            .catch(reject);
    });
};

export const updateEggImport = (nestId: number, eggId: number, jsonContent: string): Promise<Egg> => {
    return new Promise((resolve, reject) => {
        http.put(`/api/application/nests/${nestId}/eggs/${eggId}/import`, { json_content: jsonContent })
            .then(({ data }) => resolve(rawDataToEgg(data.attributes)))
            .catch(reject);
    });
};

export const exportEgg = (nestId: number, eggId: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/application/nests/${nestId}/eggs/${eggId}/export`, { responseType: 'blob' })
            .then(({ data, headers }) => {
                const disposition = headers['content-disposition'] || '';
                const match = disposition.match(/filename=(.+)/);
                const filename = match ? match[1] : 'egg-export.json';

                const url = window.URL.createObjectURL(new Blob([data]));
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                resolve();
            })
            .catch(reject);
    });
};
