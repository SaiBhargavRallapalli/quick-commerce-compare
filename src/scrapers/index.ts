import pLimit from 'p-limit'
import type { PlatformResult, PlatformId } from '@/lib/types'
import type { Location } from '@/lib/types'
import { createContext } from '@/lib/browser'
import { getCachedProducts, setCachedProducts } from '@/lib/cache'
import { SCRAPE_TIMEOUT } from './base'
import { BlinkitScraper } from './blinkit'
import { ZeptoScraper } from './zepto'
import { BigBasketScraper } from './bigbasket'
import { SwiggyScraper } from './swiggy'
import { JioMartScraper } from './jiomart'
import { DmartScraper } from './dmart'
import { FirstClubScraper } from './firstclub'

const SCRAPERS = [
  new BlinkitScraper(),
  new ZeptoScraper(),
  new SwiggyScraper(),
  new BigBasketScraper(),
  new JioMartScraper(),
  new DmartScraper(),
  new FirstClubScraper(),
]

// Max 3 concurrent Playwright pages to avoid OOM
const limit = pLimit(3)

/**
 * Run all scrapers in parallel and yield results as each one finishes.
 */
export async function* searchAllPlatforms(
  query: string,
  location: Location
): AsyncGenerator<PlatformResult> {
  const browserContext = await createContext(location.lat, location.lon)

  try {
    type Tagged = { result: PlatformResult; idx: number }

    // Build individual task promises (each resolves to { result, idx })
    const tasks: Promise<Tagged>[] = SCRAPERS.map((scraper, idx) =>
      limit(async (): Promise<Tagged> => {
        const startMs = Date.now()
        const platform = scraper.platformId as PlatformId

        // Cache hit
        const cached = getCachedProducts(platform, query, location.pincode)
        if (cached) {
          return { result: { platform, products: cached, status: 'success', durationMs: 0 }, idx }
        }

        try {
          const products = await Promise.race([
            scraper.scrape(query, location, browserContext),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), SCRAPE_TIMEOUT)
            ),
          ])

          setCachedProducts(platform, query, location.pincode, products)

          return {
            result: { platform, products, status: 'success', durationMs: Date.now() - startMs },
            idx,
          }
        } catch (err) {
          const error = err instanceof Error ? err.message : 'Unknown error'
          return {
            result: {
              platform,
              products: [],
              status: error === 'Timeout' ? 'timeout' : 'error',
              error,
              durationMs: Date.now() - startMs,
            },
            idx,
          }
        }
      })
    )

    // Yield as each task completes using a racing dequeue pattern
    const pending = new Map(tasks.map((t, i) => [i, t]))

    while (pending.size > 0) {
      // Race all remaining tasks
      const { result, idx } = await Promise.race(pending.values())
      pending.delete(idx)
      yield result
    }
  } finally {
    await browserContext.close()
  }
}
