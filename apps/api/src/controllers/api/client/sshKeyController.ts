import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../../../prisma/client.js';
import { fractal } from '../../../serializers/fractal.js';
import { UserSSHKeyTransformer } from '../../../transformers/client/userSSHKeyTransformer.js';
import { activityFromRequest } from '../../../services/activity/activityLogService.js';
import { ValidationException } from '../../../errors/index.js';

/**
 * Client SSH Key Controller.
 * Mirrors app/Http/Controllers/Api/Client/SSHKeyController.php
 */

/**
 * Compute the fingerprint for an SSH public key.
 * Uses SHA256 hash of the base64-decoded key data.
 */
function computeFingerprint(publicKey: string): string {
  const parts = publicKey.trim().split(/\s+/);
  const keyData = parts.length >= 2 ? parts[1] : parts[0];
  const hash = crypto.createHash('sha256').update(Buffer.from(keyData, 'base64')).digest('base64');
  return `SHA256:${hash.replace(/=+$/, '')}`;
}

/**
 * GET /api/client/account/ssh-keys
 * Return all SSH keys for the authenticated user.
 */
export async function index(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as any).user;

    const keys = await prisma.user_ssh_keys.findMany({
      where: { user_id: user.id, deleted_at: null },
    });

    const transformer = new UserSSHKeyTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .collection(keys)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/client/account/ssh-keys
 * Store a new SSH key for the authenticated user.
 */
export async function store(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as any).user;
    const { name, public_key } = req.body;

    if (!name || typeof name !== 'string') {
      throw new ValidationException([
        { sourceField: 'name', rule: 'required', detail: 'The name field is required.' },
      ]);
    }

    if (!public_key || typeof public_key !== 'string') {
      throw new ValidationException([
        { sourceField: 'public_key', rule: 'required', detail: 'The public key field is required.' },
      ]);
    }

    const fingerprint = computeFingerprint(public_key);

    const model = await prisma.user_ssh_keys.create({
      data: {
        user_id: user.id,
        name,
        public_key: public_key.trim(),
        fingerprint,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    await activityFromRequest(req)
      .event('user:ssh-key.create')
      .property('fingerprint', fingerprint)
      .log();

    const transformer = new UserSSHKeyTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .item(model)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/client/account/ssh-keys/remove
 * Delete an SSH key from the authenticated user's account.
 */
export async function destroy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as any).user;
    const { fingerprint } = req.body;

    if (!fingerprint || typeof fingerprint !== 'string') {
      throw new ValidationException([
        { sourceField: 'fingerprint', rule: 'required', detail: 'The fingerprint field is required.' },
      ]);
    }

    const key = await prisma.user_ssh_keys.findFirst({
      where: {
        user_id: user.id,
        fingerprint,
      },
    });

    if (key) {
      await prisma.user_ssh_keys.update({
        where: { id: key.id },
        data: { deleted_at: new Date() },
      });

      await activityFromRequest(req)
        .event('user:ssh-key.delete')
        .property('fingerprint', key.fingerprint)
        .log();
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
