// Fix Node.js 22+ / 25+ experimental uninitialized globalThis.localStorage
if (
  typeof globalThis !== "undefined" &&
  typeof (globalThis as Record<string, unknown>).localStorage !== "undefined" &&
  typeof ((globalThis as Record<string, unknown>).localStorage as Record<string, unknown>)?.getItem !== "function"
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).localStorage;
  } catch {
    const store = new Map<string, string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() { return store.size; },
    };
  }
}

