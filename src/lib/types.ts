export type PlatformId =
  | 'blinkit'
  | 'zepto'
  | 'bigbasket'
  | 'swiggy'
  | 'jiomart'
  | 'dmart'
  | 'firstclub'

export interface Platform {
  id: PlatformId
  name: string
  tagline: string
  color: string
  bgLight: string
  textColor: string
  website: string
  deliveryTime: string
  logoEmoji: string
}

export interface Product {
  id: string
  name: string
  brand?: string
  price: number
  originalPrice?: number
  discountPercent?: number
  quantity: string
  imageUrl?: string
  productUrl: string
  platform: PlatformId
  inStock: boolean
  deliveryTime?: string
  rating?: number
  ratingCount?: number
}

export type ScrapeStatus = 'idle' | 'loading' | 'success' | 'error' | 'timeout'

export interface PlatformResult {
  platform: PlatformId
  products: Product[]
  status: ScrapeStatus
  error?: string
  durationMs?: number
}

export interface SearchState {
  query: string
  pincode: string
  results: Record<PlatformId, PlatformResult>
  isSearching: boolean
}

export interface Location {
  pincode: string
  lat: number
  lon: number
  city: string
}

export interface StreamEvent {
  type: 'platform_result' | 'done' | 'error'
  data: PlatformResult | { message: string }
}
