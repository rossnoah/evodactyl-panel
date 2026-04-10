import { BaseTransformer } from './baseTransformer.js';
import { serializeCollection, serializeItem, serializeNull, type SerializedResource } from '../../serializers/jsonApi.js';
import { prisma } from '../../prisma/client.js';

/**
 * Egg transformer for Application API responses.
 * Mirrors app/Transformers/Api/Application/EggTransformer.php
 */
export class EggTransformer extends BaseTransformer {
  getResourceName(): string {
    return 'egg';
  }

  getAvailableIncludes(): string[] {
    return ['nest', 'servers', 'config', 'script', 'variables'];
  }

  transform(model: any): Record<string, unknown> {
    const dockerImages = typeof model.docker_images === 'string'
      ? JSON.parse(model.docker_images)
      : (model.docker_images ?? {});

    let configFiles: unknown = {};
    try {
      const parsed = typeof model.config_files === 'string'
        ? JSON.parse(model.config_files)
        : model.config_files;
      configFiles = parsed && Object.keys(parsed).length > 0 ? parsed : {};
    } catch {
      configFiles = {};
    }

    let configStartup: unknown = null;
    try {
      const parsedStartup = typeof model.config_startup === 'string'
        ? JSON.parse(model.config_startup)
        : model.config_startup;
      // PHP json_decode with assoc=true converts {} to empty array []
      if (parsedStartup !== null && typeof parsedStartup === 'object' && !Array.isArray(parsedStartup) && Object.keys(parsedStartup).length === 0) {
        configStartup = [];
      } else {
        configStartup = parsedStartup;
      }
    } catch {
      configStartup = null;
    }

    let configLogs: unknown = null;
    try {
      const parsedLogs = typeof model.config_logs === 'string'
        ? JSON.parse(model.config_logs)
        : model.config_logs;
      // PHP json_decode with assoc=true converts {} to empty array []
      if (parsedLogs !== null && typeof parsedLogs === 'object' && !Array.isArray(parsedLogs) && Object.keys(parsedLogs).length === 0) {
        configLogs = [];
      } else {
        configLogs = parsedLogs;
      }
    } catch {
      configLogs = null;
    }

    const fileDenylist = model.file_denylist == null
      ? null
      : (typeof model.file_denylist === 'string'
        ? JSON.parse(model.file_denylist)
        : model.file_denylist);

    const dockerImagesObj = typeof dockerImages === 'object' && !Array.isArray(dockerImages)
      ? dockerImages
      : {};
    const firstImage = Object.values(dockerImagesObj)[0] ?? '';

    return {
      id: model.id,
      uuid: model.uuid,
      name: model.name,
      nest: model.nest_id,
      author: model.author,
      description: model.description,
      docker_image: firstImage,
      docker_images: dockerImagesObj,
      config: {
        files: configFiles,
        startup: configStartup,
        stop: model.config_stop,
        logs: configLogs,
        file_denylist: fileDenylist,
        extends: model.config_from,
      },
      startup: model.startup,
      script: {
        privileged: Boolean(model.script_is_privileged),
        install: model.script_install,
        entry: model.script_entry,
        container: model.script_container,
        extends: model.copy_script_from,
      },
      created_at: this.formatTimestamp(model.created_at),
      updated_at: this.formatTimestamp(model.updated_at),
    };
  }

  async includeNest(model: any): Promise<SerializedResource> {
    if (!this.authorize('nests')) {
      return serializeNull();
    }

    const nest = model.nests ?? await prisma.nests.findUnique({
      where: { id: model.nest_id },
    });

    if (!nest) return serializeNull();

    const { NestTransformer } = await import('./nestTransformer.js');
    const transformer = this.makeTransformer(NestTransformer);
    const transformed = transformer.transform(nest);
    return serializeItem('nest', transformed);
  }

  async includeServers(model: any): Promise<SerializedResource> {
    if (!this.authorize('servers')) {
      return serializeNull();
    }

    const servers = model.servers ?? await prisma.servers.findMany({
      where: { egg_id: model.id },
    });

    const items = servers.map((server: any) => ({
      id: server.id,
      uuid: server.uuid,
      name: server.name,
    }));
    return serializeCollection('server', items);
  }

  async includeConfig(model: any): Promise<SerializedResource> {
    if (model.config_from === null || model.config_from === undefined) {
      return serializeNull();
    }

    const parent = await prisma.eggs.findUnique({
      where: { id: model.config_from },
    });

    const configFiles = parent?.config_files ?? model.config_files;
    const configStartup = parent?.config_startup ?? model.config_startup;
    const configStop = parent?.config_stop ?? model.config_stop;
    const configLogs = parent?.config_logs ?? model.config_logs;

    return serializeItem('egg', {
      files: typeof configFiles === 'string' ? JSON.parse(configFiles) : configFiles,
      startup: typeof configStartup === 'string' ? JSON.parse(configStartup) : configStartup,
      stop: configStop,
      logs: typeof configLogs === 'string' ? JSON.parse(configLogs) : configLogs,
    });
  }

  async includeScript(model: any): Promise<SerializedResource> {
    if (model.copy_script_from === null || model.copy_script_from === undefined) {
      return serializeNull();
    }

    const parent = await prisma.eggs.findUnique({
      where: { id: model.copy_script_from },
    });

    return serializeItem('egg', {
      privileged: Boolean(model.script_is_privileged),
      install: parent?.script_install ?? model.script_install,
      entry: parent?.script_entry ?? model.script_entry,
      container: parent?.script_container ?? model.script_container,
    });
  }

  async includeVariables(model: any): Promise<SerializedResource> {
    if (!this.authorize('eggs')) {
      return serializeNull();
    }

    const variables = model.egg_variables ?? await prisma.egg_variables.findMany({
      where: { egg_id: model.id },
    });

    const { EggVariableTransformer } = await import('./eggVariableTransformer.js');
    const transformer = this.makeTransformer(EggVariableTransformer);
    const items = variables.map((v: any) => transformer.transform(v));
    return serializeCollection('egg_variable', items);
  }
}
