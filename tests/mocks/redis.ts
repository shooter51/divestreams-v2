import { vi } from "vitest";

const store = new Map<string, string>();

export const mockRedis = {
  get: vi.fn().mockImplementation((key: string) => store.get(key) || null),
  set: vi.fn().mockImplementation((key: string, value: string) => {
    store.set(key, value);
    return "OK";
  }),
  setex: vi.fn().mockImplementation((key: string, seconds: number, value: string) => {
    store.set(key, value);
    return "OK";
  }),
  del: vi.fn().mockImplementation((key: string) => {
    const existed = store.has(key);
    store.delete(key);
    return existed ? 1 : 0;
  }),
  exists: vi.fn().mockImplementation((key: string) => (store.has(key) ? 1 : 0)),
  keys: vi.fn().mockImplementation((pattern: string) => {
    const regex = new RegExp(pattern.replace("*", ".*"));
    return Array.from(store.keys()).filter((k) => regex.test(k));
  }),
  expire: vi.fn().mockResolvedValue(1),
  ttl: vi.fn().mockResolvedValue(3600),
  quit: vi.fn().mockResolvedValue("OK"),
  disconnect: vi.fn().mockResolvedValue(undefined),
};

export const createMockRedis = () => mockRedis;

export const resetRedisMocks = () => {
  store.clear();
  Object.values(mockRedis).forEach((fn) => {
    if (typeof fn.mockClear === "function") {
      fn.mockClear();
    }
  });
};

export const getRedisStore = () => new Map(store);
