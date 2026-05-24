import NodeCache from 'node-cache'
import type { Product } from './types'

// Global singleton cache — survives across API requests in the same process
const cache = new NodeCache({
  stdTTL: 600,       // 10 minute default TTL
  checkperiod: 120,  // check for expired keys every 2 min
  useClones: false,  // skip cloning for performance
})

export function getCachedProducts(platform: string, query: string, pincode: string): Product[] | null {
  const key = `${platform}:${query.toLowerCase().trim()}:${pincode}`
  return cache.get<Product[]>(key) ?? null
}

export function setCachedProducts(platform: string, query: string, pincode: string, products: Product[]): void {
  // Never cache empty results — forces a re-scrape next time
  if (products.length === 0) return
  const key = `${platform}:${query.toLowerCase().trim()}:${pincode}`
  cache.set(key, products)
}

export function cacheStats() {
  return cache.getStats()
}
