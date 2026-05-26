import type { BrowserContext, Page } from 'playwright'
import type { Product } from '@/lib/types'
import type { Location } from '@/lib/types'
import { BaseScraper, extractProductsFromJson } from './base'

const DEFAULT_STORE_ID = '1403020'

export class SwiggyScraper extends BaseScraper {
  readonly platformId = 'swiggy' as const

  async scrape(query: string, location: Location, context: BrowserContext): Promise<Product[]> {
    const page = await context.newPage()
    try {
      return await this._scrape(page, query, location)
    } finally {
      await page.close()
    }
  }

  private async _scrape(page: Page, query: string, location: Location): Promise<Product[]> {
    const products: Product[] = []

    const unsubscribe = this.onAnyJson(page, (json) => {
      const found = extractProductsFromJson(json, 'swiggy', (o) =>
        `https://www.swiggy.com/instamart/item/${o.product_id ?? o.item_id ?? o.id ?? ''}`
      )
      found.forEach(p => { if (!products.some(x => x.id === p.id)) products.push(p) })
    })

    try {
      await this.injectLocation(
        page,
        { lat: String(location.lat), lng: String(location.lon) },
        [
          { name: 'lat', value: String(location.lat), domain: '.swiggy.com' },
          { name: 'lng', value: String(location.lon), domain: '.swiggy.com' },
        ]
      )

      const searchUrl = `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(query)}&storeId=${DEFAULT_STORE_ID}`
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {})

      await this.waitForMinProducts(products)

      if (products.length > 0) return products

      return await this.extractByPriceDOM(page, 'swiggy', searchUrl)
    } finally {
      unsubscribe()
    }
  }
}
