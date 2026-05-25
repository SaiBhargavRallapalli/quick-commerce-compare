import type { BrowserContext, Page } from 'playwright'
import type { Product } from '@/lib/types'
import type { Location } from '@/lib/types'
import { BaseScraper, extractProductsFromJson } from './base'

export class FlipkartMinutesScraper extends BaseScraper {
  readonly platformId = 'flipkart' as const

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
      const found = extractProductsFromJson(json, 'flipkart', (o) => {
        const handle = o.url ?? o.productUrl ?? o.handle
        return handle
          ? String(handle)
          : `https://www.flipkart.com/search?q=${encodeURIComponent(query)}&marketplace=GROCERY`
      })
      found.forEach(p => { if (!products.some(x => x.id === p.id)) products.push(p) })
    })

    try {
      const searchUrl = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}&otracker=search&marketplace=GROCERY`
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})
      await page.waitForTimeout(4000)

      await Promise.race([
        this._waitFor(products, 3),
        page.waitForTimeout(8000),
      ])

      if (products.length > 0) return products

      return await this._extractFromDOM(page, query)
    } finally {
      unsubscribe()
    }
  }

  private async _extractFromDOM(page: Page, query: string): Promise<Product[]> {
    try {
      const searchUrl = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}&marketplace=GROCERY`
      return await page.evaluate(({ pid, fallbackUrl }: { pid: string; fallbackUrl: string }) => {
        const results: { id: string; name: string; price: number; originalPrice?: number; discountPercent?: number; quantity: string; imageUrl: string; productUrl: string; platform: string; inStock: boolean }[] = []
        const seen = new Set<string>()

        const cards = document.querySelectorAll('._1AtVbE, [data-id], ._13oc-S')
        cards.forEach((card, idx) => {
          if (results.length >= 15) return
          const text = card.textContent ?? ''
          if (!text.includes('₹')) return

          const nameEl = card.querySelector('._4rR01T, .s1Q9rs, ._2WkVRV, [class*="name"], a[title]') as HTMLElement | null
          const name = (nameEl?.getAttribute('title') || nameEl?.textContent || '').trim()
          if (!name || name.length < 3) return

          const priceEl = card.querySelector('._30jeq3, ._1_WHN1, [class*="price"]') as HTMLElement | null
          const priceText = priceEl?.textContent?.replace(/[₹,\s]/g, '') ?? ''
          const price = parseFloat(priceText) || 0
          if (price <= 0) return

          const key = `${name.slice(0, 20)}-${price}`
          if (seen.has(key)) return
          seen.add(key)

          const img = (card.querySelector('img') as HTMLImageElement | null)?.src ?? ''
          const link = (card.closest('a') || card.querySelector('a')) as HTMLAnchorElement | null
          const mrpEl = card.querySelector('._3I9_wc, del') as HTMLElement | null
          const mrp = parseFloat(mrpEl?.textContent?.replace(/[₹,\s]/g, '') ?? '0') || 0

          results.push({
            id: `${pid}-fk${idx}`,
            name,
            price,
            originalPrice: mrp > price ? mrp : undefined,
            discountPercent: mrp > price ? Math.round(((mrp - price) / mrp) * 100) : undefined,
            quantity: '',
            imageUrl: img,
            productUrl: link?.href || fallbackUrl,
            platform: pid,
            inStock: !text.toLowerCase().includes('out of stock'),
          })
        })

        return results
      }, { pid: 'flipkart', fallbackUrl: searchUrl }) as Product[]
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
