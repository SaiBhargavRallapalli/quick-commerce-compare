import type { BrowserContext, Page } from 'playwright'
import type { Product } from '@/lib/types'
import type { Location } from '@/lib/types'
import { BaseScraper, extractProductsFromJson } from './base'

const BLINKIT_LS = (location: Location) => ({
  userDetails: JSON.stringify({ lat: location.lat, lng: location.lon, pinCode: location.pincode }),
  'user-lat': String(location.lat),
  'user-lng': String(location.lon),
  userPincode: location.pincode,
  gr_location: JSON.stringify({ lat: location.lat, lng: location.lon }),
  customerLatitude: String(location.lat),
  customerLongitude: String(location.lon),
})

const BLINKIT_COOKIES = (location: Location) => [
  { name: 'gr_postcode', value: location.pincode, domain: '.blinkit.com' },
  { name: 'userLatitude', value: String(location.lat), domain: '.blinkit.com' },
  { name: 'userLongitude', value: String(location.lon), domain: '.blinkit.com' },
]

export class BlinkitScraper extends BaseScraper {
  readonly platformId = 'blinkit' as const

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
      const found = extractProductsFromJson(json, 'blinkit', (o) =>
        o.share_url
          ? String(o.share_url)
          : `https://blinkit.com/prn/${String(o.name ?? '').toLowerCase().replace(/\s+/g, '-')}/prid/${o.product_id ?? o.id}`
      )
      found.forEach(p => { if (!products.some(x => x.id === p.id)) products.push(p) })
    })

    try {
      await this.injectLocation(page, BLINKIT_LS(location), BLINKIT_COOKIES(location))

      const searchUrl = `https://blinkit.com/s/?q=${encodeURIComponent(query)}`
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await this._handleLocationPicker(page, location)

      await this.waitForMinProducts(products)

      if (products.length > 0) return products

      return await this.extractByPriceDOM(page, 'blinkit', searchUrl)
    } finally {
      unsubscribe()
    }
  }

  private async _handleLocationPicker(page: Page, location: Location): Promise<void> {
    try {
      const pincodeInput = page.locator(
        'input[placeholder*="pincode" i], input[placeholder*="area" i], input[type="number"][maxlength="6"]'
      ).first()

      if (await pincodeInput.isVisible({ timeout: 1500 })) {
        await pincodeInput.fill(location.pincode)
        await page.waitForTimeout(600)

        const suggestion = page.locator('[class*="suggestion" i] li, [class*="listItem" i], [class*="SuggestionItem" i]').first()
        if (await suggestion.isVisible({ timeout: 1500 })) {
          await suggestion.click()
        } else {
          await pincodeInput.press('Enter')
        }
        await page.waitForTimeout(800)
      }
    } catch { /* no location picker */ }
  }
}
