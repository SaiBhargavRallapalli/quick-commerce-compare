import pLimit from 'p-limit'
import type { PlatformResult, PlatformId } from '@/lib/types'
import type { Location } from '@/lib/types'
import type { BrowserContext } from 'playwright'
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
import { FlipkartMinutesScraper } from './flipkart-minutes'
import { AmazonNowScraper } from './amazon-now'

const SCRAPERS = [
  new BlinkitScraper(),
  new ZeptoScraper(),
  new SwiggyScraper(),
  new BigBasketScraper(),
  new JioMartScraper(),
  new DmartScraper(),
  new FirstClubScraper(),
  new FlipkartMinutesScraper(),
  new AmazonNowScraper(),
]

// Max 5 concurrent Playwright pages (balance speed vs memory)
const browserLimit = pLimit(5)
const noLimit = pLimit(Infinity)

type Tagged = { result: PlatformResult; idx: number }

function makeTask(
  scraper: (typeof SCRAPERS)[number],
  idx: number,
  query: string,
  location: Location,
  getContext: () => Promise<BrowserContext>
): Promise<Tagged> {
  // HTTP-only scrapers run immediately with no concurrency cap
  const queue = scraper.isHttpOnly ? noLimit : browserLimit

  return queue(async (): Promise<Tagged> => {
    const startMs = Date.now()
    const platform = scraper.platformId as PlatformId

    const cached = getCachedProducts(platform, query, location.pincode)
    if (cached) {
      return { result: { platform, products: cached, status: 'success', durationMs: 0 }, idx }
    }

    try {
      const context = scraper.isHttpOnly
        ? ({} as BrowserContext)
        : await getContext()

      const products = await Promise.race([
        scraper.scrape(query, location, context),
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
}

/**
 * Run all scrapers in parallel and yield results as each one finishes.
 * HTTP-only scrapers start immediately without waiting for the browser.
 * Playwright scrapers share one lazily-initialized browser context.
 */
export async function* searchAllPlatforms(
  query: string,
  location: Location
): AsyncGenerator<PlatformResult> {
  let browserContext: BrowserContext | undefined
  let browserPromise: Promise<BrowserContext> | undefined

  const getContext = (): Promise<BrowserContext> => {
    if (browserContext !== undefined) return Promise.resolve(browserContext)
    if (browserPromise === undefined) {
      browserPromise = createContext(location.lat, location.lon).then(ctx => {
        browserContext = ctx
        return ctx
      })
    }
    return browserPromise
  }

  // Start browser warmup in background — HTTP scrapers don't wait for it
  getContext().catch(() => {})

  const tasks = SCRAPERS.map((scraper, idx) =>
    makeTask(scraper, idx, query, location, getContext)
  )

  try {
    const pending = new Map(tasks.map((t, i) => [i, t]))

    while (pending.size > 0) {
      const { result, idx } = await Promise.race(pending.values())
      pending.delete(idx)
      yield result
    }
  } finally {
    if (browserContext !== undefined) {
      await browserContext.close().catch(() => {})
    }
  }
}
