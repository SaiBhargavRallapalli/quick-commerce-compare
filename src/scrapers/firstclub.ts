import type { BrowserContext } from 'playwright'
import type { Product } from '@/lib/types'
import type { Location } from '@/lib/types'
import { BaseScraper } from './base'

const FC_BASE = 'https://www.firstclub.io'

interface ShopifyVariant {
  id?: number
  price?: string
  compare_at_price?: string | null
  available?: boolean
  title?: string
}

interface ShopifyProduct {
  id?: number
  title?: string
  handle?: string
  vendor?: string
  variants?: ShopifyVariant[]
  images?: Array<{ src?: string }>
}

interface ShopifySearchResponse {
  results?: ShopifyProduct[]
}

export class FirstClubScraper extends BaseScraper {
  readonly platformId = 'firstclub' as const
  readonly isHttpOnly = true

  async scrape(query: string, _location: Location, _context: BrowserContext): Promise<Product[]> {
    try {
      const res = await fetch(
        `${FC_BASE}/search.json?type=product&q=${encodeURIComponent(query)}&limit=20`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(8000),
        }
      )
      if (!res.ok) return []
      const json = await res.json() as ShopifySearchResponse
      return (json.results ?? []).flatMap((p, idx) => this._mapProduct(p, idx))
    } catch {
      return []
    }
  }

  private _mapProduct(p: ShopifyProduct, idx: number): Product[] {
    const variant = p.variants?.find(v => v.available !== false) ?? p.variants?.[0]
    if (!variant) return []
    const price = parseFloat(variant.price ?? '0') || 0
    if (price <= 0) return []
    const name = p.title?.trim() ?? ''
    if (name.length < 2) return []
    const mrp = parseFloat(variant.compare_at_price ?? '0') || 0
    return [{
      id: `firstclub-${p.id ?? idx}`,
      name,
      brand: p.vendor ?? undefined,
      price,
      originalPrice: mrp > price ? mrp : undefined,
      discountPercent: mrp > price ? Math.round(((mrp - price) / mrp) * 100) : undefined,
      quantity: variant.title && variant.title !== 'Default Title' ? variant.title : '',
      imageUrl: p.images?.[0]?.src ?? '',
      productUrl: `${FC_BASE}/products/${p.handle ?? ''}`,
      platform: 'firstclub',
      inStock: variant.available !== false,
    }]
  }
}
