import type { BrowserContext, Page, Route } from 'playwright'
import type { Product, PlatformId } from '@/lib/types'
import type { Location } from '@/lib/types'

export const SCRAPE_TIMEOUT = 30_000

export abstract class BaseScraper {
  abstract readonly platformId: PlatformId
  /** If true, scraper uses plain HTTP and doesn't need a BrowserContext */
  readonly isHttpOnly: boolean = false

  abstract scrape(
    query: string,
    location: Location,
    context: BrowserContext
  ): Promise<Product[]>

  /**
   * Intercept EVERY JSON response and call onJson with the parsed body.
   * Returns an unsubscribe function.
   */
  protected onAnyJson(page: Page, onJson: (json: unknown, url: string) => void): () => void {
    const handler = async (res: import('playwright').Response) => {
      if (res.status() !== 200) return
      const ct = res.headers()['content-type'] ?? ''
      if (!ct.includes('json')) return
      try {
        const json = await res.json()
        onJson(json, res.url())
      } catch { /* skip */ }
    }
    page.on('response', handler)
    return () => page.off('response', handler)
  }

  /** Block heavy resources that slow down load */
  protected async blockHeavyResources(page: Page): Promise<void> {
    await page.route('**/*', (route: Route) => {
      const rt = route.request().resourceType()
      if (['stylesheet', 'font', 'media', 'websocket', 'eventsource'].includes(rt)) {
        route.abort()
      } else {
        route.continue()
      }
    })
  }

  /**
   * Navigate to the site homepage, inject location into localStorage + cookies,
   * then dismiss any modals.
   */
  protected async setLocationViaHomepage(
    page: Page,
    homeUrl: string,
    location: Location,
    localStorageKeys: Record<string, string>,
    cookieOverrides: Array<{ name: string; value: string; domain: string }>
  ): Promise<void> {
    // Set cookies at context level (they persist across navigations)
    await page.context().addCookies(
      cookieOverrides.map(c => ({ ...c, path: '/' }))
    )

    await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })

    // Inject into localStorage (page must be loaded for this to work)
    await page.evaluate((keys: Record<string, string>) => {
      for (const [k, v] of Object.entries(keys)) {
        try { localStorage.setItem(k, v) } catch { /* ignore */ }
      }
    }, localStorageKeys)

    // Dismiss any overlays/popups
    await this.dismissOverlays(page)
  }

  /** Click away common permission/cookie/notification overlays */
  protected async dismissOverlays(page: Page): Promise<void> {
    const selectors = [
      'button:has-text("Skip")',
      'button:has-text("Not now")',
      'button:has-text("Continue")',
      'button:has-text("Got it")',
      'button:has-text("Okay")',
      'button:has-text("Allow")',
      '[data-testid="dismiss"]',
      '[aria-label="Close"]',
      '.close-btn',
      '.modal-close',
    ]
    for (const sel of selectors) {
      try {
        const el = page.locator(sel).first()
        if (await el.isVisible({ timeout: 800 })) {
          await el.click({ timeout: 800 }).catch(() => {})
        }
      } catch { /* skip */ }
    }
  }

  /** Universal price-first DOM extraction — works on any platform */
  protected async extractByPriceDOM(page: Page, platformId: PlatformId, searchUrl: string): Promise<Product[]> {
    return page.evaluate(({ pid, url }: { pid: string; url: string }) => {
      const rupeePattern = /[₹₹]?\s*(\d[\d,]*\.?\d*)/

      // Find all leaf elements containing a price
      const allEls = Array.from(document.querySelectorAll('*'))
      const priceEls = allEls.filter(el => {
        if (el.children.length > 3) return false
        const t = el.textContent?.trim() ?? ''
        if (t.length > 30 || !t.includes('₹')) return false
        const m = t.match(rupeePattern)
        return m ? parseFloat(m[1].replace(/,/g, '')) > 0 : false
      })

      const seen = new Set<string>()
      const products: ReturnType<typeof buildProduct>[] = []

      type Card = Element

      function buildProduct(card: Card, priceEl: Element, idx: number) {
        const nameEl =
          card.querySelector('h3, h4, h5, [class*="name" i], [class*="title" i], [class*="desc" i]') ??
          Array.from(card.querySelectorAll('p, div, span'))
            .filter(e => e.children.length === 0 && (e.textContent?.length ?? 0) > 6 && (e.textContent?.length ?? 0) < 120)[0]
        const name = nameEl?.textContent?.trim() ?? ''
        if (!name || name.length < 3) return null

        const priceText = priceEl.textContent?.replace(/,/g, '') ?? ''
        const priceMatch = priceText.match(/(\d+\.?\d*)/)
        const price = priceMatch ? parseFloat(priceMatch[1]) : 0
        if (price <= 0) return null

        const strikethru = card.querySelector('del, s, [class*="strike" i], [class*="original" i], [class*="mrp" i]')
        const origMatch = strikethru?.textContent?.match(/(\d+\.?\d*)/)
        const originalPrice = origMatch ? parseFloat(origMatch[1]) : undefined

        const img = card.querySelector('img')
        const link = (card.closest('a') ?? card.querySelector('a')) as HTMLAnchorElement | null
        const qty = card.querySelector('[class*="qty" i], [class*="weight" i], [class*="unit" i], [class*="size" i]')?.textContent?.trim() ?? ''
        const oos = (card.textContent ?? '').toLowerCase().includes('out of stock')

        return {
          id: `${pid}-${idx}`,
          name,
          price,
          originalPrice: originalPrice && originalPrice > price ? originalPrice : undefined,
          discountPercent: originalPrice && originalPrice > price
            ? Math.round(((originalPrice - price) / originalPrice) * 100)
            : undefined,
          quantity: qty,
          imageUrl: img?.src ?? '',
          productUrl: link?.href ?? url,
          platform: pid,
          inStock: !oos,
        } as const
      }

      for (let i = 0; i < priceEls.length && products.length < 20; i++) {
        const priceEl = priceEls[i]
        let el: Element | null = priceEl
        let depth = 0
        while (el && depth < 10) {
          if ((el as HTMLElement).offsetHeight > 80 && el.querySelector('img')) {
            const key = el.textContent?.slice(0, 40) ?? String(i)
            if (!seen.has(key)) {
              seen.add(key)
              const p = buildProduct(el, priceEl, i)
              if (p) products.push(p)
            }
            break
          }
          el = el.parentElement
          depth++
        }
      }

      return products
    }, { pid: platformId, url: searchUrl }) as Promise<Product[]>
  }
}

/** Universal recursive JSON product extractor */
export function extractProductsFromJson(
  json: unknown,
  platformId: PlatformId,
  productUrlBuilder: (o: Record<string, unknown>) => string
): Product[] {
  const products: Product[] = []

  function extractNumericPrice(val: unknown): number {
    if (val == null) return 0
    if (typeof val === 'number') return val
    if (typeof val === 'string') return parseFloat(val.replace(/[^\d.]/g, '')) || 0
    if (typeof val === 'object') {
      const v = val as Record<string, unknown>
      // Fynd/JioMart style: { effective: { min: 100 }, marked: { min: 120 } }
      const eff = v.effective ?? v.min ?? v.value
      if (eff != null && typeof eff !== 'object') return parseFloat(String(eff).replace(/[^\d.]/g, '')) || 0
      if (eff && typeof eff === 'object') {
        const nested = (eff as Record<string, unknown>).min ?? (eff as Record<string, unknown>).max
        if (nested != null) return parseFloat(String(nested).replace(/[^\d.]/g, '')) || 0
      }
    }
    return 0
  }

  function walk(obj: unknown, depth = 0): void {
    if (depth > 15 || !obj || typeof obj !== 'object') return
    if (Array.isArray(obj)) { obj.forEach(v => walk(v, depth + 1)); return }

    const o = obj as Record<string, unknown>

    const hasId = o.id != null || o.product_id != null || o.productId != null ||
                  o.sku != null || o.item_id != null || o.itemId != null ||
                  o.zpid != null || o.uid != null
    const hasName = typeof o.name === 'string' || typeof o.product_name === 'string' ||
                    typeof o.productName === 'string' || typeof o.itemName === 'string' ||
                    typeof o.desc === 'string' || typeof o.display_name === 'string' ||
                    typeof o.displayName === 'string' || typeof o.title === 'string'
    const hasPrice = o.price != null || o.sp != null || o.selling_price != null ||
                     o.sellingPrice != null || o.offer_price != null || o.offerPrice != null ||
                     o.discounted_price != null || o.final_price != null ||
                     o.special_price != null || o.effective_price != null ||
                     o.sale_price != null || o.salePrice != null

    if (hasId && hasName && hasPrice) {
      const price = extractNumericPrice(
        o.discounted_price ?? o.offer_price ?? o.sp ?? o.selling_price ?? o.sellingPrice ??
        o.final_price ?? o.offerPrice ?? o.special_price ?? o.effective_price ??
        o.sale_price ?? o.salePrice ?? o.price ?? 0
      )

      const mrp = extractNumericPrice(
        o.mrp ?? o.market_price ?? o.original_price ?? o.actualPrice ??
        o.compare_at_price ?? o.marked_price ?? o.mrpPrice ?? 0
      )

      const name = String(
        o.name ?? o.product_name ?? o.productName ?? o.itemName ??
        o.desc ?? o.display_name ?? o.displayName ?? o.title ?? ''
      ).trim()

      const brandRaw = o.brand_name ?? (o.brand && typeof o.brand === 'object' ? (o.brand as Record<string, unknown>).name : o.brand)
      const brand = brandRaw ? String(brandRaw) : undefined

      const mediaUrl = (o.media as Array<{url: string}> | undefined)?.[0]?.url

      if (price > 0 && name.length > 1 && products.length < 20) {
        products.push({
          id: `${platformId}-${o.id ?? o.product_id ?? o.productId ?? o.sku ?? o.item_id ?? o.itemId ?? o.uid ?? products.length}`,
          name,
          brand,
          price,
          originalPrice: mrp > price ? mrp : undefined,
          discountPercent: mrp > price ? Math.round(((mrp - price) / mrp) * 100) : undefined,
          quantity: String(
            o.unit ?? o.net_quantity ?? o.quantity ?? o.w ?? o.pack_size ?? o.net_content ?? o.weight ?? ''
          ),
          imageUrl: String(
            o.image ?? o.thumb_image ?? o.small_image ?? o.image_url ?? o.thumbnail ??
            mediaUrl ??
            (o.images as string[] | undefined)?.[0] ??
            (o.images as Array<{src: string}> | undefined)?.[0]?.src ?? ''
          ),
          productUrl: productUrlBuilder(o),
          platform: platformId,
          inStock: o.is_sold_out !== true && o.is_oos !== true &&
                   o.in_stock !== false && o.available !== false &&
                   o.isOutOfStock !== true,
        })
      }
      return // don't recurse into a product node
    }

    Object.values(o).forEach(v => walk(v, depth + 1))
  }

  walk(json)
  return products
}
