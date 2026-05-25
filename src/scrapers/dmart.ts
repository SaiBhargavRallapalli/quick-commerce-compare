import type { BrowserContext } from 'playwright'
import type { Product } from '@/lib/types'
import type { Location } from '@/lib/types'
import { BaseScraper } from './base'

const DIGITAL_BASE = 'https://digital.dmart.in/api'
const CDN_BASE = 'https://cdn.dmart.in/images/products'
const DEFAULT_STORE_ID = '10151'

// Cache pincode → storeId lookups in-process
const storeIdCache = new Map<string, string>()

export class DmartScraper extends BaseScraper {
  readonly platformId = 'dmart' as const
  readonly isHttpOnly = true

  // BrowserContext is unused — DMart API is accessible via plain HTTP
  async scrape(query: string, location: Location, _context: BrowserContext): Promise<Product[]> {
    const storeId = await this._getStoreId(location.pincode)
    return this._searchAPI(query, storeId)
  }

  private async _getStoreId(pincode: string): Promise<string> {
    const cached = storeIdCache.get(pincode)
    if (cached) return cached

    try {
      const res = await fetch(
        `${DIGITAL_BASE}/v1/pincodes?pinCode=${encodeURIComponent(pincode)}&storeType=all`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Referer': 'https://www.dmart.in/',
          },
          signal: AbortSignal.timeout(5000),
        }
      )
      if (!res.ok) return DEFAULT_STORE_ID
      const json = await res.json() as { StorePincodeDetails?: Array<{ StoreId: string; Pincode: string }> }
      const match = json.StorePincodeDetails?.find(s => s.Pincode === pincode)
      const storeId = match?.StoreId ?? json.StorePincodeDetails?.[0]?.StoreId ?? DEFAULT_STORE_ID
      storeIdCache.set(pincode, storeId)
      return storeId
    } catch {
      return DEFAULT_STORE_ID
    }
  }

  private async _searchAPI(query: string, storeId: string): Promise<Product[]> {
    try {
      const url = `${DIGITAL_BASE}/v3/search/${encodeURIComponent(query)}?page=1&buryOOS=true&size=20&storeId=${storeId}`
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': `https://www.dmart.in/search?searchTerm=${encodeURIComponent(query)}`,
          'Origin': 'https://www.dmart.in',
        },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return []
      const json = await res.json() as { products?: DmartProduct[] }
      const products = json.products ?? []
      return products.slice(0, 20).flatMap(p => this._mapProduct(p)).filter(Boolean) as Product[]
    } catch {
      return []
    }
  }

  private _mapProduct(p: DmartProduct): Product[] {
    if (!p.sKUs?.length) return []

    // Prefer first available (non-OOS) SKU, fall back to first
    const sku = p.sKUs.find(s => s.invType !== 'OOS') ?? p.sKUs[0]
    const price = parseFloat(sku.priceSALE ?? '0') || 0
    if (price <= 0) return []

    const mrp = parseFloat(sku.priceMRP ?? '0') || 0
    const imageUrl = sku.productImageKey && sku.imgCode
      ? `${CDN_BASE}/${sku.productImageKey}_${sku.imgCode}_P.jpg`
      : undefined

    return [{
      id: `dmart-${p.productId ?? sku.skuUniqueID}`,
      name: sku.name ?? p.name ?? '',
      brand: p.manufacturer ?? undefined,
      price,
      originalPrice: mrp > price ? mrp : undefined,
      discountPercent: sku.savingPercentage && sku.savingPercentage > 0 ? sku.savingPercentage : undefined,
      quantity: sku.variantTextValue ?? '',
      imageUrl,
      productUrl: `https://www.dmart.in/pdp/${p.productId}`,
      platform: 'dmart',
      inStock: sku.invType !== 'OOS' && sku.buyable === 'true',
    }]
  }
}

interface DmartSku {
  name?: string
  skuUniqueID?: string
  priceSALE?: string
  priceMRP?: string
  savePrice?: string
  savingPercentage?: number
  variantTextValue?: string
  productImageKey?: string
  imgCode?: string
  invType?: string
  buyable?: string
}

interface DmartProduct {
  productId?: string
  name?: string
  manufacturer?: string
  sKUs?: DmartSku[]
}
