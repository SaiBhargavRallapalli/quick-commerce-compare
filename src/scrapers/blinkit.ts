import type { BrowserContext, Page } from 'playwright'
import type { Product } from '@/lib/types'
import type { Location } from '@/lib/types'
import { BaseScraper, extractProductsFromJson } from './base'

export class BlinkitScraper extends BaseScraper {
  readonly platformId = 'blinkit' as const

  async scrape(query: string, location: Location, context: BrowserContext): Promise<Product[]> {
    const page = await context.newPage()
    try {
      await this.blockHeavyResources(page)
      return await this._scrape(page, query, location)
    } finally {
      await page.close()
    }
  }

  private async _scrape(page: Page, query: string, location: Location): Promise<Product[]> {
    const products: Product[] = []

    // Capture every JSON response
    const unsubscribe = this.onAnyJson(page, (json) => {
      const found = extractProductsFromJson(json, 'blinkit', (o) =>
        o.share_url
          ? String(o.share_url)
          : `https://blinkit.com/prn/${String(o.name ?? '').toLowerCase().replace(/\s+/g, '-')}/prid/${o.product_id ?? o.id}`
      )
      found.forEach(p => { if (!products.some(x => x.id === p.id)) products.push(p) })
    })

    try {
      // Step 1: Homepage with location injected
      await this.setLocationViaHomepage(
        page,
        'https://blinkit.com/',
        location,
        {
          userDetails: JSON.stringify({ lat: location.lat, lng: location.lon, pinCode: location.pincode }),
          'user-lat': String(location.lat),
          'user-lng': String(location.lon),
          userPincode: location.pincode,
          gr_location: JSON.stringify({ lat: location.lat, lng: location.lon }),
          customerLatitude: String(location.lat),
          customerLongitude: String(location.lon),
        },
        [
          { name: 'gr_postcode', value: location.pincode, domain: '.blinkit.com' },
          { name: 'userLatitude', value: String(location.lat), domain: '.blinkit.com' },
          { name: 'userLongitude', value: String(location.lon), domain: '.blinkit.com' },
        ]
      )

      // Step 2: Handle location picker if visible
      await this._handleLocationPicker(page, location)

      // Step 3: Navigate to search
      await page.goto(
        `https://blinkit.com/s/?q=${encodeURIComponent(query)}`,
        { waitUntil: 'domcontentloaded', timeout: 20000 }
      )

      // Wait for products (either via API or DOM)
      await Promise.race([
        this._waitForProducts(products),
        page.waitForTimeout(12000),
      ])

      if (products.length > 0) return products

      // DOM fallback
      return await this.extractByPriceDOM(page, 'blinkit', `https://blinkit.com/s/?q=${encodeURIComponent(query)}`)
    } finally {
      unsubscribe()
    }
  }

  private async _handleLocationPicker(page: Page, location: Location): Promise<void> {
    try {
      // Detect a visible pincode input (location picker modal / inline bar)
      const pincodeInput = page.locator(
        'input[placeholder*="pincode" i], input[placeholder*="area" i], input[type="number"][maxlength="6"]'
      ).first()

      if (await pincodeInput.isVisible({ timeout: 3000 })) {
        await pincodeInput.fill(location.pincode)
        await page.waitForTimeout(1200)

        // Click the first suggestion
        const suggestion = page.locator('[class*="suggestion" i] li, [class*="listItem" i], [class*="SuggestionItem" i]').first()
        if (await suggestion.isVisible({ timeout: 2000 })) {
          await suggestion.click()
        } else {
          await pincodeInput.press('Enter')
        }
        await page.waitForTimeout(1500)
      }
    } catch { /* no location picker */ }
  }

  private _waitForProducts(products: Product[]): Promise<void> {
    return new Promise(resolve => {
      const iv = setInterval(() => {
        if (products.length >= 3) { clearInterval(iv); resolve() }
      }, 300)
      // auto-clear after 15s to prevent leak
      setTimeout(() => { clearInterval(iv); resolve() }, 15000)
    })
  }
}
