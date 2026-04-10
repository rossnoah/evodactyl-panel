import { ValidationException, type ValidationFieldError } from '../../errors/index.js';

/**
 * Validation schemas for user operations.
 * Mirrors app/Http/Requests/Api/Application/Users/StoreUserRequest.php
 * and app/Http/Requests/Api/Application/Users/UpdateUserRequest.php
 */

interface StoreUserData {
    external_id?: string | null;
    email: string;
    username: string;
    name_first: string;
    name_last: string;
    password?: string;
    language?: string;
    root_admin?: number;
}

interface UpdateUserData {
    external_id?: string | null;
    email?: string;
    username?: string;
    name_first?: string;
    name_last?: string;
    password?: string;
    language?: string;
    root_admin?: number;
}

/**
 * Validate input for creating a new user.
 * Maps first_name/last_name to name_first/name_last as the PHP version does.
 */
export function validateStoreUser(body: Record<string, any>): StoreUserData {
    const errors: ValidationFieldError[] = [];

    // Map API field names to database field names
    const email = body.email;
    const username = body.username;
    const firstName = body.first_name;
    const lastName = body.last_name;
    const password = body.password;
    const externalId = body.external_id;
    const language = body.language;
    const rootAdmin = body.root_admin;

    if (!email || typeof email !== 'string') {
        errors.push({ sourceField: 'email', rule: 'required', detail: 'The email field is required.' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({ sourceField: 'email', rule: 'email', detail: 'The email must be a valid email address.' });
    }

    if (!username || typeof username !== 'string') {
        errors.push({ sourceField: 'username', rule: 'required', detail: 'The username field is required.' });
    } else if (username.length < 1 || username.length > 255) {
        errors.push({
            sourceField: 'username',
            rule: 'between',
            detail: 'The username must be between 1 and 255 characters.',
        });
    } else if (!/^[\w.-]+$/.test(username)) {
        errors.push({ sourceField: 'username', rule: 'regex', detail: 'The username format is invalid.' });
    }

    if (!firstName || typeof firstName !== 'string') {
        errors.push({ sourceField: 'first_name', rule: 'required', detail: 'The first name field is required.' });
    } else if (firstName.length < 1 || firstName.length > 255) {
        errors.push({
            sourceField: 'first_name',
            rule: 'between',
            detail: 'The first name must be between 1 and 255 characters.',
        });
    }

    if (!lastName || typeof lastName !== 'string') {
        errors.push({ sourceField: 'last_name', rule: 'required', detail: 'The last name field is required.' });
    } else if (lastName.length < 1 || lastName.length > 255) {
        errors.push({
            sourceField: 'last_name',
            rule: 'between',
            detail: 'The last name must be between 1 and 255 characters.',
        });
    }

    if (password !== undefined && password !== null && password !== '') {
        if (typeof password !== 'string' || password.length < 8) {
            errors.push({
                sourceField: 'password',
                rule: 'min',
                detail: 'The password must be at least 8 characters.',
            });
        }
    }

    if (language !== undefined && language !== null) {
        if (typeof language !== 'string' || language.length < 2 || language.length > 5) {
            errors.push({
                sourceField: 'language',
                rule: 'between',
                detail: 'The language must be between 2 and 5 characters.',
            });
        }
    }

    if (externalId !== undefined && externalId !== null) {
        if (typeof externalId !== 'string' || externalId.length > 255) {
            errors.push({
                sourceField: 'external_id',
                rule: 'max',
                detail: 'The external id must not exceed 255 characters.',
            });
        }
    }

    if (errors.length > 0) {
        throw new ValidationException(errors);
    }

    return {
        external_id: externalId ?? null,
        email,
        username,
        name_first: firstName,
        name_last: lastName,
        password: password || undefined,
        language: language || 'en',
        root_admin: rootAdmin === true || rootAdmin === 1 || rootAdmin === '1' ? 1 : 0,
    };
}

/**
 * Validate input for updating an existing user.
 * All fields are optional for updates.
 */
export function validateUpdateUser(body: Record<string, any>, _userId?: number): UpdateUserData {
    const errors: ValidationFieldError[] = [];

    const email = body.email;
    const username = body.username;
    const firstName = body.first_name;
    const lastName = body.last_name;
    const password = body.password;
    const externalId = body.external_id;
    const language = body.language;
    const rootAdmin = body.root_admin;

    if (email !== undefined) {
        if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push({ sourceField: 'email', rule: 'email', detail: 'The email must be a valid email address.' });
        }
    }

    if (username !== undefined) {
        if (typeof username !== 'string' || username.length < 1 || username.length > 255) {
            errors.push({
                sourceField: 'username',
                rule: 'between',
                detail: 'The username must be between 1 and 255 characters.',
            });
        } else if (!/^[\w.-]+$/.test(username)) {
            errors.push({ sourceField: 'username', rule: 'regex', detail: 'The username format is invalid.' });
        }
    }

    if (firstName !== undefined) {
        if (typeof firstName !== 'string' || firstName.length < 1 || firstName.length > 255) {
            errors.push({
                sourceField: 'first_name',
                rule: 'between',
                detail: 'The first name must be between 1 and 255 characters.',
            });
        }
    }

    if (lastName !== undefined) {
        if (typeof lastName !== 'string' || lastName.length < 1 || lastName.length > 255) {
            errors.push({
                sourceField: 'last_name',
                rule: 'between',
                detail: 'The last name must be between 1 and 255 characters.',
            });
        }
    }

    if (password !== undefined && password !== null && password !== '') {
        if (typeof password !== 'string' || password.length < 8) {
            errors.push({
                sourceField: 'password',
                rule: 'min',
                detail: 'The password must be at least 8 characters.',
            });
        }
    }

    if (language !== undefined && language !== null) {
        if (typeof language !== 'string' || language.length < 2 || language.length > 5) {
            errors.push({
                sourceField: 'language',
                rule: 'between',
                detail: 'The language must be between 2 and 5 characters.',
            });
        }
    }

    if (externalId !== undefined && externalId !== null) {
        if (typeof externalId !== 'string' || externalId.length > 255) {
            errors.push({
                sourceField: 'external_id',
                rule: 'max',
                detail: 'The external id must not exceed 255 characters.',
            });
        }
    }

    if (errors.length > 0) {
        throw new ValidationException(errors);
    }

    const data: UpdateUserData = {};

    if (externalId !== undefined) data.external_id = externalId;
    if (email !== undefined) data.email = email;
    if (username !== undefined) data.username = username;
    if (firstName !== undefined) data.name_first = firstName;
    if (lastName !== undefined) data.name_last = lastName;
    if (password !== undefined && password !== null && password !== '') data.password = password;
    if (language !== undefined) data.language = language;
    if (rootAdmin !== undefined) data.root_admin = rootAdmin === true || rootAdmin === 1 || rootAdmin === '1' ? 1 : 0;

    return data;
}
