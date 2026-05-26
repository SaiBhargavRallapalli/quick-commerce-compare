import type { BrowserContext, Page } from 'playwright'
import type { Product } from '@/lib/types'
import type { Location } from '@/lib/types'
import { BaseScraper, extractProductsFromJson } from './base'

export class FirstClubScraper extends BaseScraper {
  readonly platformId = 'firstclub' as const

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
      const found = extractProductsFromJson(json, 'firstclub', (o) =>
        o.url
          ? String(o.url)
          : `https://www.firstclub.io/products/${o.handle ?? o.id ?? ''}`
      )
      found.forEach(p => { if (!products.some(x => x.id === p.id)) products.push(p) })
    })

    try {
      const searchUrl = `https://www.firstclub.io/search?type=product&q=${encodeURIComponent(query)}`
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})

      const inlineProducts = await this._extractShopifyJson(page)
      inlineProducts.forEach(p => { if (!products.some(x => x.id === p.id)) products.push(p) })

      await this.waitForMinProducts(products)

      if (products.length > 0) return products

      return await this.extractByPriceDOM(page, 'firstclub', searchUrl)
    } finally {
      unsubscribe()
    }
  }

  private async _extractShopifyJson(page: Page): Promise<Product[]> {
    try {
      const rawBlocks = await page.$$eval(
        'script[type="application/json"], script[data-product-json]',
        els => els.map(el => el.textContent ?? '')
      )
      const products: Product[] = []
      for (const raw of rawBlocks) {
        try {
          const json = JSON.parse(raw)
          const found = extractProductsFromJson(json, 'firstclub', (o) =>
            o.url ? String(o.url) : `https://www.firstclub.io/products/${o.handle ?? o.id ?? ''}`
          )
          found.forEach(p => { if (!products.some(x => x.id === p.id)) products.push(p) })
        } catch { /* skip invalid JSON */ }
      }
      return products
    } catch {
      return []
    }
  }
}
