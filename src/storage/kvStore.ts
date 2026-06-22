export interface KvStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}

export function createMemoryKvStore(): KvStore {
  const map = new Map<string, unknown>();
  return {
    async get<T>(key: string) {
      return map.get(key) as T | undefined;
    },
    async set<T>(key: string, value: T) {
      map.set(key, value);
    },
    async delete(key: string) {
      map.delete(key);
    },
    async keys() {
      return Array.from(map.keys());
    },
    async clear() {
      map.clear();
    },
  };
}

interface ChromeStorageArea {
  get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  clear(): Promise<void>;
}

export function createChromeKvStore(area: ChromeStorageArea, namespace: string): KvStore {
  const prefix = `${namespace}::`;
  const k = (key: string) => `${prefix}${key}`;
  return {
    async get<T>(key: string) {
      const out = await area.get(k(key));
      return out[k(key)] as T | undefined;
    },
    async set<T>(key: string, value: T) {
      await area.set({ [k(key)]: value });
    },
    async delete(key: string) {
      await area.remove(k(key));
    },
    async keys() {
      const all = await area.get(null);
      return Object.keys(all)
        .filter((name) => name.startsWith(prefix))
        .map((name) => name.slice(prefix.length));
    },
    async clear() {
      const namespaced = await this.keys();
      if (namespaced.length > 0) {
        await area.remove(namespaced.map(k));
      }
    },
  };
}
