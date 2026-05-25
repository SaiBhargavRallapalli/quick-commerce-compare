import NodeCache from 'node-cache'
import type { Product } from './types'

// In-process cache — works on long-lived servers and local dev.
// On Vercel serverless, each cold start gets a fresh cache.
// To persist across invocations on Vercel, set REDIS_URL in env vars (Upstash/Vercel KV).
const memCache = new NodeCache({
  stdTTL: 600,       // 10 minute default TTL
  checkperiod: 120,
  useClones: false,
})

function cacheKey(platform: string, query: string, pincode: string): string {
  return `${platform}:${query.toLowerCase().trim()}:${pincode}`
}

export function getCachedProducts(platform: string, query: string, pincode: string): Product[] | null {
  return memCache.get<Product[]>(cacheKey(platform, query, pincode)) ?? null
}

export function setCachedProducts(platform: string, query: string, pincode: string, products: Product[]): void {
  if (products.length === 0) return  // never cache empty results
  memCache.set(cacheKey(platform, query, pincode), products)
}

export function cacheStats() {
  return memCache.getStats()
}
