import { getAllSettingsRaw } from './settingsService.js';

const cache = new Map<string, string>();
let loaded = false;

export async function load(): Promise<void> {
    try {
        const all = await getAllSettingsRaw();
        cache.clear();
        for (const [key, value] of Object.entries(all)) {
            cache.set(key, value);
        }
        loaded = true;
    } catch (err) {
        console.warn('[Settings] cache load failed; falling back to env defaults:', err);
        cache.clear();
    }
}

export async function refresh(): Promise<void> {
    const all = await getAllSettingsRaw();
    cache.clear();
    for (const [key, value] of Object.entries(all)) {
        cache.set(key, value);
    }
    loaded = true;
}

export function get(key: string): string | undefined {
    return cache.get(key);
}

export function getAll(): Record<string, string> {
    return Object.fromEntries(cache.entries());
}

export function isLoaded(): boolean {
    return loaded;
}
