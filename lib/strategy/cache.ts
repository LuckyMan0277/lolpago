// 팀 전략 캐시: 메모리 우선, 파일(JSON) 백업. dev 재시작 후에도 유지.
// 프로덕션은 Vercel KV 등으로 교체 가능 (인터페이스만 유지).

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { TeamStrategy } from "./team-schema";

const CACHE_FILE = resolve(process.cwd(), "data/cache/team-strategies.json");
// 프롬프트/스키마가 바뀌면 이 버전을 올려 기존 캐시를 무효화한다.
const CACHE_VERSION = "v2-short-win-formula";

type CacheEntry = {
  value: TeamStrategy;
  cachedAt: string; // ISO
  patch: string;
  version?: string;
};

// 인메모리 캐시 (서버 재시작 전까지 유지)
let memCache: Map<string, CacheEntry> | null = null;
let dirty = false;

const ensureLoaded = () => {
  if (memCache) return memCache;
  memCache = new Map();
  if (!existsSync(CACHE_FILE)) return memCache;
  try {
    const raw = JSON.parse(readFileSync(CACHE_FILE, "utf-8")) as Record<
      string,
      CacheEntry
    >;
    for (const [k, v] of Object.entries(raw)) {
      memCache.set(k, v);
    }
  } catch (err) {
    console.warn("[cache] failed to load, starting fresh:", err);
  }
  return memCache;
};

const persist = () => {
  if (!memCache || !dirty) return;
  try {
    mkdirSync(dirname(CACHE_FILE), { recursive: true });
    const obj: Record<string, CacheEntry> = {};
    for (const [k, v] of memCache.entries()) obj[k] = v;
    writeFileSync(CACHE_FILE, JSON.stringify(obj, null, 0), "utf-8");
    dirty = false;
  } catch (err) {
    console.warn("[cache] persist failed:", err);
  }
};

// 캐시 키: patch + 정렬된 라인:챔피언 (순서 무관, 같은 조합 = 같은 키)
export const buildCacheKey = (
  patch: string,
  picks: Array<{ championKey: string; lane: string }>,
): string => {
  const parts = picks
    .map((p) => `${p.lane}:${p.championKey}`)
    .sort()
    .join(",");
  return `${patch}|${parts}`;
};

export const getCached = (key: string, patch: string): TeamStrategy | null => {
  const cache = ensureLoaded();
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.patch !== patch) return null;
  // 캐시 버전 불일치면 무효 (프롬프트/스키마 변경 시)
  if (entry.version !== CACHE_VERSION) return null;
  return entry.value;
};

export const setCached = (
  key: string,
  patch: string,
  value: TeamStrategy,
): void => {
  const cache = ensureLoaded();
  cache.set(key, {
    value,
    patch,
    cachedAt: new Date().toISOString(),
    version: CACHE_VERSION,
  });
  dirty = true;
  persist();
};

export const cacheStats = () => {
  const cache = ensureLoaded();
  return { size: cache.size };
};
