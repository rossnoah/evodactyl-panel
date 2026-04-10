import { Request, Response } from 'express';
import {
  serializeItem,
  serializeCollection,
  serializeNull,
  mergeIncludes,
  type SerializedItem,
  type SerializedCollection,
  type SerializedResource,
} from './jsonApi.js';
import { buildPaginationMeta, type PaginationMeta } from './pagination.js';
import type { BaseTransformer } from '../transformers/application/baseTransformer.js';

/**
 * Fractal-equivalent response builder.
 * Provides a fluent interface for building JSON:API responses
 * matching the Spatie Fractal + PterodactylSerializer behavior.
 */
export class FractalResponse {
  private transformer: BaseTransformer | null = null;
  private resourceData: unknown = null;
  private isCollection: boolean = false;
  private requestedIncludes: string[] = [];
  private meta: Record<string, unknown> = {};
  private paginationInfo: { total: number; perPage: number; currentPage: number } | null = null;
  private maxRecursion: number = 2;
  private baseUrl: string | undefined = undefined;

  /**
   * Set the data as a single item.
   */
  item(data: unknown): this {
    this.resourceData = data;
    this.isCollection = false;
    return this;
  }

  /**
   * Set the data as a collection.
   */
  collection(data: unknown): this {
    this.resourceData = data;
    this.isCollection = true;
    return this;
  }

  /**
   * Set the transformer to use.
   */
  transformWith(transformer: BaseTransformer): this {
    this.transformer = transformer;
    return this;
  }

  /**
   * Parse includes from the request query string.
   */
  parseIncludes(includes: string[]): this {
    this.requestedIncludes = includes;
    return this;
  }

  /**
   * Limit recursion depth for nested includes.
   */
  limitRecursion(depth: number): this {
    this.maxRecursion = depth;
    return this;
  }

  /**
   * Add metadata to the response.
   */
  addMeta(meta: Record<string, unknown>): this {
    this.meta = { ...this.meta, ...meta };
    return this;
  }

  /**
   * Set pagination info.
   */
  setPagination(total: number, perPage: number, currentPage: number): this {
    this.paginationInfo = { total, perPage, currentPage };
    return this;
  }

  /**
   * Set the base URL for pagination links.
   */
  setBaseUrl(url: string): this {
    this.baseUrl = url;
    return this;
  }

  /**
   * Transform a single item through the transformer and resolve includes.
   */
  private async transformItem(data: unknown, depth: number = 0): Promise<SerializedItem> {
    if (!this.transformer) {
      throw new Error('No transformer set');
    }

    if (data === null || data === undefined) {
      return serializeNull() as unknown as SerializedItem;
    }

    const resourceName = this.transformer.getResourceName();
    const transformed = await this.transformer.transform(data);
    const item = serializeItem(resourceName, transformed);

    // Process includes
    if (depth < this.maxRecursion) {
      const availableIncludes = this.transformer.getAvailableIncludes();
      const defaultIncludes = this.transformer.getDefaultIncludes();
      const includesToProcess = [
        ...defaultIncludes,
        ...this.requestedIncludes.filter(inc => availableIncludes.includes(inc)),
      ];

      const uniqueIncludes = [...new Set(includesToProcess)];
      const includedData: Record<string, SerializedResource> = {};

      for (const include of uniqueIncludes) {
        const includeMethod = `include${include.charAt(0).toUpperCase()}${include.slice(1)}`;
        if (typeof (this.transformer as any)[includeMethod] === 'function') {
          const result = await (this.transformer as any)[includeMethod](data);
          if (result !== undefined) {
            includedData[include] = result;
          }
        }
      }

      return mergeIncludes(item, includedData);
    }

    return item;
  }

  /**
   * Build the final response array.
   */
  async toArray(): Promise<Record<string, unknown>> {
    if (!this.transformer) {
      throw new Error('No transformer set');
    }

    if (this.isCollection) {
      const items = this.resourceData as unknown[];
      const transformedItems: SerializedItem[] = [];

      for (const item of items) {
        transformedItems.push(await this.transformItem(item));
      }

      const resourceName = this.transformer.getResourceName();
      const result: Record<string, unknown> = {
        object: 'list',
        data: transformedItems,
      };

      if (this.paginationInfo) {
        result.meta = buildPaginationMeta(
          this.paginationInfo.total,
          transformedItems.length,
          this.paginationInfo.perPage,
          this.paginationInfo.currentPage,
          this.baseUrl
        );
      }

      if (Object.keys(this.meta).length > 0) {
        result.meta = { ...(result.meta as object || {}), ...this.meta };
      }

      return result;
    }

    // Single item
    const transformed = await this.transformItem(this.resourceData);
    const result: Record<string, unknown> = { ...transformed };

    if (Object.keys(this.meta).length > 0) {
      result.meta = this.meta;
    }

    return result;
  }

  /**
   * Send the response with the given status code.
   */
  async respond(res: Response, statusCode: number = 200): Promise<void> {
    const data = await this.toArray();
    res.status(statusCode).json(data);
  }
}

/**
 * Create a new FractalResponse from a request, automatically parsing includes.
 */
export function fractal(req: Request): FractalResponse {
  const response = new FractalResponse();

  // Parse includes from query string (matches Laravel's ApplicationApiController)
  const includeParam = req.query['include'];
  if (typeof includeParam === 'string' && includeParam) {
    const includes = includeParam.split(',').map(s => s.trim()).filter(Boolean);
    response.parseIncludes(includes);
  }

  // Set base URL for pagination links (matches Laravel's IlluminatePaginatorAdapter)
  const protocol = req.protocol;
  const host = req.get('host');
  const path = req.baseUrl + req.path;
  response.setBaseUrl(`${protocol}://${host}${path}`);

  response.limitRecursion(2);

  return response;
}
