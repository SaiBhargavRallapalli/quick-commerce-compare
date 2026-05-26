import type { BrowserContext, Page } from 'playwright'
import type { Product } from '@/lib/types'
import type { Location } from '@/lib/types'
import { BaseScraper, extractProductsFromJson } from './base'

export class BigBasketScraper extends BaseScraper {
  readonly platformId = 'bigbasket' as const

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

    const unsubscribe = this.onAnyJson(page, (json) => {
      const found = extractProductsFromJson(json, 'bigbasket', (o) =>
        `https://www.bigbasket.com${o.absolute_url ?? o.link ?? `/pd/${o.id ?? o.product_id}/`}`
      )
      found.forEach(p => { if (!products.some(x => x.id === p.id)) products.push(p) })
    })

    try {
      await page.context().addCookies([
        { name: 'bb_city', value: location.city ?? 'Bengaluru', domain: '.bigbasket.com', path: '/' },
        { name: 'bb_pin', value: location.pincode, domain: '.bigbasket.com', path: '/' },
        { name: 'x_channel', value: 'BB-WEB', domain: '.bigbasket.com', path: '/' },
      ])

      // Minimal session bootstrap (commit is faster than full DOM)
      await page.goto('https://www.bigbasket.com/', {
        waitUntil: 'commit',
        timeout: 12000,
      }).catch(() => {})

      const bbCookies = await page.context().cookies(['https://www.bigbasket.com'])
      const cookieStr = bbCookies.map(c => `${c.name}=${c.value}`).join('; ')
      const apiProducts = await this._listingAPI(query, cookieStr)
      if (apiProducts.length > 0) return apiProducts

      await page.goto(
        `https://www.bigbasket.com/ps/?q=${encodeURIComponent(query)}`,
        { waitUntil: 'domcontentloaded', timeout: 15000 }
      ).catch(() => {})

      await this.waitForMinProducts(products)

      if (products.length > 0) return products

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
}
