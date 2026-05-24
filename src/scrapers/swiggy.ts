import type { BrowserContext, Page } from 'playwright'
import type { Product } from '@/lib/types'
import type { Location } from '@/lib/types'
import { BaseScraper, extractProductsFromJson } from './base'

export class SwiggyScraper extends BaseScraper {
  readonly platformId = 'swiggy' as const

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
    let capturedStoreId: string | null = null

    // Capture all JSON that looks like products
    const unsubscribe = this.onAnyJson(page, (json, url) => {
      // Capture the storeId from the home API
      if (url.includes('/instamart/home/') || url.includes('/instamart/home/v')) {
        const body = JSON.stringify(json)
        const m = body.match(/"storeId"\s*:\s*"?(\d+)"?/)
        if (m) capturedStoreId = m[1]
      }

      const found = extractProductsFromJson(json, 'swiggy', (o) =>
        `https://www.swiggy.com/instamart/item/${o.product_id ?? o.item_id ?? o.id ?? ''}`
      )
      found.forEach(p => { if (!products.some(x => x.id === p.id)) products.push(p) })
    })

    try {
      // Step 1: Set location data
      await page.context().addCookies([
        { name: 'lat', value: String(location.lat), domain: '.swiggy.com', path: '/' },
        { name: 'lng', value: String(location.lon), domain: '.swiggy.com', path: '/' },
      ])

      // Step 2: Load homepage to get storeId
      await page.goto('https://www.swiggy.com/instamart', {
        waitUntil: 'domcontentloaded', timeout: 15000
      })
      await page.waitForTimeout(3000) // let home/v2 API fire

      // Step 3: Navigate to search (now that storeId is loaded in session)
      const searchUrl = capturedStoreId
        ? `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(query)}&storeId=${capturedStoreId}`
        : `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(query)}`

      // Swiggy SPA may abort the navigation internally — catch and continue waiting for API calls
      await page.goto(searchUrl, { waitUntil: 'commit', timeout: 20000 }).catch(() => {})

      // Give the SPA time to fire search API calls even if navigation was aborted
      await page.waitForTimeout(2000)

      await Promise.race([
        this._waitFor(products, 3),
        page.waitForTimeout(12000),
      ])

      if (products.length > 0) return products

      // Try direct search API if we have a storeId
      if (capturedStoreId) {
        const directProducts = await this._directSearchAPI(capturedStoreId, query)
        if (directProducts.length > 0) return directProducts
      }

      return await this.extractByPriceDOM(page, 'swiggy', searchUrl)
    } finally {
      unsubscribe()
    }
  }

  private async _directSearchAPI(storeId: string, query: string): Promise<Product[]> {
    // Swiggy Instamart search API (discovered from network analysis)
    const url = `https://www.swiggy.com/api/instamart/search?query=${encodeURIComponent(query)}&storeId=${storeId}&primaryStoreId=${storeId}&offset=0`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/json, */*',
        Referer: 'https://www.swiggy.com/instamart',
        Cookie: 'swiggyUserHasLoggedIn=false',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const json = await res.json()
    return extractProductsFromJson(json, 'swiggy', (o) =>
      `https://www.swiggy.com/instamart/item/${o.product_id ?? o.item_id ?? o.id ?? ''}`
    )
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
