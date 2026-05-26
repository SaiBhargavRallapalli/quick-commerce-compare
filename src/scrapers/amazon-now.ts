import type { BrowserContext, Page } from 'playwright'
import type { Product } from '@/lib/types'
import type { Location } from '@/lib/types'
import { BaseScraper, extractProductsFromJson } from './base'

export class AmazonNowScraper extends BaseScraper {
  readonly platformId = 'amazon' as const

  async scrape(query: string, location: Location, context: BrowserContext): Promise<Product[]> {
    const page = await context.newPage()
    try {
      return await this._scrape(page, query, location)
    } finally {
      await page.close()
    }
  }

  private async _scrape(page: Page, query: string, _location: Location): Promise<Product[]> {
    const products: Product[] = []

    const unsubscribe = this.onAnyJson(page, (json) => {
      const found = extractProductsFromJson(json, 'amazon', (o) =>
        o.url
          ? String(o.url)
          : `https://www.amazon.in/dp/${o.asin ?? o.id ?? ''}`
      )
      found.forEach(p => { if (!products.some(x => x.id === p.id)) products.push(p) })
    })

    try {
      await page.context().addCookies([
        { name: 'i18n-prefs', value: 'INR', domain: '.amazon.in', path: '/' },
        { name: 'lc-acbin', value: 'en_IN', domain: '.amazon.in', path: '/' },
      ])

      const searchUrl = `https://www.amazon.in/s?k=${encodeURIComponent(query)}&i=now&ref=nb_sb_noss`
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})

      await this.waitForMinProducts(products)

      if (products.length > 0) return products

      return await this.extractByPriceDOM(page, 'amazon', searchUrl)
    } finally {
      unsubscribe()
    }
  }
}
