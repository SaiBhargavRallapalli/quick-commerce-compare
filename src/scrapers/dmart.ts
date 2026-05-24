import type { BrowserContext, Page } from 'playwright'
import type { Product } from '@/lib/types'
import type { Location } from '@/lib/types'
import { BaseScraper, extractProductsFromJson } from './base'

// DMart serves by store — storeId 10151 covers most metros; Playwright fallback will capture the correct one
const DEFAULT_STORE_ID = '10151'

export class DmartScraper extends BaseScraper {
  readonly platformId = 'dmart' as const

  async scrape(query: string, location: Location, context: BrowserContext): Promise<Product[]> {
    try {
      const products = await this._directAPI(query)
      if (products.length > 0) return products
    } catch { /* fall through */ }

    const page = await context.newPage()
    try {
      await this.blockHeavyResources(page)
      return await this._scrapePlaywright(page, query, location)
    } finally {
      await page.close()
    }
  }

  private async _directAPI(query: string): Promise<Product[]> {
    const q = encodeURIComponent(query)

    // digital.dmart.in is the actual API host; try several known endpoint patterns
    const endpoints = [
      `https://digital.dmart.in/api/v1/listing?q=${q}&storeId=${DEFAULT_STORE_ID}&pageNo=0&size=24&channel=WEB`,
      `https://digital.dmart.in/api/v1/search?q=${q}&storeId=${DEFAULT_STORE_ID}&page=0&size=24`,
      `https://digital.dmart.in/api/v1/search/searchProducts?q=${q}&storeId=${DEFAULT_STORE_ID}&pageNo=1&size=24`,
    ]

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json, */*',
      'Referer': 'https://www.dmart.in/',
      'Origin': 'https://www.dmart.in',
    }

    for (const url of endpoints) {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) })
      if (!res.ok) continue
      const json = await res.json()
      const products = extractProductsFromJson(json, 'dmart', (o) =>
        `https://www.dmart.in${o.urlPath ?? `/product/${o.uniqueId ?? o.id ?? ''}`}`
      )
      if (products.length > 0) return products
    }
    return []
  }

  private async _scrapePlaywright(page: Page, query: string, location: Location): Promise<Product[]> {
    const products: Product[] = []

    const unsubscribe = this.onAnyJson(page, (json) => {
      const found = extractProductsFromJson(json, 'dmart', (o) =>
        `https://www.dmart.in${o.urlPath ?? `/product/${o.uniqueId ?? o.id ?? ''}`}`
      )
      found.forEach(p => { if (!products.some(x => x.id === p.id)) products.push(p) })
    })

    try {
      await page.context().addCookies([
        { name: 'pinCode', value: location.pincode, domain: '.dmart.in', path: '/' },
        { name: 'userPincode', value: location.pincode, domain: '.dmart.in', path: '/' },
      ])

      // Load homepage to pick up storeId cookies, then search
      await page.goto('https://www.dmart.in/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(2000)

      await page.goto(
        `https://www.dmart.in/search?q=${encodeURIComponent(query)}`,
        { waitUntil: 'domcontentloaded', timeout: 20000 }
      ).catch(() => {})

      await Promise.race([
        this._waitFor(products, 3),
        page.waitForTimeout(12000),
      ])

      if (products.length > 0) return products

      return await this.extractByPriceDOM(page, 'dmart', `https://www.dmart.in/search?q=${encodeURIComponent(query)}`)
    } finally {
      unsubscribe()
    }
  }

  private _waitFor(arr: Product[], min: number): Promise<void> {
    return new Promise(resolve => {
      const iv = setInterval(() => {
        if (arr.length >= min) { clearInterval(iv); resolve() }
      }, 300)
      setTimeout(() => { clearInterval(iv); resolve() }, 12000)
    })
  }
}
