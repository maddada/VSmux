const CACHE_KEY = "convo-viewer-cache";

interface CacheEntry {
  path: string;
  folder: string;
  name: string;
  size: number;
  lastModified: number;
  summary: string;
}

interface CacheData {
  entries: Record<string, CacheEntry>;
}

function getCacheData(): CacheData {
  try {
    const data = localStorage.getItem(CACHE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch {
    // Invalid cache, return empty
  }
  return { entries: {} };
}

function saveCacheData(data: CacheData): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // localStorage might be full, clear old entries
    clearCache();
  }
}

function getCacheKey(path: string, size: number, lastModified: number): string {
  return `${path}:${size}:${lastModified}`;
}

export function getCachedFile(
  path: string,
  size: number,
  lastModified: number,
): { summary: string } | null {
  const cache = getCacheData();
  const key = getCacheKey(path, size, lastModified);
  const entry = cache.entries[key];

  if (entry) {
    return { summary: entry.summary };
  }

  return null;
}

export function cacheFile(
  path: string,
  folder: string,
  name: string,
  size: number,
  lastModified: number,
  summary: string,
): void {
  const cache = getCacheData();
  const key = getCacheKey(path, size, lastModified);

  cache.entries[key] = {
    path,
    folder,
    name,
    size,
    lastModified,
    summary,
  };

  saveCacheData(cache);
}

export function clearCache(): void {
  localStorage.removeItem(CACHE_KEY);
}
