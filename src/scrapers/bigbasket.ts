import type { BrowserContext, Page } from 'playwright'
import type { Product } from '@/lib/types'
import type { Location } from '@/lib/types'
import { BaseScraper, extractProductsFromJson } from './base'

export class BigBasketScraper extends BaseScraper {
  readonly platformId = 'bigbasket' as const

  async scrape(query: string, location: Location, context: BrowserContext): Promise<Product[]> {
    // Try direct listing API (avoids Playwright bot detection)
    try {
      const products = await this._listingAPI(query, location)
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

  private async _listingAPI(query: string, location: Location): Promise<Product[]> {
    const city = location.city ?? 'Bengaluru'
    const pin = location.pincode
    const q = encodeURIComponent(query)

    // BigBasket listing service — accessible with city+pin cookies
    const endpoints = [
      `https://www.bigbasket.com/listing-svc/v2/products?type=ps&slug=&q=${q}&storeType=bb_now&sort=relevance&page=1&p_type=all`,
      `https://www.bigbasket.com/product/v2/listing/?slug=&type=ps&q=${q}&storeType=bb_now&sort=relevance`,
    ]

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-IN,en;q=0.9',
      'Cookie': `bb_city=${city}; bb_pin=${pin}; x_channel=BB-WEB`,
      'x-channel': 'BB-WEB',
      'Referer': 'https://www.bigbasket.com/',
      'Origin': 'https://www.bigbasket.com',
    }

    for (const url of endpoints) {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) })
      if (!res.ok) continue
      const json = await res.json()
      const products = extractProductsFromJson(json, 'bigbasket', (o) =>
        `https://www.bigbasket.com${o.absolute_url ?? `/pd/${o.id ?? o.product_id}/`}`
      )
      if (products.length > 0) return products
    }
    return []
  }

  private async _scrapePlaywright(page: Page, query: string, location: Location): Promise<Product[]> {
    const products: Product[] = []

    const unsubscribe = this.onAnyJson(page, (json) => {
      const found = extractProductsFromJson(json, 'bigbasket', (o) =>
        `https://www.bigbasket.com${o.absolute_url ?? `/pd/${o.id ?? o.product_id}/`}`
      )
      found.forEach(p => { if (!products.some(x => x.id === p.id)) products.push(p) })
    })

    try {
      await page.context().addCookies([
        { name: 'bb_city', value: location.city ?? 'Bengaluru', domain: '.bigbasket.com', path: '/' },
        { name: 'bb_pin', value: location.pincode, domain: '.bigbasket.com', path: '/' },
        { name: 'x_channel', value: 'BB-WEB', domain: '.bigbasket.com', path: '/' },
      ])

      // Go to homepage first to establish session, then search
      await page.goto('https://www.bigbasket.com/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(1500)

      await page.goto(
        `https://www.bigbasket.com/ps/?q=${encodeURIComponent(query)}`,
        { waitUntil: 'domcontentloaded', timeout: 20000 }
      ).catch(() => {})

      // Also check __NEXT_DATA__ if present
      const nextDataProducts = await this._extractNextData(page)
      if (nextDataProducts.length > 0) return nextDataProducts

      await Promise.race([
        this._waitFor(products, 3),
        page.waitForTimeout(10000),
      ])

      if (products.length > 0) return products

      return await this.extractByPriceDOM(page, 'bigbasket', `https://www.bigbasket.com/ps/?q=${encodeURIComponent(query)}`)
    } finally {
      unsubscribe()
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
