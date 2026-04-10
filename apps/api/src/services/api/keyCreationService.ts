import crypto from 'node:crypto';
import type { Prisma } from '@pterodactyl/db';
import { encrypt } from '../../lib/encryption.js';
import { prisma } from '../../prisma/client.js';

/**
 * API key types matching ApiKey model constants.
 */
export const KEY_TYPE_NONE = 0;
export const KEY_TYPE_ACCOUNT = 1;
export const KEY_TYPE_APPLICATION = 2;

export const IDENTIFIER_LENGTH = 16;
export const KEY_LENGTH = 32;

/**
 * Get the prefix for a given key type.
 */
function getPrefixForType(type: number): string {
    if (type === KEY_TYPE_ACCOUNT) return 'ptlc_';
    if (type === KEY_TYPE_APPLICATION) return 'ptla_';
    throw new Error(`Invalid key type: ${type}`);
}

/**
 * Generate a token identifier with the appropriate prefix.
 */
function generateTokenIdentifier(type: number): string {
    const prefix = getPrefixForType(type);
    const randomPart = crypto
        .randomBytes(IDENTIFIER_LENGTH)
        .toString('hex')
        .substring(0, IDENTIFIER_LENGTH - prefix.length);
    return prefix + randomPart;
}

/**
 * Service for creating new API keys.
 * Mirrors app/Services/Api/KeyCreationService.php
 */
export async function createApiKey(
    data: {
        user_id: number;
        memo?: string;
        allowed_ips?: string[];
        [key: string]: any;
    },
    keyType: number = KEY_TYPE_NONE,
    permissions: Record<string, number> = {},
    tx?: Prisma.TransactionClient,
): Promise<{ apiKey: any; plainTextToken: string }> {
    const plainToken = crypto.randomBytes(KEY_LENGTH).toString('hex').substring(0, KEY_LENGTH);
    const encryptedToken = encrypt(plainToken);
    const identifier = generateTokenIdentifier(keyType);

    const createData: Record<string, any> = {
        ...data,
        key_type: keyType,
        identifier,
        token: encryptedToken,
        memo: data.memo ?? '',
        allowed_ips: data.allowed_ips ? JSON.stringify(data.allowed_ips) : '[]',
    };

    // Merge application-level permissions
    if (keyType === KEY_TYPE_APPLICATION) {
        Object.assign(createData, permissions);
    }

    // Remove fields that aren't direct database columns
    delete createData.description;

    const client = tx ?? prisma;
    const apiKey = await client.api_keys.create({
        data: createData as Prisma.api_keysUncheckedCreateInput,
    });

    return { apiKey, plainTextToken: identifier + plainToken };
}
