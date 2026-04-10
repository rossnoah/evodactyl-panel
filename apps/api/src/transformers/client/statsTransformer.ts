import { BaseClientTransformer } from './baseClientTransformer.js';

/**
 * Transformer for server resource utilization stats in the Client API.
 * Mirrors app/Transformers/Api/Client/StatsTransformer.php
 */
export class StatsTransformer extends BaseClientTransformer {
  getResourceName(): string {
    return 'stats';
  }

  transform(data: any): Record<string, unknown> {
    return {
      current_state: data?.state ?? 'stopped',
      is_suspended: data?.is_suspended ?? false,
      resources: {
        memory_bytes: data?.utilization?.memory_bytes ?? 0,
        cpu_absolute: data?.utilization?.cpu_absolute ?? 0,
        disk_bytes: data?.utilization?.disk_bytes ?? 0,
        network_rx_bytes: data?.utilization?.network?.rx_bytes ?? 0,
        network_tx_bytes: data?.utilization?.network?.tx_bytes ?? 0,
        uptime: data?.utilization?.uptime ?? 0,
      },
    };
  }
}
