import { BaseTransformer } from '../application/baseTransformer.js';

/**
 * Base transformer for Client API responses.
 * Mirrors app/Transformers/Api/Client/BaseClientTransformer.php
 */
export abstract class BaseClientTransformer extends BaseTransformer {
    /**
     * Get the user making the request.
     */
    protected getUser(): any {
        if (!this.request) return null;
        return (this.request as any).user;
    }

    /**
     * Check if the user has a specific permission on a server.
     * Used when including related resources on client API responses.
     */
    protected authorize(ability: string, server?: any): boolean {
        const user = this.getUser();
        if (!user) return false;

        // Root admins always have access
        if (user.root_admin) return true;

        if (!server) return false;

        // Check if user is the server owner
        if (server.owner_id === user.id) return true;

        // Check subuser permissions (will be fully implemented in Phase 3)
        const subuser = (this.request as any)?.subuser;
        if (subuser && Array.isArray(subuser.permissions)) {
            return subuser.permissions.includes(ability);
        }

        return false;
    }
}
