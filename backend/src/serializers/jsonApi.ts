/**
 * PterodactylSerializer port.
 * Matches the exact envelope format from:
 * app/Extensions/League/Fractal/Serializers/PterodactylSerializer.php
 */

export interface SerializedItem {
  object: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, unknown>;
}

export interface SerializedCollection {
  object: 'list';
  data: SerializedItem[];
}

export interface SerializedNull {
  object: 'null_resource';
  attributes: null;
}

export type SerializedResource = SerializedItem | SerializedCollection | SerializedNull;

/**
 * Serialize a single item.
 */
export function serializeItem(resourceKey: string, data: Record<string, unknown>): SerializedItem {
  return {
    object: resourceKey,
    attributes: data,
  };
}

/**
 * Serialize a collection of items.
 */
export function serializeCollection(resourceKey: string, data: Record<string, unknown>[]): SerializedCollection {
  return {
    object: 'list',
    data: data.map(datum => serializeItem(resourceKey, datum)),
  };
}

/**
 * Serialize a null resource.
 */
export function serializeNull(): SerializedNull {
  return {
    object: 'null_resource',
    attributes: null,
  };
}

/**
 * Merge included resources into the parent resource's relationships.
 * Matches PterodactylSerializer::mergeIncludes.
 */
/**
 * Merge included resources into the parent resource's attributes.relationships.
 * Matches PterodactylSerializer::mergeIncludes — in PHP, relationships is merged
 * INTO the transformedData array, which becomes the `attributes` value. So the
 * final structure is: { object, attributes: { ...fields, relationships: { ... } } }
 */
export function mergeIncludes(
  transformedData: SerializedItem,
  includedData: Record<string, SerializedResource>
): SerializedItem {
  if (Object.keys(includedData).length === 0) {
    return transformedData;
  }

  return {
    object: transformedData.object,
    attributes: {
      ...transformedData.attributes,
      relationships: {
        ...(transformedData.attributes.relationships as Record<string, unknown> ?? {}),
        ...includedData,
      },
    },
  };
}
