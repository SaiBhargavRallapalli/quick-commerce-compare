import type { BrowserContext, Page } from 'playwright'
import type { Product } from '@/lib/types'
import type { Location } from '@/lib/types'
import { BaseScraper, extractProductsFromJson } from './base'

export class JioMartScraper extends BaseScraper {
  readonly platformId = 'jiomart' as const

  async scrape(query: string, location: Location, context: BrowserContext): Promise<Product[]> {
    const page = await context.newPage()
    try {
      await this.blockHeavyResources(page)
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

      // Step 1: Load homepage to establish session + cookies
      await page.goto('https://www.jiomart.com/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(2000)

      // Step 2: Try search with query param (most SPAs support this)
      const searchUrls = [
        `https://www.jiomart.com/search?q=${encodeURIComponent(query)}`,
        `https://www.jiomart.com/search#${encodeURIComponent(query)}`,
        `https://www.jiomart.com/catalogsearch/result/?q=${encodeURIComponent(query)}`,
      ]

      for (const url of searchUrls) {
        if (products.length >= 3) break
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
        await page.waitForTimeout(3000)
      }

      await Promise.race([
        this._waitFor(products, 3),
        page.waitForTimeout(8000),
      ])

      if (products.length > 0) return products

      return await this.extractByPriceDOM(page, 'jiomart', `https://www.jiomart.com/search?q=${encodeURIComponent(query)}`)
    } finally {
      unsubscribe()
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
