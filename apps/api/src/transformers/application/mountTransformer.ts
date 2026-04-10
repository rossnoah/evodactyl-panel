import { prisma } from '../../prisma/client.js';
import { type SerializedResource, serializeCollection } from '../../serializers/jsonApi.js';
import { BaseTransformer } from './baseTransformer.js';

/**
 * Mount transformer for Application API responses.
 * Mirrors app/Transformers/Api/Application/MountTransformer.php
 */
export class MountTransformer extends BaseTransformer {
    getResourceName(): string {
        return 'mount';
    }

    getAvailableIncludes(): string[] {
        return ['eggs', 'nodes', 'servers'];
    }

    transform(model: any): Record<string, unknown> {
        return {
            id: model.id,
            uuid: model.uuid,
            name: model.name,
            description: model.description,
            source: model.source,
            target: model.target,
            read_only: Boolean(model.read_only),
            user_mountable: Boolean(model.user_mountable),
        };
    }

    async includeEggs(model: any): Promise<SerializedResource> {
        const pivots = await prisma.egg_mount.findMany({
            where: { mount_id: model.id },
            include: { eggs: true },
        });

        const eggs = pivots.map((p: any) => p.eggs);
        const { EggTransformer } = await import('./eggTransformer.js');
        const transformer = this.makeTransformer(EggTransformer);
        const items = eggs.map((e: any) => transformer.transform(e));
        return serializeCollection('egg', items);
    }

    async includeNodes(model: any): Promise<SerializedResource> {
        const pivots = await prisma.mount_node.findMany({
            where: { mount_id: model.id },
            include: { nodes: true },
        });

        const nodes = pivots.map((p: any) => p.nodes);
        const { NodeTransformer } = await import('./nodeTransformer.js');
        const transformer = this.makeTransformer(NodeTransformer);
        const items = await Promise.all(nodes.map((n: any) => transformer.transform(n)));
        return serializeCollection('node', items);
    }

    async includeServers(model: any): Promise<SerializedResource> {
        const pivots = await prisma.mount_server.findMany({
            where: { mount_id: model.id },
            include: { servers: true },
        });

        const servers = pivots.map((p: any) => p.servers);
        const { ServerTransformer } = await import('./serverTransformer.js');
        const transformer = this.makeTransformer(ServerTransformer);
        const items = await Promise.all(servers.map((s: any) => transformer.transform(s)));
        return serializeCollection('server', items);
    }
}
