import crypto from 'node:crypto';
import { config } from '../../config/index.js';
import { encrypt } from '../../lib/encryption.js';
import { prisma } from '../../prisma/client.js';
import { getAppName } from '../settings/resolvedConfig.js';

const VALID_BASE32_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Service for setting up two-factor authentication on a user account.
 * Generates a TOTP secret and returns the QR code URL data.
 * Mirrors app/Services/Users/TwoFactorSetupService.php
 */
export async function setupTwoFactor(user: any): Promise<{
    image_url_data: string;
    secret: string;
}> {
    const bytes = config.pterodactyl.auth.twoFactor.bytes || 16;

    // Generate a random base32 secret
    let secret = '';
    for (let i = 0; i < bytes; i++) {
        const randomIndex = crypto.randomInt(0, 32);
        secret += VALID_BASE32_CHARACTERS[randomIndex];
    }

    // Store the encrypted secret on the user
    await prisma.users.update({
        where: { id: user.id },
        data: {
            totp_secret: encrypt(secret),
        },
    });

    const company = encodeURIComponent(getAppName().replace(/\s/g, ''));

    const imageUrlData = `otpauth://totp/${encodeURIComponent(company)}:${encodeURIComponent(user.email)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(company)}`;

    return {
        image_url_data: imageUrlData,
        secret,
    };
}
