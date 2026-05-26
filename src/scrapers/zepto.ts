import type { BrowserContext, Page } from 'playwright'
import type { Product } from '@/lib/types'
import type { Location } from '@/lib/types'
import { BaseScraper, extractProductsFromJson } from './base'

const ZEPTO_LS = (location: Location) => ({
  userLatitude: String(location.lat),
  userLongitude: String(location.lon),
  latitude: String(location.lat),
  longitude: String(location.lon),
  pincode: location.pincode,
  userPincode: location.pincode,
  'zepto-location': JSON.stringify({ lat: location.lat, lng: location.lon, pinCode: location.pincode }),
})

const ZEPTO_COOKIES = (location: Location) => [
  { name: 'userLatitude', value: String(location.lat), domain: '.zepto.com' },
  { name: 'userLongitude', value: String(location.lon), domain: '.zepto.com' },
  { name: 'pincode', value: location.pincode, domain: '.zepto.com' },
]

export class ZeptoScraper extends BaseScraper {
  readonly platformId = 'zepto' as const

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
      const found = extractProductsFromJson(json, 'zepto', (o) => {
        const slug = String(o.product_name ?? o.name ?? '').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
        return `https://www.zepto.com/pn/${slug}/pvid/${o.product_id ?? o.zpid ?? o.id ?? ''}`
      })
      found.forEach(p => { if (!products.some(x => x.id === p.id)) products.push(p) })
    })

    try {
      await this.injectLocation(page, ZEPTO_LS(location), ZEPTO_COOKIES(location))

      const searchUrl = `https://www.zepto.com/search?query=${encodeURIComponent(query)}`
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await this._handleCityModal(page, location)

      await this.waitForMinProducts(products)

      if (products.length > 0) return products

      return await this.extractByPriceDOM(page, 'zepto', searchUrl)
    } finally {
      unsubscribe()
    }
  }

  private async _handleCityModal(page: Page, location: Location): Promise<void> {
    try {
      const pincodeInput = page.locator(
        'input[placeholder*="pincode" i], input[placeholder*="Pincode" i], input[placeholder*="city" i], input[placeholder*="area" i]'
      ).first()

      if (await pincodeInput.isVisible({ timeout: 1500 })) {
        await pincodeInput.fill(location.pincode)
        await page.waitForTimeout(600)

        const suggestion = page.locator('[class*="suggestion" i], [class*="listItem" i], [class*="DropdownItem" i], ul > li').first()
        if (await suggestion.isVisible({ timeout: 1500 })) {
          await suggestion.click()
        } else {
          await pincodeInput.press('Enter')
        }
        await page.waitForTimeout(800)
      }
    } catch { /* no modal */ }
  }
}
