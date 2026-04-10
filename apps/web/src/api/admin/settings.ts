import http from '@/api/http';

export interface PanelSettings {
    'app:name'?: string;
    'app:locale'?: string;
    'pterodactyl:auth:2fa_required'?: string;
    'mail:mailers:smtp:host'?: string;
    'mail:mailers:smtp:port'?: string;
    'mail:mailers:smtp:encryption'?: string;
    'mail:mailers:smtp:username'?: string;
    'mail:mailers:smtp:password'?: string;
    'mail:from:address'?: string;
    'mail:from:name'?: string;
    [key: string]: string | undefined;
}

export const getSettings = (): Promise<PanelSettings> => {
    return new Promise((resolve, reject) => {
        http.get('/api/application/settings')
            .then(({ data }) => resolve(data.data || {}))
            .catch(reject);
    });
};

export const updateSettings = (settings: PanelSettings): Promise<PanelSettings> => {
    return new Promise((resolve, reject) => {
        http.patch('/api/application/settings', settings)
            .then(({ data }) => resolve(data.data || {}))
            .catch(reject);
    });
};
