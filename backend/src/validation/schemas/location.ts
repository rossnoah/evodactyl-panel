/**
 * Validation schemas for Location API requests.
 * Mirrors app/Http/Requests/Api/Application/Locations/StoreLocationRequest.php
 * and app/Models/Location::$validationRules
 */

import { ValidationException, type ValidationFieldError } from '../../errors/index.js';

export interface StoreLocationData {
  short: string;
  long?: string | null;
}

export interface UpdateLocationData {
  short?: string;
  long?: string | null;
}

/**
 * Validate store location request data.
 */
export function validateStoreLocation(body: Record<string, any>): StoreLocationData {
  const errors: string[] = [];

  if (!body.short || typeof body.short !== 'string') {
    errors.push('short is required and must be a string.');
  } else if (body.short.length < 1 || body.short.length > 60) {
    errors.push('short must be between 1 and 60 characters.');
  }

  if (body.long !== undefined && body.long !== null) {
    if (typeof body.long !== 'string') {
      errors.push('long must be a string.');
    } else if (body.long.length < 1 || body.long.length > 191) {
      errors.push('long must be between 1 and 191 characters.');
    }
  }

  if (errors.length > 0) {
    throw new ValidationException(errors.map(e => ({
      sourceField: e.startsWith('short') ? 'short' : 'long',
      rule: 'required',
      detail: e,
    })));
  }

  return {
    short: body.short,
    long: body.long ?? null,
  };
}

/**
 * Validate update location request data.
 * Mirrors UpdateLocationRequest.php which uses Location::getRulesForUpdate()
 * — short is required even on updates.
 */
export function validateUpdateLocation(body: Record<string, any>): UpdateLocationData {
  const errors: string[] = [];

  if (!body.short || typeof body.short !== 'string') {
    throw new ValidationException([{
      sourceField: 'short',
      rule: 'required',
      detail: 'The Location Identifier field is required.',
    }]);
  } else if (body.short.length < 1 || body.short.length > 60) {
    throw new ValidationException([{
      sourceField: 'short',
      rule: 'between',
      detail: 'The Location Identifier must be between 1 and 60 characters.',
    }]);
  }

  if (body.long !== undefined && body.long !== null) {
    if (typeof body.long !== 'string' || body.long.length < 1 || body.long.length > 191) {
      throw new ValidationException([{
        sourceField: 'long',
        rule: 'between',
        detail: 'The long must be between 1 and 191 characters.',
      }]);
    }
  }

  return {
    short: body.short,
    long: body.long,
  };
}
