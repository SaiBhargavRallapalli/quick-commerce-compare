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
    let capturedStoreId: string | null = null

    const unsubscribe = this.onAnyJson(page, (json, url) => {
      if (!capturedStoreId && url.includes('storeId=')) {
        const m = url.match(/storeId=(\d+)/)
        if (m) capturedStoreId = m[1]
      }

      const found = extractProductsFromJson(json, 'swiggy', (o) =>
        `https://www.swiggy.com/instamart/item/${o.product_id ?? o.item_id ?? o.id ?? ''}`
      )
      found.forEach(p => { if (!products.some(x => x.id === p.id)) products.push(p) })
    })

    try {
      await page.context().addCookies([
        { name: 'lat', value: String(location.lat), domain: '.swiggy.com', path: '/' },
        { name: 'lng', value: String(location.lon), domain: '.swiggy.com', path: '/' },
      ])

      const storeIdPromise = page.waitForResponse(
        res => res.ok() && res.url().includes('/instamart/home'),
        { timeout: 8000 }
      ).then(res => {
        const m = res.url().match(/storeId=(\d+)/)
        return m?.[1] ?? null
      }).catch(() => null)

      await page.goto('https://www.swiggy.com/instamart', {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      }).catch(() => {})

      const sid = (await storeIdPromise) ?? capturedStoreId ?? DEFAULT_STORE_ID

      if (sid !== DEFAULT_STORE_ID) {
        await page.evaluate((storeId) => {
          try {
            localStorage.setItem('storeId', storeId)
            localStorage.setItem('primaryStoreId', storeId)
          } catch { /* ignore */ }
        }, sid)
      }

      const inBrowserProducts = await this._inBrowserSearch(page, query, sid)
      if (inBrowserProducts.length > 0) return inBrowserProducts

      const searchUrl = `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(query)}&storeId=${sid}`
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})

      await this.waitForMinProducts(products)

      if (products.length > 0) return products

      return await this.extractByPriceDOM(page, 'swiggy', searchUrl)
    } finally {
      unsubscribe()
    }
  }

  private async _inBrowserSearch(page: Page, query: string, storeId: string): Promise<Product[]> {
    try {
      const json = await page.evaluate(async ({ q, sid }: { q: string; sid: string }) => {
        const url = `/api/instamart/search/v2?offset=0&query=${encodeURIComponent(q)}&storeId=${sid}&primaryStoreId=${sid}&ageConsent=false`
        try {
          const res = await fetch(url, {
            headers: { Accept: 'application/json', 'x-device-id': 'web' },
            credentials: 'include',
          })
          if (!res.ok) return null
          return await res.json()
        } catch {
          return null
        }
      }, { q: query, sid: storeId }) as unknown

      if (!json) return []
      return extractProductsFromJson(json, 'swiggy', (o) =>
        `https://www.swiggy.com/instamart/item/${o.product_id ?? o.item_id ?? o.id ?? ''}`
      )
    } catch {
      return []
    }
  }
}
