import type { BrowserContext, Page } from 'playwright'
import type { Product } from '@/lib/types'
import type { Location } from '@/lib/types'
import { BaseScraper, extractProductsFromJson } from './base'

export class FirstClubScraper extends BaseScraper {
  readonly platformId = 'firstclub' as const

  async scrape(query: string, location: Location, context: BrowserContext): Promise<Product[]> {
    const page = await context.newPage()
    try {
      await this.blockHeavyResources(page)
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
      // Shopify stores use /search?type=product&q=... for filtered product search
      const searchUrls = [
        `https://www.firstclub.io/search?type=product&q=${encodeURIComponent(query)}`,
        `https://www.firstclub.io/search?q=${encodeURIComponent(query)}`,
      ]

      for (const url of searchUrls) {
        if (products.length >= 3) break
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
        await page.waitForTimeout(2500)

        // Shopify renders search results inline — try Liquid-rendered JSON script
        const inlineProducts = await this._extractShopifyJson(page)
        inlineProducts.forEach(p => { if (!products.some(x => x.id === p.id)) products.push(p) })
        if (products.length >= 3) break
      }

      await Promise.race([
        this._waitFor(products, 3),
        page.waitForTimeout(6000),
      ])

      if (products.length > 0) return products

      return await this.extractByPriceDOM(page, 'firstclub', `https://www.firstclub.io/search?type=product&q=${encodeURIComponent(query)}`)
    } finally {
      unsubscribe()
    }
  }

  private async _extractShopifyJson(page: Page): Promise<Product[]> {
    try {
      // Shopify themes often embed product JSON in <script type="application/json"> blocks
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

  private _waitFor(arr: Product[], min: number): Promise<void> {
    return new Promise(resolve => {
      const iv = setInterval(() => {
        if (arr.length >= min) { clearInterval(iv); resolve() }
      }, 300)
      setTimeout(() => { clearInterval(iv); resolve() }, 10000)
    })
  }
}
