import type { BrowserContext } from 'playwright'
import type { Product } from '@/lib/types'
import type { Location } from '@/lib/types'
import { BaseScraper } from './base'

interface BBProduct {
  id?: string | number
  desc?: string
  brand?: { name?: string }
  w?: string
  absolute_url?: string
  thumb?: string
  pricing?: {
    discount?: {
      mrp?: number
      prim_price?: { sp?: number }
    }
  }
}

interface BBResponse {
  tab_results?: Array<{
    product_info?: { data?: BBProduct[] }
  }>
}

const BB_BASE = 'https://www.bigbasket.com'

function mapBBProducts(data: BBProduct[], platformId: 'bigbasket'): Product[] {
  return data.flatMap((p, idx) => {
    const price = p.pricing?.discount?.prim_price?.sp ?? 0
    const mrp = p.pricing?.discount?.mrp ?? 0
    const name = p.desc?.trim() ?? ''
    if (price <= 0 || name.length < 2) return []
    return [{
      id: `${platformId}-${p.id ?? idx}`,
      name,
      brand: p.brand?.name,
      price,
      originalPrice: mrp > price ? mrp : undefined,
      discountPercent: mrp > price ? Math.round(((mrp - price) / mrp) * 100) : undefined,
      quantity: p.w ?? '',
      imageUrl: p.thumb ? `${BB_BASE}${p.thumb}` : '',
      productUrl: `${BB_BASE}${p.absolute_url ?? `/pd/${p.id}/`}`,
      platform: platformId,
      inStock: true,
    }]
  })
}

export class BigBasketScraper extends BaseScraper {
  readonly platformId = 'bigbasket' as const
  readonly isHttpOnly = true

  async scrape(query: string, location: Location, _context: BrowserContext): Promise<Product[]> {
    // Try bb_now (express) first, fall back to regular search
    const products = await this._fetch(query, location, 'bb_now')
    if (products.length > 0) return products
    return this._fetch(query, location, 'all')
  }

  private async _fetch(query: string, location: Location, storeType: string): Promise<Product[]> {
    const url = `${BB_BASE}/listing-svc/v2/products?type=ps&slug=&q=${encodeURIComponent(query)}&storeType=${storeType}&sort=relevance&page=1`
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-IN,en;q=0.9',
          'Referer': 'https://www.bigbasket.com/',
          'Origin': 'https://www.bigbasket.com',
          'Cookie': `bb_city_id=2; bb_city=${location.city ?? 'Bengaluru'}; bb_pin=${location.pincode}; x_channel=BB-WEB`,
          'x-channel': 'BB-WEB',
        },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return []
      const json = await res.json() as BBResponse
      const data = json.tab_results?.[0]?.product_info?.data ?? []
      return mapBBProducts(data, 'bigbasket')
    } catch {
      return []
    }
  }
}
