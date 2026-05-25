import type { BrowserContext, Page } from 'playwright'
import type { Product } from '@/lib/types'
import type { Location } from '@/lib/types'
import { BaseScraper, extractProductsFromJson } from './base'

export class BigBasketScraper extends BaseScraper {
  readonly platformId = 'bigbasket' as const

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
      const found = extractProductsFromJson(json, 'bigbasket', (o) =>
        `https://www.bigbasket.com${o.absolute_url ?? o.link ?? `/pd/${o.id ?? o.product_id}/`}`
      )
      found.forEach(p => { if (!products.some(x => x.id === p.id)) products.push(p) })
    })

    try {
      // Set location cookies before navigation
      await page.context().addCookies([
        { name: 'bb_city', value: location.city ?? 'Bengaluru', domain: '.bigbasket.com', path: '/' },
        { name: 'bb_pin', value: location.pincode, domain: '.bigbasket.com', path: '/' },
        { name: 'x_channel', value: 'BB-WEB', domain: '.bigbasket.com', path: '/' },
      ])

      // Step 1: Load BigBasket homepage to establish a real session
      // This sets additional cookies including the lat-long cookie required by their API
      await page.goto('https://www.bigbasket.com/', {
        waitUntil: 'domcontentloaded', timeout: 20000
      }).catch(() => {})
      await page.waitForTimeout(2000)

      // Step 2: Try API call with cookies captured from the browser session
      const bbCookies = await page.context().cookies(['https://www.bigbasket.com'])
      const cookieStr = bbCookies.map(c => `${c.name}=${c.value}`).join('; ')
      const apiProducts = await this._listingAPI(query, cookieStr)
      if (apiProducts.length > 0) return apiProducts

      // Step 3: Navigate to search page (may be blocked but worth trying)
      await page.goto(
        `https://www.bigbasket.com/ps/?q=${encodeURIComponent(query)}`,
        { waitUntil: 'domcontentloaded', timeout: 20000 }
      ).catch(() => {})

      await Promise.race([
        this._waitFor(products, 3),
        page.waitForTimeout(10000),
      ])

      if (products.length > 0) return products

      // Step 4: Try __NEXT_DATA__ (in case they've moved to Next.js)
      const nextDataProducts = await this._extractNextData(page)
      if (nextDataProducts.length > 0) return nextDataProducts

      return await this.extractByPriceDOM(
        page, 'bigbasket',
        `https://www.bigbasket.com/ps/?q=${encodeURIComponent(query)}`
      )
    } finally {
      unsubscribe()
    }
  }

  private async _listingAPI(query: string, cookies: string): Promise<Product[]> {
    const url = `https://www.bigbasket.com/listing-svc/v2/products?type=ps&slug=&q=${encodeURIComponent(query)}&storeType=bb_now&sort=relevance&page=1`
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Cookie': cookies,
          'x-channel': 'BB-WEB',
          'Referer': 'https://www.bigbasket.com/',
          'Origin': 'https://www.bigbasket.com',
        },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return []
      const json = await res.json()
      return extractProductsFromJson(json, 'bigbasket', (o) =>
        `https://www.bigbasket.com${o.absolute_url ?? `/pd/${o.id ?? o.product_id}/`}`
      )
    } catch {
      return []
    }
  }

  private async _extractNextData(page: Page): Promise<Product[]> {
    try {
      const raw = await page.$eval('#__NEXT_DATA__', el => el.textContent ?? '')
      if (!raw) return []
      return extractProductsFromJson(
        JSON.parse(raw),
        'bigbasket',
        (o) => `https://www.bigbasket.com${o.absolute_url ?? `/pd/${o.id ?? o.product_id}/`}`
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
