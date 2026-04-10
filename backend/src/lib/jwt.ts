import jwt from 'jsonwebtoken';

export interface JwtPayload {
  [key: string]: unknown;
}

/**
 * Sign a JWT token with the given secret and options.
 */
export function signJwt(
  payload: JwtPayload,
  secret: string,
  options: jwt.SignOptions = {}
): string {
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    ...options,
  });
}

/**
 * Verify and decode a JWT token.
 */
export function verifyJwt(token: string, secret: string): JwtPayload {
  return jwt.verify(token, secret, {
    algorithms: ['HS256'],
  }) as JwtPayload;
}
