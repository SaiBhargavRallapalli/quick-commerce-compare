import type { BrowserContext, Page } from 'playwright'
import type { Product } from '@/lib/types'
import type { Location } from '@/lib/types'
import { BaseScraper, extractProductsFromJson } from './base'

export class ZeptoScraper extends BaseScraper {
  readonly platformId = 'zepto' as const

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

    const unsubscribe = this.onAnyJson(page, (json) => {
      const found = extractProductsFromJson(json, 'zepto', (o) => {
        const slug = String(o.product_name ?? o.name ?? '').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
        return `https://www.zepto.com/pn/${slug}/pvid/${o.product_id ?? o.zpid ?? o.id ?? ''}`
      })
      found.forEach(p => { if (!products.some(x => x.id === p.id)) products.push(p) })
    })

    try {
      await this.setLocationViaHomepage(
        page,
        'https://www.zepto.com/',
        location,
        {
          userLatitude: String(location.lat),
          userLongitude: String(location.lon),
          latitude: String(location.lat),
          longitude: String(location.lon),
          pincode: location.pincode,
          userPincode: location.pincode,
          'zepto-location': JSON.stringify({ lat: location.lat, lng: location.lon, pinCode: location.pincode }),
        },
        [
          { name: 'userLatitude', value: String(location.lat), domain: '.zepto.com' },
          { name: 'userLongitude', value: String(location.lon), domain: '.zepto.com' },
          { name: 'pincode', value: location.pincode, domain: '.zepto.com' },
        ]
      )

      // Handle city selection modal if present
      await this._handleCityModal(page, location)

      // Navigate to search
      await page.goto(
        `https://www.zepto.com/search?query=${encodeURIComponent(query)}`,
        { waitUntil: 'domcontentloaded', timeout: 20000 }
      )

      await Promise.race([
        this._waitFor(products, 3),
        page.waitForTimeout(12000),
      ])

      if (products.length > 0) return products

      return await this.extractByPriceDOM(page, 'zepto', `https://www.zepto.com/search?query=${encodeURIComponent(query)}`)
    } finally {
      unsubscribe()
    }
  }

  private async _handleCityModal(page: Page, location: Location): Promise<void> {
    try {
      // Zepto shows a city picker on first load
      const pincodeInput = page.locator(
        'input[placeholder*="pincode" i], input[placeholder*="Pincode" i], input[placeholder*="city" i], input[placeholder*="area" i]'
      ).first()

      if (await pincodeInput.isVisible({ timeout: 3000 })) {
        await pincodeInput.fill(location.pincode)
        await page.waitForTimeout(1000)

        const suggestion = page.locator('[class*="suggestion" i], [class*="listItem" i], [class*="DropdownItem" i], ul > li').first()
        if (await suggestion.isVisible({ timeout: 2000 })) {
          await suggestion.click()
        } else {
          await pincodeInput.press('Enter')
        }
        await page.waitForTimeout(1500)
      }
    } catch { /* no modal */ }
  }

  private _waitFor(arr: Product[], min: number): Promise<void> {
    return new Promise(resolve => {
      const iv = setInterval(() => {
        if (arr.length >= min) { clearInterval(iv); resolve() }
      }, 300)
      setTimeout(() => { clearInterval(iv); resolve() }, 15000)
    })
  }
}
