import type { BrowserContext } from 'playwright'
import type { Product } from '@/lib/types'
import type { Location } from '@/lib/types'
import { BaseScraper, extractProductsFromJson } from './base'

export class BigBasketScraper extends BaseScraper {
  readonly platformId = 'bigbasket' as const
  readonly isHttpOnly = true

  async scrape(query: string, location: Location, _context: BrowserContext): Promise<Product[]> {
    const url = `https://www.bigbasket.com/listing-svc/v2/products?type=ps&slug=&q=${encodeURIComponent(query)}&storeType=bb_now&sort=relevance&page=1`
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-IN,en;q=0.9',
          'Referer': 'https://www.bigbasket.com/',
          'Origin': 'https://www.bigbasket.com',
          'Cookie': `bb_city=${location.city ?? 'Bengaluru'}; bb_pin=${location.pincode}; x_channel=BB-WEB`,
          'x-channel': 'BB-WEB',
        },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return []
      const json = await res.json()
      return extractProductsFromJson(json, 'bigbasket', (o) =>
        `https://www.bigbasket.com${o.absolute_url ?? o.link ?? `/pd/${o.id ?? o.product_id}/`}`
      )
    } catch {
      return []
    }
  }
}
