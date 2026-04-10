import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { getConnectionAddress, getDecryptedKey, type NodeConnectionFields } from '../../lib/node.js';

/**
 * TypeScript port of app/Services/Nodes/NodeJWTService.php.
 *
 * Produces Wings-compatible JWTs with the exact claim shape Laravel emits:
 *   iss  — panel URL (config.app.url)
 *   aud  — node connection address
 *   jti  — md5(identifiedBy) (and mirrored into the JWT header)
 *   iat  — issued-at (seconds since epoch)
 *   nbf  — now minus 5 minutes
 *   exp  — optional, set via setExpiresAt()
 *   sub  — optional, set via setSubject() (also mirrored into the JWT header)
 *   user_uuid, user_id — present when setUser() was called
 *   unique_id — a random 16-char string (matches Laravel's Str::random())
 *   ...any custom claims added via setClaims()
 */

export interface NodeJwtUser {
    id: number | bigint;
    uuid: string;
}

export class NodeJWTService {
    private claims: Record<string, unknown> = {};
    private user: NodeJwtUser | null = null;
    private expiresAt: Date | null = null;
    private subject: string | null = null;

    setClaims(claims: Record<string, unknown>): this {
        this.claims = claims;
        return this;
    }

    setUser(user: NodeJwtUser): this {
        this.user = user;
        return this;
    }

    setExpiresAt(date: Date): this {
        this.expiresAt = date;
        return this;
    }

    setSubject(subject: string): this {
        this.subject = subject;
        return this;
    }

    /**
     * Generate a signed JWT for the given node.
     *
     * @param node         Node to generate the token for.
     * @param identifiedBy Value to hash as the JWT id; typically `${user.id}${server.uuid}`.
     * @param algo         Hash algorithm for the identifier (defaults to md5, matching Laravel).
     */
    handle(node: NodeConnectionFields, identifiedBy: string | null, algo: string = 'md5'): string {
        const secret = getDecryptedKey(node);
        const identifier = crypto
            .createHash(algo)
            .update(identifiedBy ?? '')
            .digest('hex');

        const nowSeconds = Math.floor(Date.now() / 1000);

        const payload: Record<string, unknown> = {
            iat: nowSeconds,
            nbf: nowSeconds - 300,
            ...this.claims,
        };

        if (this.user) {
            payload.user_uuid = this.user.uuid;
            // Deprecated — retained so older Wings versions continue to work.
            // Cast to number for JWT serialization consistency with Laravel.
            payload.user_id = Number(this.user.id);
        }

        payload.unique_id = randomString(16);

        const header: Record<string, unknown> = { jti: identifier };
        if (this.subject) {
            header.sub = this.subject;
        }

        const options: SignOptions = {
            algorithm: 'HS256',
            issuer: config.app.url,
            audience: getConnectionAddress(node),
            jwtid: identifier,
            // iat and nbf are written directly into the payload above so that
            // nbf = iat - 300 exactly, matching Laravel. jsonwebtoken preserves
            // payload.iat (and leaves payload.nbf alone unless options.notBefore
            // is set), so we must NOT pass noTimestamp: true here — that option
            // deletes payload.iat.
            header: header as unknown as SignOptions['header'],
        };

        if (this.expiresAt) {
            payload.exp = Math.floor(this.expiresAt.getTime() / 1000);
        }

        if (this.subject) {
            options.subject = this.subject;
        }

        return jwt.sign(payload, secret, options);
    }
}

/**
 * Mirrors Laravel's Str::random() default (16 alphanumeric chars).
 */
function randomString(length: number): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = crypto.randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i++) {
        out += alphabet[bytes[i]! % alphabet.length];
    }
    return out;
}
