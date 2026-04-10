// Local re-export of Express types that narrows `req.params[key]` from
// `string | string[]` (the Express 5 wildcard-route default) back to `string`.
//
// Recent @types/express-serve-static-core widened ParamsDictionary's string
// index signature to model wildcard routes (`/user/*id`). This codebase uses
// no wildcard routes, so every `parseInt(req.params.foo, 10)` and Prisma
// `where: { uuid: req.params.foo }` site started failing to typecheck.
//
// Declaration merging on the index signature itself does not narrow (TS
// keeps the union of all merged signatures), so we override it at the
// `Request` generic-default level instead. Source files import `Request`,
// `Response`, `NextFunction`, and `RequestHandler` from this module instead
// of from `'express'` directly. The default `P = StringParams` propagates
// through every untyped handler.
//
// If wildcard routes are added later, the affected handler should opt out
// by writing `Request<{ foo: string | string[] }>` explicitly.
import type {
    NextFunction,
    Request as ExpressRequest,
    RequestHandler as ExpressRequestHandler,
    Response,
} from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';

export type StringParams = { [key: string]: string };

export type Request<
    P = StringParams,
    ResBody = any,
    ReqBody = any,
    ReqQuery = ParsedQs,
    Locals extends Record<string, any> = Record<string, any>,
> = ExpressRequest<P, ResBody, ReqBody, ReqQuery, Locals>;

export type RequestHandler<
    P = StringParams,
    ResBody = any,
    ReqBody = any,
    ReqQuery = ParsedQs,
    Locals extends Record<string, any> = Record<string, any>,
> = ExpressRequestHandler<P, ResBody, ReqBody, ReqQuery, Locals>;

export type { NextFunction, Response };
// Re-export for parity with `'express'` so callers can swap imports wholesale.
export type { ParamsDictionary };
