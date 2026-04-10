/**
 * Base display exception — errors that are safe to show to the user.
 */
export class DisplayException extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

export class HttpForbiddenException extends DisplayException {
  constructor(message: string = 'You do not have permission to access this resource.') {
    super(message, 403);
  }
}

export class NotFoundHttpException extends DisplayException {
  constructor(message: string = 'The requested resource could not be found on the server.') {
    super(message, 404);
  }
}

export class AuthenticationException extends DisplayException {
  constructor(message: string = 'Unauthenticated.') {
    super(message, 401);
  }
}

export class AuthorizationException extends DisplayException {
  constructor(message: string = 'You are not authorized to perform this action.') {
    super(message, 403);
  }
}

export class AccessDeniedHttpException extends DisplayException {
  constructor(message: string = 'Access denied.') {
    super(message, 403);
  }
}

export class BadRequestHttpException extends DisplayException {
  constructor(message: string = 'Bad request.') {
    super(message, 400);
  }
}

export class ConflictHttpException extends DisplayException {
  constructor(message: string = 'Conflict.') {
    super(message, 409);
  }
}

export class TooManyRequestsHttpException extends DisplayException {
  constructor(message: string = 'Too many requests.') {
    super(message, 429);
  }
}

export class ServerStateConflictException extends DisplayException {
  constructor(message: string = 'The server is currently in an invalid state for this action.') {
    super(message, 409);
  }
}

export class DaemonConnectionException extends DisplayException {
  constructor(message: string = 'Failed to communicate with the daemon.') {
    super(message, 502);
  }
}

export class ModelNotFoundException extends DisplayException {
  constructor(message: string = 'The requested resource could not be found on the server.') {
    super(message, 404);
  }
}

export class TokenMismatchException extends DisplayException {
  constructor(message: string = 'Token mismatch.') {
    super(message, 403);
  }
}

export class ServiceUnavailableHttpException extends DisplayException {
  constructor(message: string = 'Service temporarily unavailable.') {
    super(message, 503);
  }
}

/**
 * Validation error with per-field details.
 */
export interface ValidationFieldError {
  sourceField: string;
  rule: string;
  detail: string;
}

export class ValidationException extends DisplayException {
  public fieldErrors: ValidationFieldError[];

  constructor(fieldErrors: ValidationFieldError[]) {
    super('Validation failed.', 422);
    this.fieldErrors = fieldErrors;
  }
}
