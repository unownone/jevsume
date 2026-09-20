type MemoryKvGetOptions = {
  type?: string;
  cacheTtl?: number;
};

/**
 * Minimal KVNamespace stand-in for Worker tests. Only implements the
 * get/put/delete/list surface the visitor counter uses.
 */
export function createMemoryKv(): KVNamespace {
  const data = new Map<string, string>();

  async function get(
    key: string | string[],
    options?: MemoryKvGetOptions | string,
  ): Promise<string | null | Map<string, string | null>> {
    const type = typeof options === "string" ? options : options?.type;
    const read = (name: string): string | null => {
      const raw = data.get(name) ?? null;
      if (raw === null || type !== "json") {
        return raw;
      }
      return JSON.parse(raw) as string;
    };
    if (Array.isArray(key)) {
      return new Map(key.map((name) => [name, read(name)]));
    }
    return read(key);
  }

  return {
    get,
    put: async (key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream) => {
      data.set(key, String(value));
    },
    delete: async (key: string) => {
      data.delete(key);
    },
    list: async () => ({
      keys: [...data.keys()].map((name) => ({ name })),
      list_complete: true as const,
    }),
    getWithMetadata: async () => ({ value: null, metadata: null }),
  } as unknown as KVNamespace;
}
