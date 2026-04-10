import { Request, Response, NextFunction } from 'express';
import { fractal } from '../../../serializers/fractal.js';
import { AccountTransformer } from '../../../transformers/client/accountTransformer.js';
import { updateUser } from '../../../services/users/userUpdateService.js';
import { verifyPassword } from '../../../lib/password.js';
import { activityFromRequest } from '../../../services/activity/activityLogService.js';
import {
  BadRequestHttpException,
  TooManyRequestsHttpException,
  ValidationException,
} from '../../../errors/index.js';

/**
 * Client API Account Controller.
 * Mirrors app/Http/Controllers/Api/Client/AccountController.php
 */

// In-memory rate limiter for email changes (per user UUID)
const emailChangeAttempts = new Map<string, { count: number; resetAt: number }>();
const EMAIL_UPDATE_THROTTLE = 60 * 60 * 24; // 24 hours in seconds
const EMAIL_UPDATE_MAX_ATTEMPTS = 3;

/**
 * GET /api/client/account
 * Return basic information about the currently logged-in user.
 */
export async function index(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as any).user;

    const transformer = new AccountTransformer();
    transformer.setRequest(req);

    const response = await fractal(req)
      .item(user)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/client/account/email
 * Update the authenticated user's email address.
 */
export async function updateEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as any).user;
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ValidationException([
        { sourceField: 'email', rule: 'required', detail: 'The email field is required.' },
        { sourceField: 'password', rule: 'required', detail: 'The password field is required.' },
      ].filter(e => !req.body[e.sourceField]));
    }

    // Verify password
    if (!await verifyPassword(password, user.password)) {
      throw new BadRequestHttpException('The password provided was not valid.');
    }

    // Rate limit email changes
    const key = `user:update-email:${user.uuid}`;
    const now = Math.floor(Date.now() / 1000);
    const entry = emailChangeAttempts.get(key);

    if (entry && entry.resetAt > now && entry.count >= EMAIL_UPDATE_MAX_ATTEMPTS) {
      throw new TooManyRequestsHttpException(
        'Your email address has been changed too many times today. Please try again later.'
      );
    }

    const originalEmail = user.email;
    if (originalEmail.toLowerCase() !== email.toLowerCase()) {
      // Record the attempt
      if (entry && entry.resetAt > now) {
        entry.count++;
      } else {
        emailChangeAttempts.set(key, { count: 1, resetAt: now + EMAIL_UPDATE_THROTTLE });
      }

      await updateUser(user, { email });

      await activityFromRequest(req)
        .event('user:account.email-changed')
        .property({ old: originalEmail, new: email })
        .log();
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/client/account/password
 * Update the authenticated user's password.
 */
export async function updatePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as any).user;
    const { current_password, password, password_confirmation } = req.body;

    if (!current_password || !password || !password_confirmation) {
      throw new ValidationException([
        ...(current_password ? [] : [{ sourceField: 'current_password', rule: 'required', detail: 'The current password field is required.' }]),
        ...(password ? [] : [{ sourceField: 'password', rule: 'required', detail: 'The password field is required.' }]),
        ...(password_confirmation ? [] : [{ sourceField: 'password_confirmation', rule: 'required', detail: 'The password confirmation field is required.' }]),
      ]);
    }

    if (password !== password_confirmation) {
      throw new ValidationException([
        { sourceField: 'password', rule: 'confirmed', detail: 'The password confirmation does not match.' },
      ]);
    }

    if (password.length < 8) {
      throw new ValidationException([
        { sourceField: 'password', rule: 'min', detail: 'The password must be at least 8 characters.' },
      ]);
    }

    // Verify current password
    if (!await verifyPassword(current_password, user.password)) {
      throw new BadRequestHttpException('The password provided was not valid.');
    }

    await activityFromRequest(req)
      .event('user:account.password-changed')
      .log();

    await updateUser(user, { password });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
