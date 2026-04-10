import type { NextFunction, Request, Response } from '@/types/express.js';
import { config } from '../../config/index.js';
import {
    DisplayException,
    ModelNotFoundException,
    ValidationException,
    type ValidationFieldError,
} from '../../errors/index.js';

interface JsonApiError {
    code: string;
    status: string;
    detail: string;
    source?: { line?: number; file?: string };
    meta?: Record<string, unknown>;
}

/**
 * Get the class name from an error (mirrors PHP's class_basename).
 */
function getErrorCode(err: Error): string {
    return err.constructor.name || 'Error';
}

/**
 * Convert a validation exception into JSON:API error format.
 * Matches Laravel's Handler::invalidJson exactly.
 */
function formatValidationErrors(err: ValidationException): JsonApiError[] {
    return err.fieldErrors.map((fieldError: ValidationFieldError) => {
        const error: JsonApiError = {
            code: 'ValidationException',
            status: '422',
            detail: fieldError.detail,
            meta: {
                source_field: fieldError.sourceField,
                rule: fieldError.rule,
            },
        };

        if (config.app.debug) {
            error.source = {};
        }

        return error;
    });
}

/**
 * Convert a generic error into JSON:API error format.
 * Matches Laravel's Handler::convertExceptionToArray.
 */
function formatError(err: Error): JsonApiError {
    const isDisplayException = err instanceof DisplayException;
    const isNotFound = err instanceof ModelNotFoundException;
    const statusCode = isDisplayException ? (err as DisplayException).statusCode : 500;

    const error: JsonApiError = {
        code: getErrorCode(err),
        status: String(statusCode),
        detail: isDisplayException
            ? err.message
            : 'An unexpected error was encountered while processing this request, please try again.',
    };

    if (isNotFound) {
        error.detail = 'The requested resource could not be found on the server.';
    }

    if (config.app.debug) {
        error.detail = err.message;
        error.source = {};
        error.meta = {
            trace:
                err.stack
                    ?.split('\n')
                    .slice(1)
                    .map((line) => line.trim()) ?? [],
        };
    }

    return error;
}

/**
 * Global Express error handler.
 * Formats all errors as JSON:API error responses matching the Pterodactyl format.
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
    // Handle validation errors specially
    if (err instanceof ValidationException) {
        const errors = formatValidationErrors(err);
        res.status(422).json({ errors });
        return;
    }

    const error = formatError(err);
    const statusCode = parseInt(error.status, 10);

    res.status(statusCode).json({ errors: [error] });
}
