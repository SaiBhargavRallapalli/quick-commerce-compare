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

    const unsubscribe = this.onAnyJson(page, (json, url) => {
      // Capture storeId from home API request URL
      if (url.includes('/instamart/home')) {
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

      // Step 1: Load homepage — fires home/v2 API which contains storeId in URL params
      await page.goto('https://www.swiggy.com/instamart', {
        waitUntil: 'domcontentloaded', timeout: 20000
      }).catch(() => {})
      await page.waitForTimeout(5000)

      // Step 2: Inject storeId into localStorage so search page picks it up
      if (capturedStoreId) {
        await page.evaluate((sid) => {
          try {
            localStorage.setItem('storeId', sid)
            localStorage.setItem('primaryStoreId', sid)
          } catch { /* ignore */ }
        }, capturedStoreId)
      }

      // Step 3: Use in-browser fetch (has all session cookies + WAF tokens)
      const sid = capturedStoreId || '1403020'
      const inBrowserProducts = await this._inBrowserSearch(page, query, sid)
      if (inBrowserProducts.length > 0) return inBrowserProducts

      // Step 4: Try pushState navigation to trigger the SPA search component
      await page.evaluate((params: { q: string; sid: string }) => {
        window.history.pushState({}, '', `/instamart/search?query=${encodeURIComponent(params.q)}&storeId=${params.sid}`)
        window.dispatchEvent(new PopStateEvent('popstate', { state: {} }))
      }, { q: query, sid })
      await page.waitForTimeout(3000)

      await Promise.race([
        this._waitFor(products, 3),
        page.waitForTimeout(8000),
      ])

      if (products.length > 0) return products

      // Step 5: Direct URL navigation (ERR_ABORTED is ok — SPA may still render)
      const searchUrl = `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(query)}&storeId=${sid}`
      await page.goto(searchUrl, { waitUntil: 'commit', timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(4000)

      await Promise.race([
        this._waitFor(products, 3),
        page.waitForTimeout(8000),
      ])

      if (products.length > 0) return products

      return await this.extractByPriceDOM(page, 'swiggy', searchUrl)
    } finally {
      unsubscribe()
    }
  }

  /**
   * Execute the search API from within the browser context — this way the page's
   * own cookies (including WAF session tokens) are automatically included.
   */
  private async _inBrowserSearch(page: Page, query: string, storeId: string): Promise<Product[]> {
    try {
      const json = await page.evaluate(async ({ q, sid }: { q: string; sid: string }) => {
        const url = `/api/instamart/search/v2?offset=0&query=${encodeURIComponent(q)}&storeId=${sid}&primaryStoreId=${sid}&ageConsent=false`
        try {
          const res = await fetch(url, {
            headers: { 'Accept': 'application/json', 'x-device-id': 'web' },
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

  private _waitFor(arr: Product[], min: number): Promise<void> {
    return new Promise(resolve => {
      const iv = setInterval(() => {
        if (arr.length >= min) { clearInterval(iv); resolve() }
      }, 300)
      setTimeout(() => { clearInterval(iv); resolve() }, 12000)
    })
  }
}
