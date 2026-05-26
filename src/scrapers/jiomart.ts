import type { BrowserContext, Page } from 'playwright'
import type { Product } from '@/lib/types'
import type { Location } from '@/lib/types'
import { BaseScraper, extractProductsFromJson } from './base'

export class JioMartScraper extends BaseScraper {
  readonly platformId = 'jiomart' as const

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
      const found = extractProductsFromJson(json, 'jiomart', (o) =>
        `https://www.jiomart.com${o.url_key ? '/' + String(o.url_key) : o.slug ? '/' + String(o.slug) : ''}`
      )
      found.forEach(p => { if (!products.some(x => x.id === p.id)) products.push(p) })
    })

    try {
      await page.context().addCookies([
        { name: 'pinCode', value: location.pincode, domain: '.jiomart.com', path: '/' },
        { name: 'latitude', value: String(location.lat), domain: '.jiomart.com', path: '/' },
        { name: 'longitude', value: String(location.lon), domain: '.jiomart.com', path: '/' },
      ])

      const searchUrl = `https://www.jiomart.com/search?q=${encodeURIComponent(query)}`
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})

      await this.waitForMinProducts(products)

      if (products.length > 0) return products

      return await this.extractByPriceDOM(page, 'jiomart', searchUrl)
    } finally {
      unsubscribe()
    }
  }
}
