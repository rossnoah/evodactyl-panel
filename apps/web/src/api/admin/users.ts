import http, { FractalResponseData, getPaginationSet, PaginatedResult } from '@/api/http';

export interface AdminUser {
    id: number;
    externalId: string | null;
    uuid: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    language: string;
    rootAdmin: boolean;
    twoFactorEnabled: boolean;
    createdAt: string;
    updatedAt: string;
}

export const rawDataToAdminUser = ({ attributes }: FractalResponseData): AdminUser => ({
    id: attributes.id,
    externalId: attributes.external_id,
    uuid: attributes.uuid,
    username: attributes.username,
    email: attributes.email,
    firstName: attributes.first_name,
    lastName: attributes.last_name,
    language: attributes.language,
    rootAdmin: attributes.root_admin,
    twoFactorEnabled: attributes['2fa_enabled'] ?? attributes['2fa'] ?? false,
    createdAt: attributes.created_at,
    updatedAt: attributes.updated_at,
});

interface GetUsersParams {
    page?: number;
    filterEmail?: string;
}

export const getUsers = ({ page, filterEmail }: GetUsersParams = {}): Promise<PaginatedResult<AdminUser>> => {
    return new Promise((resolve, reject) => {
        http.get('/api/application/users', {
            params: {
                page,
                'filter[email]': filterEmail || undefined,
            },
        })
            .then(({ data }) =>
                resolve({
                    items: (data.data || []).map((datum: any) => rawDataToAdminUser(datum)),
                    pagination: getPaginationSet(data.meta.pagination),
                })
            )
            .catch(reject);
    });
};

export const getUser = (id: number): Promise<AdminUser> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/application/users/${id}`)
            .then(({ data }) => resolve(rawDataToAdminUser(data)))
            .catch(reject);
    });
};

export interface CreateUserData {
    email: string;
    username: string;
    first_name: string;
    last_name: string;
    password?: string;
    root_admin?: boolean;
    language?: string;
}

export const createUser = (data: CreateUserData): Promise<AdminUser> => {
    return new Promise((resolve, reject) => {
        http.post('/api/application/users', data)
            .then(({ data }) => resolve(rawDataToAdminUser(data)))
            .catch(reject);
    });
};

export interface UpdateUserData {
    email: string;
    username: string;
    first_name: string;
    last_name: string;
    password?: string;
    root_admin?: boolean;
    language?: string;
}

export const updateUser = (id: number, data: UpdateUserData): Promise<AdminUser> => {
    return new Promise((resolve, reject) => {
        http.patch(`/api/application/users/${id}`, data)
            .then(({ data }) => resolve(rawDataToAdminUser(data)))
            .catch(reject);
    });
};

export const deleteUser = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.delete(`/api/application/users/${id}`)
            .then(() => resolve())
            .catch(reject);
    });
};
